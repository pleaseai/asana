import { Command } from 'commander'
import chalk from 'chalk'
import asana from 'asana'
import { loadConfig, saveConfig } from '../lib/config'
import { getAsanaClient, resetClient } from '../lib/asana-client'
import { startOAuthFlow } from '../lib/oauth'

export function createAuthCommand(): Command {
  const auth = new Command('auth')
    .description('Manage Asana authentication')

  auth
    .command('login')
    .description('Login to Asana (OAuth or PAT)')
    .option('--token <token>', 'Use Personal Access Token (PAT) instead of OAuth')
    .option('-w, --workspace <workspace>', 'Default workspace ID')
    .action(async (options) => {
      try {
        if (options.token) {
          // PAT authentication
          console.log(chalk.blue('Authenticating with Personal Access Token...'))

          // Validate token
          const client = asana.Client.create().useAccessToken(options.token)
          await client.users.me()

          saveConfig({
            accessToken: options.token,
            authType: 'pat',
            workspace: options.workspace,
          })

          console.log(chalk.green('✓ Successfully authenticated with PAT'))
          console.log(chalk.gray('  Docs: https://developers.asana.com/docs/personal-access-token'))
        }
        else {
          // OAuth authentication
          console.log(chalk.blue('Starting OAuth authentication...'))
          console.log(chalk.gray('  Make sure ASANA_CLIENT_ID and ASANA_CLIENT_SECRET are set'))
          console.log(chalk.gray('  Create OAuth app at: https://app.asana.com/0/my-apps'))
          console.log(chalk.gray('  Docs: https://developers.asana.com/docs/getting-started-with-asana-oauth\n'))

          const tokenResponse = await startOAuthFlow()

          // Calculate expiration time
          const expiresAt = Date.now() + (tokenResponse.expires_in * 1000)

          saveConfig({
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token,
            authType: 'oauth',
            workspace: options.workspace,
            expiresAt,
          })

          console.log(chalk.green('✓ Successfully authenticated with OAuth'))
          console.log(chalk.gray('  Docs: https://developers.asana.com/docs/authentication'))
        }

        if (options.workspace) {
          console.log(chalk.blue(`  Default workspace: ${options.workspace}`))
        }
      }
      catch (error) {
        console.error(chalk.red('✗ Authentication failed:'))
        console.error(error instanceof Error ? error.message : error)
        process.exit(1)
      }
    })

  auth
    .command('logout')
    .description('Remove stored credentials')
    .action(() => {
      try {
        saveConfig({ accessToken: '' })
        resetClient()
        console.log(chalk.green('✓ Successfully logged out'))
      }
      catch (error) {
        console.error(chalk.red('✗ Logout failed:'), error)
        process.exit(1)
      }
    })

  auth
    .command('whoami')
    .description('Display current authenticated user')
    .action(async () => {
      try {
        const client = getAsanaClient()
        const user = await client.users.me()
        const config = loadConfig()

        console.log(chalk.bold('\nCurrent User:'))
        console.log(`  Name: ${user.name}`)
        console.log(`  Email: ${user.email}`)
        console.log(`  GID: ${user.gid}`)

        if (config) {
          console.log(chalk.bold('\nAuthentication:'))
          console.log(`  Type: ${config.authType === 'oauth' ? 'OAuth 2.0' : 'Personal Access Token'}`)
          if (config.authType === 'oauth' && config.expiresAt) {
            const expiresIn = Math.floor((config.expiresAt - Date.now()) / 1000 / 60)
            console.log(`  Expires: ${expiresIn > 0 ? `in ${expiresIn} minutes` : 'expired (will auto-refresh)'}`)
          }
          if (config.workspace) {
            console.log(`  Default Workspace: ${config.workspace}`)
          }
        }
      }
      catch (error) {
        console.error(chalk.red('✗ Not authenticated. Run "asana auth login" first.'))
        process.exit(1)
      }
    })

  return auth
}
