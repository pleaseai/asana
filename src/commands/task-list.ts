import type { TaskListQuery, TaskSource } from '../lib/task-list-query'
import type { TaskListOptions } from '../types'
import chalk from 'chalk'
import { Command } from 'commander'
import { ERROR_IDS } from '../constants/errorIds'
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
  resolveTaskSource,
  summarizeTasks,
  toTaskRows,
} from '../lib/task-list-query'
import { UsageError, ValidationError } from '../lib/validators'
import { formatOutput, getOutputFormat } from '../utils/formatter'

type AsanaClient = ReturnType<typeof getAsanaClient>

/**
 * Fetch the tasks of a container source (project, section, tag, My Tasks).
 * The tag endpoint has no `completed_since` filter, so it is dropped there and
 * incomplete-only relies on the client-side completion filter.
 */
async function fetchContainerPage(
  client: AsanaClient,
  source: Exclude<TaskSource, { kind: 'default' }>,
  workspace: string | undefined,
  params: Record<string, any>,
): Promise<any[]> {
  switch (source.kind) {
    case 'project':
      return (await client.tasks.findByProject(source.gid, params)).data || []
    case 'section':
      return (await client.tasks.findBySection(source.gid, params)).data || []
    case 'tag': {
      const { completed_since: _unsupported, ...tagParams } = params
      return (await client.tasks.findByTag(source.gid, tagParams)).data || []
    }
    case 'myTasks': {
      const userTaskList = await client.userTaskLists.findByUser('me', workspace!)
      return (await client.tasks.findByUserTaskList(userTaskList.gid, params)).data || []
    }
  }
}

/**
 * Fetch one listing page for `task list`. Assignee filtering happens
 * server-side only in workspace mode with a concrete assignee; container
 * listings and `--assignee none` filter client-side (clientAssignee=true).
 */
async function fetchTaskPage(
  client: AsanaClient,
  source: TaskSource,
  options: TaskListOptions,
  workspace: string | undefined,
  params: Record<string, any>,
  clientAssignee: boolean,
): Promise<any[]> {
  if (source.kind !== 'default') {
    return fetchContainerPage(client, source, workspace, params)
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

/** `--my-tasks` needs a workspace to locate the user task list. */
function requireMyTasksWorkspace(workspace: string | undefined): void {
  if (workspace) {
    return
  }
  console.error(chalk.red('✗ --my-tasks requires a workspace'))
  console.error(chalk.gray('  Use --workspace <gid> or set a default workspace'))
  throw new UsageError(
    ERROR_IDS.MISSING_REQUIRED_OPTION,
    '--my-tasks requires a workspace (use --workspace or set a default workspace)',
    { option: '--workspace' },
  )
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
  const source = resolveTaskSource(options)
  const config = loadConfig()
  const workspace = options.workspace || config?.workspace
  workspaceRef.value = workspace
  if (source.kind === 'myTasks') {
    requireMyTasksWorkspace(workspace)
  }
  const client = getAsanaClient()

  const clientAssignee = needsClientAssigneeFilter(query, source.kind !== 'default')
  const params = buildListParams(query, options, clientAssignee)

  const fetched = await fetchTaskPage(client, source, options, workspace, params, clientAssignee)
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
    .option('--section <section>', 'Section GID (exclusive with --project, --tag, --my-tasks)')
    .option('--tag <tag>', 'Tag GID (exclusive with --project, --section, --my-tasks)')
    .option('--my-tasks', 'List My Tasks of the workspace (exclusive with --project, --section, --tag)')
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
          'Workspace': workspaceRef.value,
          'Project': options.project,
          'Section': options.section,
          'Tag': options.tag,
          'My Tasks': options.myTasks || undefined,
          'Assignee': options.assignee,
        }, getOutputFormat(command))
      }
    })
}
