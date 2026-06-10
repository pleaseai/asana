import type { UserSearchOptions, UserTasksOptions } from '../types'
import chalk from 'chalk'
import { Command } from 'commander'
import { getAsanaClient } from '../lib/asana-client'
import { loadConfig } from '../lib/config'
import { handleAsanaError } from '../lib/error-handler'
import { validateGid, ValidationError } from '../lib/validators'
import { formatOutput, getOutputFormat } from '../utils/formatter'
import { searchUsers } from '../utils/fuzzy'

const USER_DETAIL_FIELDS = { opt_fields: 'name,email,workspaces.name' }
const USER_LIST_FIELDS = { opt_fields: 'name,email' }
const TASK_FIELDS = { opt_fields: 'name,completed,due_on' }

/**
 * Asana accepts a GID, an email address, or the literal "me" as user identifier
 */
function validateUserIdentifier(identifier: string): void {
  if (identifier === 'me' || identifier.includes('@')) {
    return
  }
  validateGid(identifier, 'User GID')
}

function toUserData(user: any) {
  return {
    gid: user.gid,
    name: user.name,
    email: user.email,
    workspaces: (user.workspaces || []).map((ws: any) => ws.name),
  }
}

export function createUserCommand(): Command {
  const user = new Command('user')
    .description('Manage Asana users')

  user
    .command('me')
    .description('Display the current authenticated user')
    .action(async (options: any, command: Command) => {
      try {
        const client = getAsanaClient()
        const me = await client.users.findById('me', USER_DETAIL_FIELDS)

        const format = getOutputFormat(command)
        const output = formatOutput({ user: toUserData(me) }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        handleAsanaError(error, 'User retrieval', { User: 'me' })
      }
    })

  user
    .command('get')
    .description('Get user details (GID, email, or "me")')
    .argument('<user>', 'User GID, email address, or "me"')
    .action(async (identifier: string, options: any, command: Command) => {
      try {
        validateUserIdentifier(identifier)

        const client = getAsanaClient()
        const userDetail = await client.users.findById(identifier, USER_DETAIL_FIELDS)

        const format = getOutputFormat(command)
        const output = formatOutput({ user: toUserData(userDetail) }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'User retrieval', { User: identifier })
      }
    })

  user
    .command('search')
    .description('Search workspace users by name or email (fuzzy)')
    .argument('<query>', 'Name or email to search for')
    .option('-w, --workspace <workspace>', 'Workspace GID (defaults to configured workspace)')
    .action(async (query: string, options: UserSearchOptions, command: Command) => {
      const workspace = options.workspace || loadConfig()?.workspace
      try {
        if (!workspace) {
          throw new Error('Workspace is required. Set default workspace or use -w option.')
        }

        const client = getAsanaClient()
        const response = await client.users.findByWorkspace(workspace, USER_LIST_FIELDS)
        const matches = searchUsers(response.data || [], query)

        if (matches.length === 0) {
          console.log(chalk.yellow(`No users matching "${query}"`))
          return
        }

        const format = getOutputFormat(command)
        const output = formatOutput({ users: matches }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        handleAsanaError(error, 'User search', { Query: query, Workspace: workspace })
      }
    })

  user
    .command('tasks')
    .description('List tasks assigned to a user')
    .argument('<user>', 'User GID, email address, or "me"')
    .option('-w, --workspace <workspace>', 'Workspace GID (defaults to configured workspace)')
    .option('-c, --completed', 'Include completed tasks')
    .action(async (identifier: string, options: UserTasksOptions, command: Command) => {
      const workspace = options.workspace || loadConfig()?.workspace
      try {
        validateUserIdentifier(identifier)
        if (!workspace) {
          throw new Error('Workspace is required. Set default workspace or use -w option.')
        }

        const client = getAsanaClient()
        const response = await client.tasks.findAll({
          assignee: identifier,
          workspace,
          completed_since: options.completed ? undefined : 'now',
          ...TASK_FIELDS,
        })
        const tasks = response.data || []

        if (tasks.length === 0) {
          console.log(chalk.yellow('No tasks found'))
          return
        }

        const format = getOutputFormat(command)
        const output = formatOutput({ tasks }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'User task listing', { User: identifier, Workspace: workspace })
      }
    })

  return user
}
