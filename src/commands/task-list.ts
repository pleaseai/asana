import type { TaskListQuery, TaskSource } from '../lib/task-list-query'
import type { TaskListOptions } from '../types'
import type { OutputFormat } from '../utils/formatter'
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
import { resolveExplicitWorkspace } from '../lib/workspace-option'
import { formatOutput, getOutputFormat } from '../utils/formatter'

/** Upper bound on pages followed per listing, a backstop against a misbehaving server. */
const MAX_PAGES = 1000

/**
 * Collect every page of an offset-paginated listing. The SDK resolves list
 * calls to a `Collection` (`.data` plus `._response.next_page`); the raw
 * `{ data, next_page }` body is accepted too. Stops when there is no next
 * page or the server repeats an offset.
 * @throws Error when more pages remain after MAX_PAGES, so a truncated
 * listing never reaches the output or the --count/--group-by summary
 */
async function fetchAllPages(
  fetchPage: (params: Record<string, any>) => Promise<any>,
  params: Record<string, any>,
): Promise<any[]> {
  const tasks: any[] = []
  const seenOffsets = new Set<string>()
  let pageParams = params
  for (let page = 1; ; page++) {
    const result = await fetchPage(pageParams)
    tasks.push(...(result.data || []))
    const offset = (result._response?.next_page ?? result.next_page)?.offset
    if (!offset || seenOffsets.has(offset)) {
      return tasks
    }
    if (page >= MAX_PAGES) {
      throw new Error(`Listing exceeds the page limit (${MAX_PAGES} pages); results would be incomplete`)
    }
    seenOffsets.add(offset)
    pageParams = { ...params, offset }
  }
}

/**
 * Fetch the tasks of a container source (project, section, tag, My Tasks).
 * Section, tag, and My Tasks follow every page; project keeps its single
 * request. The tag endpoint has no `completed_since` filter, so it is dropped
 * there and incomplete-only relies on the client-side completion filter.
 */
async function fetchContainerPage(
  source: Exclude<TaskSource, { kind: 'default' }>,
  workspace: string | undefined,
  params: Record<string, any>,
): Promise<any[]> {
  const client = getAsanaClient()
  switch (source.kind) {
    case 'project':
      return (await client.tasks.findByProject(source.gid, params)).data || []
    case 'section':
      return fetchAllPages(p => client.tasks.findBySection(source.gid, p), params)
    case 'tag': {
      const { completed_since: _unsupported, ...tagParams } = params
      return fetchAllPages(p => client.tasks.findByTag(source.gid, p), tagParams)
    }
    case 'myTasks': {
      const userTaskList = await client.userTaskLists.findByUser('me', workspace!)
      return fetchAllPages(p => client.tasks.findByUserTaskList(userTaskList.gid, p), params)
    }
    default: {
      const unhandled: never = source
      throw new Error(`Unhandled task source: ${JSON.stringify(unhandled)}`)
    }
  }
}

/**
 * Fetch one listing page for `task list`. Assignee filtering happens
 * server-side only in workspace mode with a concrete assignee; container
 * listings and `--assignee none` filter client-side (clientAssignee=true).
 */
async function fetchTaskPage(
  source: TaskSource,
  options: TaskListOptions,
  workspace: string | undefined,
  params: Record<string, any>,
  clientAssignee: boolean,
): Promise<any[]> {
  if (source.kind !== 'default') {
    return fetchContainerPage(source, workspace, params)
  }
  const client = getAsanaClient()
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

/** Reject `flag` as a usage error when no workspace was resolved. */
function requireWorkspace(flag: string, workspace: string | undefined): void {
  if (workspace) {
    return
  }
  console.error(chalk.red(`✗ ${flag} requires a workspace`))
  console.error(chalk.gray('  Use --workspace <gid> or set a default workspace'))
  throw new UsageError(
    ERROR_IDS.MISSING_REQUIRED_OPTION,
    `${flag} requires a workspace (use --workspace or set a default workspace)`,
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
  taskList: any[],
  query: TaskListQuery,
  clientAssignee: boolean,
): Promise<any[]> {
  let filtered = taskList
  if (clientAssignee && query.assignee) {
    const assignee = query.assignee === 'me' ? (await getAsanaClient().users.me()).gid : query.assignee
    filtered = applyAssigneeFilter(filtered, assignee)
  }
  return applyCompletionFilter(filtered, query)
}

async function runTaskList(
  options: TaskListOptions,
  command: Command,
  workspaceRef: { value?: string },
): Promise<void> {
  const source = resolveTaskSource(options)
  // The tag endpoint ignores completed_since, so the deprecated -c flag must
  // fall back to the client-side incomplete-only filter there.
  const query = parseTaskListQuery(
    source.kind === 'tag' && options.completed ? { ...options, incompleteOnly: true } : options,
  )
  const workspace = resolveExplicitWorkspace(options.workspace, loadConfig()?.workspace)
  workspaceRef.value = workspace
  // --my-tasks needs a workspace to locate the user task list.
  if (source.kind === 'myTasks') {
    requireWorkspace('--my-tasks', workspace)
  }

  const clientAssignee = needsClientAssigneeFilter(query, source.kind !== 'default')
  const params = buildListParams(query, options, clientAssignee)

  const fetched = await fetchTaskPage(source, options, workspace, params, clientAssignee)
  const taskList = await filterTasks(fetched, query, clientAssignee)

  // Resolve --format from the global options. Use getOutputFormat
  // (optsWithGlobals) rather than walking the parent chain by hand — the
  // global option lives on the root command, and the hand-walked lookup
  // here previously stopped one level short and silently ignored --format.
  printTaskList(taskList, query, getOutputFormat(command), clientAssignee)
}

/** Print the summary, the definitive empty state, or the task rows. */
function printTaskList(
  taskList: any[],
  query: TaskListQuery,
  format: OutputFormat,
  clientAssignee: boolean,
): void {
  if (query.count || query.groupBy) {
    const summary = summarizeTasks(taskList, query.groupBy)
    console.log(formatOutput({ summary }, { format, colors: process.stdout.isTTY }))
    return
  }

  if (taskList.length === 0) {
    // Machine formats get a definitive empty list (AXI §5); plain keeps the message.
    console.log(format === 'plain'
      ? chalk.yellow('No tasks found')
      : formatOutput({ tasks: [] }, { format, colors: process.stdout.isTTY }))
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
