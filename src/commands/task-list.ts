import type { TaskListQuery } from '../lib/task-list-query'
import type { TaskListOptions } from '../types'
import chalk from 'chalk'
import { Command } from 'commander'
import { getAsanaClient } from '../lib/asana-client'
import { loadConfig } from '../lib/config'
import { handleAsanaError } from '../lib/error-handler'
import { failValidation } from '../lib/fail-validation'
import {
  applyAssigneeFilter,
  applyCompletionFilter,
  buildOptFields,
  effectiveColumns,
  GROUP_BY_FIELDS,
  needsClientAssigneeFilter,
  parseTaskListQuery,
  summarizeTasks,
  toTaskRows,
} from '../lib/task-list-query'
import { ValidationError } from '../lib/validators'
import { formatOutput, getOutputFormat } from '../utils/formatter'

type AsanaClient = ReturnType<typeof getAsanaClient>

/**
 * Fetch one listing page for `task list`. Assignee filtering happens
 * server-side only in workspace mode with a concrete assignee; project
 * listings and `--assignee none` filter client-side (clientAssignee=true).
 */
async function fetchTaskPage(
  client: AsanaClient,
  options: TaskListOptions,
  workspace: string | undefined,
  params: Record<string, any>,
  clientAssignee: boolean,
): Promise<any[]> {
  if (options.project) {
    const result = await client.tasks.findByProject(options.project, params)
    return result.data || []
  }
  if (options.assignee && !clientAssignee) {
    const result = await client.tasks.findAll({ ...params, assignee: options.assignee, workspace })
    return result.data || []
  }
  if (workspace) {
    const result = await client.tasks.findAll({ ...params, workspace })
    return result.data || []
  }
  throw new Error('Specify workspace, project, or assignee to list tasks')
}

/** Request params shared by every listing endpoint. */
function buildListParams(
  query: TaskListQuery,
  options: TaskListOptions,
  clientAssignee: boolean,
): Record<string, any> {
  const params: Record<string, any> = {}
  const optFields = buildOptFields(query, clientAssignee)
  if (optFields) {
    params.opt_fields = optFields
  }
  // completed_since=now is the API's incomplete-only filter; the
  // deprecated -c/--completed flag historically mapped to it too.
  if (query.incompleteOnly || options.completed) {
    params.completed_since = 'now'
  }
  return params
}

/** Apply the client-side assignee and completion filters. */
async function filterTasks(
  client: AsanaClient,
  taskList: any[],
  query: TaskListQuery,
  clientAssignee: boolean,
): Promise<any[]> {
  let filtered = taskList
  if (clientAssignee && query.assignee) {
    const assignee = query.assignee === 'me' ? (await client.users.me()).gid : query.assignee
    filtered = applyAssigneeFilter(filtered, assignee)
  }
  return applyCompletionFilter(filtered, query)
}

async function runTaskList(
  options: TaskListOptions,
  command: Command,
  workspaceRef: { value?: string },
): Promise<void> {
  const query = parseTaskListQuery(options)
  const client = getAsanaClient()
  const config = loadConfig()
  const workspace = options.workspace || config?.workspace
  workspaceRef.value = workspace

  const clientAssignee = needsClientAssigneeFilter(query, !!options.project)
  const params = buildListParams(query, options, clientAssignee)

  const fetched = await fetchTaskPage(client, options, workspace, params, clientAssignee)
  const taskList = await filterTasks(client, fetched, query, clientAssignee)

  // Resolve --format from the global options. Use getOutputFormat
  // (optsWithGlobals) rather than walking the parent chain by hand — the
  // global option lives on the root command, and the hand-walked lookup
  // here previously stopped one level short and silently ignored --format.
  const format = getOutputFormat(command)

  if (query.count || query.groupBy) {
    const summary = summarizeTasks(taskList, query.groupBy)
    console.log(formatOutput({ summary }, { format, colors: process.stdout.isTTY }))
    return
  }

  if (taskList.length === 0) {
    console.log(chalk.yellow('No tasks found'))
    return
  }

  const columns = effectiveColumns(query, clientAssignee)
  const tasks = columns.length > 0 ? toTaskRows(taskList, columns) : taskList
  console.log(formatOutput({ tasks }, { format, colors: process.stdout.isTTY }))
}

export function createTaskListCommand(): Command {
  return new Command('list')
    .description('List tasks')
    .option('-a, --assignee <assignee>', 'Filter by assignee ("me", "none" for unassigned, or user GID)')
    .option('-w, --workspace <workspace>', 'Workspace GID')
    .option('-p, --project <project>', 'Project GID')
    .option('-c, --completed', 'Deprecated: excludes completed tasks (use --incomplete-only)')
    .option('--fields <fields>', 'Extra fields per task, comma-separated (e.g. completed,assignee,due_on)')
    .option('--completed-only', 'Only list completed tasks')
    .option('--incomplete-only', 'Only list incomplete tasks')
    .option('--count', 'Output only the task count')
    .option('--group-by <field>', `Output counts grouped by field (${GROUP_BY_FIELDS.join('|')})`)
    .action(async (options: TaskListOptions, command: Command) => {
      // Held outside try so the error handler can report it
      const workspaceRef: { value?: string } = {}
      try {
        await runTaskList(options, command, workspaceRef)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          failValidation(error, command)
        }
        handleAsanaError(error, 'Task listing', {
          Workspace: workspaceRef.value,
          Project: options.project,
          Assignee: options.assignee,
        }, getOutputFormat(command))
      }
    })
}
