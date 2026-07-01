import asana from 'asana'
import chalk from 'chalk'
import { Command } from 'commander'
import { getAsanaClient, resetClient } from '../lib/asana-client'
import { loadConfig, saveConfig } from '../lib/config'
import { handleAsanaError } from '../lib/error-handler'
import { startOAuthFlow } from '../lib/oauth'
import { formatOutput, getOutputFormat } from '../utils/formatter'

/**
 * Parse and validate a redirect-port value from a CLI flag or env var. Throws a
 * clear error when the value is not an integer in the valid TCP range. The
 * echoed value is sanitized at the logging sink (see the catch block below).
 */
function parseRedirectPort(raw: string, source: string): number {
  const port = Number(raw)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid ${source} "${raw}"; expected an integer between 1 and 65535.`)
  }
  return port
}

export function createAuthCommand(): Command {
  const auth = new Command('auth')
    .description('Manage Asana authentication')

  auth
    .command('login')
    .description('Login to Asana (OAuth or PAT)')
    .option('--token <token>', 'Use Personal Access Token (PAT) instead of OAuth')
    .option('-w, --workspace <workspace>', 'Default workspace ID')
    .option('--scope <scopes>', 'OAuth scopes, space-separated (e.g. "tasks:read projects:read")')
    .option('--no-browser', 'Use copy-paste flow instead of opening browser (for headless/CI environments)')
    .option('--redirect-port <port>', 'Local port for the OAuth browser redirect (default 8080); must match the URL registered on the Asana app')
    .action(async (options) => {
      try {
        if (options.token) {
          // PAT authentication
          console.log(chalk.blue('Authenticating with Personal Access Token...'))

          // Validate the token with the v3 SDK before persisting it.
          // (The old `asana.Client.create()` helper was removed in asana@3.)
          const apiClient = asana.ApiClient.instance
          if (!apiClient.authentications?.token) {
            throw new Error('Asana API client is not properly initialized: token authentication scheme is missing.')
          }
          apiClient.authentications.token.accessToken = options.token
          await new asana.UsersApi().getUser('me', {})

          saveConfig({
            accessToken: options.token,
            authType: 'pat',
            workspace: options.workspace,
          })
          resetClient()

          console.log(chalk.green('✓ Successfully authenticated with PAT'))
          console.log(chalk.gray('  Docs: https://developers.asana.com/docs/personal-access-token'))
        }
        else {
          // OAuth authentication
          console.log(chalk.blue('Starting OAuth authentication...'))
          console.log(chalk.gray('  Make sure ASANA_CLIENT_ID and ASANA_CLIENT_SECRET are set'))
          console.log(chalk.gray('  Create OAuth app at: https://app.asana.com/0/my-apps'))
          console.log(chalk.gray('  Docs: https://developers.asana.com/docs/getting-started-with-asana-oauth\n'))

          const scopes = options.scope ? options.scope.trim().split(/\s+/) : undefined
          // Fail fast on a malformed port from either source instead of
          // silently falling back to the default and binding an unexpected
          // port. The CLI flag takes precedence over the env var.
          let redirectPort: number | undefined
          if (options.redirectPort !== undefined) {
            redirectPort = parseRedirectPort(options.redirectPort, '--redirect-port')
          }
          else if (process.env.ASANA_OAUTH_REDIRECT_PORT !== undefined) {
            redirectPort = parseRedirectPort(process.env.ASANA_OAUTH_REDIRECT_PORT, 'ASANA_OAUTH_REDIRECT_PORT')
          }
          const tokenResponse = await startOAuthFlow({ scopes, oob: options.browser === false, redirectPort })

          // Calculate expiration time
          const expiresAt = Date.now() + (tokenResponse.expires_in * 1000)

          saveConfig({
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token,
            authType: 'oauth',
            workspace: options.workspace,
            expiresAt,
            scopes,
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
        // Strip line breaks before logging so user-controlled values embedded
        // in an error message cannot forge log lines (SonarCloud S5145).
        const message = (error instanceof Error ? error.message : String(error)).replace(/[\r\n]+/g, ' ')
        console.error(message)
        // A redirect_uri mismatch almost always means the app is a command-line
        // app type, which only accepts the out-of-band flow. Asana surfaces this
        // through the callback as `OAuth error: invalid_request` (no redirect_uri
        // token), so match both shapes.
        if (/redirect_uri|invalid_request/i.test(message)) {
          console.error(chalk.yellow('  Hint: If your Asana app is a "command-line app", re-run with --no-browser.'))
        }
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
    .action(async (options: any, command: Command) => {
      // Resolve format up front so it is available in the catch block too.
      const format = getOutputFormat(command)

      try {
        const client = getAsanaClient()
        const user = await client.users.me()
        const config = loadConfig()

        // Prepare user data for output
        const userData: any = {
          user: {
            name: user.name,
            email: user.email,
            gid: user.gid,
          },
        }

        if (config) {
          userData.authentication = {
            type: config.authType === 'oauth' ? 'OAuth 2.0' : 'Personal Access Token',
          }

          if (config.authType === 'oauth' && config.expiresAt) {
            const expiresIn = Math.floor((config.expiresAt - Date.now()) / 1000 / 60)
            userData.authentication.expires = expiresIn > 0 ? `in ${expiresIn} minutes` : 'expired (will auto-refresh)'
          }

          if (config.workspace) {
            userData.authentication.default_workspace = config.workspace
          }
        }

        // Format output based on selected format
        const output = formatOutput(userData, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        // No stored credentials at all → keep the friendly login hint for humans.
        // For machine formats (json/toon) fall through to handleAsanaError so the
        // failure is emitted as structured output instead of a plain colored line.
        if (format === 'plain' && error instanceof Error && error.message.includes('Asana access token not found')) {
          console.error(chalk.red('✗ Not authenticated. Run "asana auth login" first.'))
          process.exit(1)
        }

        // Otherwise surface the real failure (401, app-type restriction, network,
        // etc.) instead of masking every error as "not authenticated".
        handleAsanaError(error, 'Get current user', {}, format)
      }
    })

  return auth
}
