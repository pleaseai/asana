import type { TeamListOptions } from '../types'
import chalk from 'chalk'
import { Command } from 'commander'
import { getAsanaClient } from '../lib/asana-client'
import { getDefaultCache } from '../lib/cache'
import { loadConfig } from '../lib/config'
import { handleAsanaError } from '../lib/error-handler'
import { validateGid, ValidationError } from '../lib/validators'
import { formatOutput, getOutputFormat } from '../utils/formatter'

const TEAM_LIST_FIELDS = { opt_fields: 'name,description' }
const MEMBER_FIELDS = { opt_fields: 'name,email' }

export function createTeamCommand(): Command {
  const team = new Command('team')
    .description('Manage Asana teams')

  team
    .command('list')
    .description('List teams in a workspace')
    .option('-w, --workspace <workspace>', 'Workspace GID (defaults to configured workspace)')
    .option('--no-cache', 'Bypass cached team list and fetch fresh data')
    .action(async (options: TeamListOptions, command: Command) => {
      const workspace = options.workspace || loadConfig()?.workspace
      try {
        if (!workspace) {
          throw new Error('Workspace is required. Set default workspace or use -w option.')
        }

        const cache = getDefaultCache()
        const cacheKey = `teams:${workspace}`
        const cached = options.cache === false ? null : cache.get<any[]>(cacheKey)
        let teams: any[]

        if (cached) {
          teams = cached
        }
        else {
          const client = getAsanaClient()
          const response = await client.teams.findByWorkspace(workspace, TEAM_LIST_FIELDS)
          teams = response.data || []
          cache.set(cacheKey, teams)
        }

        if (teams.length === 0) {
          console.log(chalk.yellow('No teams found'))
          return
        }

        const format = getOutputFormat(command)
        const output = formatOutput({ teams }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        handleAsanaError(error, 'Team listing', { Workspace: workspace })
      }
    })

  team
    .command('get')
    .description('Get team details')
    .argument('<gid>', 'Team GID')
    .action(async (gid: string, options: any, command: Command) => {
      try {
        validateGid(gid, 'Team GID')

        const client = getAsanaClient()
        const teamDetail = await client.teams.findById(gid, {
          opt_fields: 'name,description,organization.name,permalink_url,visibility',
        })

        const teamData = {
          gid: teamDetail.gid,
          name: teamDetail.name,
          description: teamDetail.description,
          organization: teamDetail.organization?.name,
          visibility: teamDetail.visibility,
          permalink_url: teamDetail.permalink_url,
        }

        const format = getOutputFormat(command)
        const output = formatOutput({ team: teamData }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Team retrieval', { 'Team GID': gid })
      }
    })

  team
    .command('members')
    .description('List members of a team')
    .argument('<gid>', 'Team GID')
    .action(async (gid: string, options: any, command: Command) => {
      try {
        validateGid(gid, 'Team GID')

        const client = getAsanaClient()
        const response = await client.users.findByTeam(gid, MEMBER_FIELDS)
        const members = response.data || []

        if (members.length === 0) {
          console.log(chalk.yellow('No members found'))
          return
        }

        const format = getOutputFormat(command)
        const output = formatOutput({ members }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Team member listing', { 'Team GID': gid })
      }
    })

  return team
}
