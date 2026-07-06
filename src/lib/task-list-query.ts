/**
 * Query helpers for the scan-style `task list` options: `--fields`, the
 * completion filters, `--assignee none`, `--count`, and `--group-by`.
 *
 * Without field expansion, any "count/filter tasks by X" question forces one
 * `task get` per task (issue #88). These helpers let a single listing call
 * carry the fields needed to filter and aggregate client-side.
 *
 * All functions here are pure; the command layer owns the API calls.
 */

import type { TaskListOptions } from '../types'
import chalk from 'chalk'
import { ERROR_IDS } from '../constants/errorIds'
import { ValidationError } from './validators'

export const GROUP_BY_FIELDS = ['assignee', 'completed'] as const
export type GroupByField = (typeof GROUP_BY_FIELDS)[number]

export interface TaskListQuery {
  fields: string[]
  completedOnly: boolean
  incompleteOnly: boolean
  assignee?: string
  count: boolean
  groupBy?: GroupByField
}

// Asana opt_fields tokens: dot-separated identifier segments (e.g. "due_on",
// "assignee.name"). Anything else is rejected before it reaches the API.
const FIELD_NAME_PATTERN = /^\w+(?:\.\w+)*$/

/**
 * Validate and normalize the scan-related list options.
 * @throws ValidationError on conflicting or malformed options
 */
export function parseTaskListQuery(options: TaskListOptions): TaskListQuery {
  if (options.completedOnly && (options.incompleteOnly || options.completed)) {
    console.error(chalk.red('✗ --completed-only cannot be combined with --incomplete-only or --completed'))
    throw new ValidationError(
      ERROR_IDS.CONFLICTING_OPTIONS,
      '--completed-only conflicts with --incomplete-only/--completed',
      { completedOnly: true, incompleteOnly: !!options.incompleteOnly, completed: !!options.completed },
    )
  }

  const fields = (options.fields ?? '')
    .split(',')
    .map(field => field.trim())
    .filter(field => field.length > 0)

  if (options.fields !== undefined && fields.length === 0) {
    console.error(chalk.red('✗ --fields requires at least one field name'))
    throw new ValidationError(ERROR_IDS.INVALID_FIELD_NAME, '--fields requires at least one field name', {
      fields: options.fields,
    })
  }
  for (const field of fields) {
    if (!FIELD_NAME_PATTERN.test(field)) {
      console.error(chalk.red(`✗ Invalid field name: ${field}`))
      console.error(chalk.gray('  Expected identifiers like "completed", "due_on", "assignee"'))
      throw new ValidationError(ERROR_IDS.INVALID_FIELD_NAME, `Invalid field name: ${field}`, { field })
    }
  }

  let groupBy: GroupByField | undefined
  if (options.groupBy !== undefined) {
    if (!GROUP_BY_FIELDS.includes(options.groupBy as GroupByField)) {
      console.error(chalk.red(`✗ Invalid --group-by field: ${options.groupBy}`))
      console.error(chalk.gray(`  Supported: ${GROUP_BY_FIELDS.join(', ')}`))
      throw new ValidationError(ERROR_IDS.INVALID_GROUP_BY, `Invalid --group-by field: ${options.groupBy}`, {
        groupBy: options.groupBy,
        supported: [...GROUP_BY_FIELDS],
      })
    }
    groupBy = options.groupBy as GroupByField
  }

  return {
    fields,
    completedOnly: !!options.completedOnly,
    incompleteOnly: !!options.incompleteOnly,
    assignee: options.assignee,
    count: !!options.count,
    groupBy,
  }
}

/**
 * Whether the assignee filter must run client-side: project listings have no
 * server-side assignee param, and "none" (unassigned) has no server equivalent.
 */
export function needsClientAssigneeFilter(query: TaskListQuery, hasProject: boolean): boolean {
  if (!query.assignee) {
    return false
  }
  return hasProject || query.assignee === 'none'
}

function isQueryMode(query: TaskListQuery, clientAssignee: boolean): boolean {
  return query.fields.length > 0
    || query.completedOnly
    || query.incompleteOnly
    || query.count
    || !!query.groupBy
    || clientAssignee
}

/**
 * Build the `opt_fields` value covering the requested output fields plus the
 * fields the client-side filters/aggregation need. Returns undefined when no
 * scan option is active so the legacy compact listing stays unchanged.
 */
export function buildOptFields(query: TaskListQuery, clientAssignee: boolean): string | undefined {
  if (!isQueryMode(query, clientAssignee)) {
    return undefined
  }
  const optFields = new Set<string>(['name'])
  for (const field of query.fields) {
    optFields.add(field === 'assignee' ? 'assignee.name' : field)
  }
  if (query.completedOnly || query.incompleteOnly || query.groupBy === 'completed') {
    optFields.add('completed')
  }
  if (clientAssignee || query.groupBy === 'assignee' || query.fields.includes('assignee')) {
    optFields.add('assignee.name')
    optFields.add('assignee.gid')
  }
  return [...optFields].join(',')
}

export function applyCompletionFilter(tasks: any[], query: TaskListQuery): any[] {
  if (query.completedOnly) {
    return tasks.filter(task => task.completed === true)
  }
  if (query.incompleteOnly) {
    return tasks.filter(task => !task.completed)
  }
  return tasks
}

/**
 * @param tasks tasks fetched with `assignee.gid` in opt_fields
 * @param assignee `"none"` for unassigned tasks, otherwise a user GID
 * ("me" must be resolved to a GID by the caller first)
 */
export function applyAssigneeFilter(tasks: any[], assignee: string): any[] {
  if (assignee === 'none') {
    return tasks.filter(task => !task.assignee)
  }
  return tasks.filter(task => task.assignee?.gid === assignee)
}

/**
 * Columns to print besides gid/name: the requested fields, or the fields the
 * active filters implied. Empty means "keep the raw listing".
 */
export function effectiveColumns(query: TaskListQuery, clientAssignee: boolean): string[] {
  if (query.fields.length > 0) {
    return query.fields
  }
  const columns: string[] = []
  if (query.completedOnly || query.incompleteOnly) {
    columns.push('completed')
  }
  if (clientAssignee) {
    columns.push('assignee')
  }
  return columns
}

/**
 * Flatten tasks into uniform rows (gid, name + columns). Assignee objects are
 * flattened to a display name; missing values become null so tabular formats
 * keep their columns aligned.
 */
export function toTaskRows(tasks: any[], columns: string[]): Array<Record<string, any>> {
  return tasks.map((task) => {
    const row: Record<string, any> = { gid: task.gid, name: task.name }
    for (const column of columns) {
      if (column === 'gid' || column === 'name') {
        continue
      }
      row[column] = column === 'assignee'
        ? (task.assignee?.name ?? task.assignee?.gid ?? null)
        : (task[column] ?? null)
    }
    return row
  })
}

export interface TaskListSummary {
  total: number
  groups?: Array<Record<string, any>>
}

/**
 * Precomputed aggregate for `--count` / `--group-by` (AXI principle 4):
 * totals instead of rows, so a scan question costs one round-trip.
 */
export function summarizeTasks(tasks: any[], groupBy?: GroupByField): TaskListSummary {
  if (!groupBy) {
    return { total: tasks.length }
  }
  const counts = new Map<string, number>()
  for (const task of tasks) {
    const key = groupBy === 'completed'
      ? (task.completed ? 'completed' : 'incomplete')
      : (task.assignee?.name ?? task.assignee?.gid ?? 'unassigned')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const groups = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => ({ [groupBy]: key, count }))
  return { total: tasks.length, groups }
}
