import type { WorkspaceListOptions } from '../types'
import chalk from 'chalk'
import { Command } from 'commander'
import { getAsanaClient } from '../lib/asana-client'
import { getDefaultCache } from '../lib/cache'
import { loadConfig, saveConfig } from '../lib/config'
import { handleAsanaError } from '../lib/error-handler'
import { validateGid, ValidationError } from '../lib/validators'
import { formatOutput, getOutputFormat } from '../utils/formatter'

const WORKSPACES_CACHE_KEY = 'workspaces'
const USER_FIELDS = { opt_fields: 'name,email' }

export function createWorkspaceCommand(): Command {
  const workspace = new Command('workspace')
    .description('Manage Asana workspaces')

  workspace
    .command('list')
    .description('List workspaces for the current user')
    .option('--no-cache', 'Bypass cached workspace list and fetch fresh data')
    .action(async (options: WorkspaceListOptions, command: Command) => {
      try {
        const cache = getDefaultCache()
        const cached = options.cache === false ? null : cache.get<any[]>(WORKSPACES_CACHE_KEY)
        let workspaces: any[]

        if (cached) {
          workspaces = cached
        }
        else {
          const client = getAsanaClient()
          const response = await client.workspaces.findAll()
          workspaces = response.data || []
          cache.set(WORKSPACES_CACHE_KEY, workspaces)
        }

        if (workspaces.length === 0) {
          console.log(chalk.yellow('No workspaces found'))
          return
        }

        const format = getOutputFormat(command)
        const output = formatOutput({ workspaces }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        handleAsanaError(error, 'Workspace listing', {})
      }
    })

  workspace
    .command('get')
    .description('Get workspace details')
    .argument('<gid>', 'Workspace GID')
    .action(async (gid: string, options: any, command: Command) => {
      try {
        validateGid(gid, 'Workspace GID')

        const client = getAsanaClient()
        const workspaceDetail = await client.workspaces.findById(gid)

        const workspaceData = {
          gid: workspaceDetail.gid,
          name: workspaceDetail.name,
          is_organization: workspaceDetail.is_organization,
          email_domains: workspaceDetail.email_domains,
        }

        const format = getOutputFormat(command)
        const output = formatOutput({ workspace: workspaceData }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Workspace retrieval', { 'Workspace GID': gid })
      }
    })

  workspace
    .command('users')
    .description('List users in a workspace')
    .argument('[gid]', 'Workspace GID (defaults to configured workspace)')
    .action(async (gid: string | undefined, options: any, command: Command) => {
      const workspaceGid = gid || loadConfig()?.workspace
      try {
        if (!workspaceGid) {
          throw new Error('Workspace is required. Set default workspace or pass a workspace GID.')
        }
        validateGid(workspaceGid, 'Workspace GID')

        const client = getAsanaClient()
        const response = await client.workspaces.findUsers(workspaceGid, USER_FIELDS)
        const users = response.data || []

        if (users.length === 0) {
          console.log(chalk.yellow('No users found'))
          return
        }

        const format = getOutputFormat(command)
        const output = formatOutput({ users }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Workspace user listing', { 'Workspace GID': workspaceGid })
      }
    })

  workspace
    .command('set-default')
    .description('Set the default workspace in config')
    .argument('<gid>', 'Workspace GID')
    .action(async (gid: string) => {
      try {
        validateGid(gid, 'Workspace GID')

        const config = loadConfig()
        if (!config || !config.accessToken) {
          throw new Error('Not authenticated. Run "asana auth login" first.')
        }

        // Verify the workspace exists and is accessible before saving
        const client = getAsanaClient()
        const workspaceDetail = await client.workspaces.findById(gid)

        saveConfig({ ...config, workspace: gid })

        console.log(chalk.green(`✓ Default workspace set to ${workspaceDetail.name} (${gid})`))
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Default workspace update', { 'Workspace GID': gid })
      }
    })

  return workspace
}
