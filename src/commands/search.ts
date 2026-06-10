import type { SearchOptions } from '../types'
import chalk from 'chalk'
import { Command } from 'commander'
import { getAsanaClient } from '../lib/asana-client'
import { loadConfig } from '../lib/config'
import { handleAsanaError } from '../lib/error-handler'
import { validateGid, ValidationError } from '../lib/validators'
import { formatOutput, getOutputFormat } from '../utils/formatter'

const TASK_SEARCH_FIELDS = 'name,completed,assignee.name,due_on,permalink_url'

/** Asana caps search/typeahead page sizes at 100 items. */
const MAX_SEARCH_LIMIT = 100
const DEFAULT_SEARCH_LIMIT = 20

function resolveWorkspace(optionValue: string | undefined): string {
  const workspace = optionValue || loadConfig()?.workspace
  if (!workspace) {
    throw new Error('Workspace is required. Set default workspace or use -w option.')
  }
  validateGid(workspace, 'Workspace GID')
  return workspace
}

function parseLimit(raw: string | undefined): number {
  const limit = raw === undefined ? DEFAULT_SEARCH_LIMIT : Number(raw)
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_SEARCH_LIMIT) {
    console.error(chalk.red(`✗ --limit must be an integer between 1 and ${MAX_SEARCH_LIMIT}`))
    process.exit(1)
  }
  return limit
}

/**
 * `asana search <tasks|projects> <query>` — full-text search in a workspace.
 *
 * Task search uses the Asana advanced search API (premium workspaces only).
 * Search results are not stable and cannot be offset-paginated; use
 * `--limit` (max 100) to control page size.
 */
export function createSearchCommand(): Command {
  const search = new Command('search')
    .description('Search tasks and projects in a workspace')

  search
    .command('tasks')
    .description('Full-text search on task names and descriptions (premium workspaces)')
    .argument('<query>', 'Search text')
    .option('-w, --workspace <workspace>', 'Workspace GID (defaults to configured workspace)')
    .option('-l, --limit <limit>', `Results per page, 1-${MAX_SEARCH_LIMIT}`, String(DEFAULT_SEARCH_LIMIT))
    .option('-c, --completed <completed>', 'Filter by completion status (true/false)')
    .option('-a, --assignee <assignee>', 'Filter by assignee user GIDs (comma-separated)')
    .action(async (query: string, options: SearchOptions, command: Command) => {
      let workspace: string | undefined
      try {
        workspace = resolveWorkspace(options.workspace)
        const limit = parseLimit(options.limit)

        const searchOpts: Record<string, any> = {
          text: query,
          limit,
          opt_fields: TASK_SEARCH_FIELDS,
        }
        if (options.completed !== undefined) {
          searchOpts.completed = options.completed === 'true' || options.completed === true
        }
        if (options.assignee) {
          searchOpts['assignee.any'] = options.assignee
        }

        const client = getAsanaClient()
        const response = await client.tasks.search(workspace, searchOpts)
        const tasks = (response.data || []).map((task: any) => ({
          gid: task.gid,
          name: task.name,
          completed: task.completed ?? false,
          assignee: task.assignee?.name ?? '',
          due_on: task.due_on ?? '',
          url: task.permalink_url ?? '',
        }))

        if (tasks.length === 0) {
          console.log(chalk.yellow('No tasks found'))
          return
        }

        const format = getOutputFormat(command)
        console.log(formatOutput({ tasks }, { format, colors: process.stdout.isTTY }))
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Task search', {
          'Query': query,
          'Workspace GID': workspace,
        })
      }
    })

  search
    .command('projects')
    .description('Search projects by name (typeahead)')
    .argument('<query>', 'Search text')
    .option('-w, --workspace <workspace>', 'Workspace GID (defaults to configured workspace)')
    .option('-l, --limit <limit>', `Results per page, 1-${MAX_SEARCH_LIMIT}`, String(DEFAULT_SEARCH_LIMIT))
    .action(async (query: string, options: SearchOptions, command: Command) => {
      let workspace: string | undefined
      try {
        workspace = resolveWorkspace(options.workspace)
        const limit = parseLimit(options.limit)

        const client = getAsanaClient()
        const response = await client.typeahead.search(workspace, 'project', query, {
          count: limit,
          opt_fields: 'name',
        })
        const projects = (response.data || []).map((project: any) => ({
          gid: project.gid,
          name: project.name,
        }))

        if (projects.length === 0) {
          console.log(chalk.yellow('No projects found'))
          return
        }

        const format = getOutputFormat(command)
        console.log(formatOutput({ projects }, { format, colors: process.stdout.isTTY }))
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Project search', {
          'Query': query,
          'Workspace GID': workspace,
        })
      }
    })

  return search
}
