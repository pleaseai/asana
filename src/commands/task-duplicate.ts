import chalk from 'chalk'
import { Command } from 'commander'
import { ERROR_IDS } from '../constants/errorIds'
import { getAsanaClient } from '../lib/asana-client'
import { emitResult } from '../lib/axi-output'
import { handleAsanaError } from '../lib/error-handler'
import { failValidation } from '../lib/fail-validation'
import { UsageError, validateGid, ValidationError } from '../lib/validators'
import { getOutputFormat } from '../utils/formatter'

/** Fields the Asana duplicateTask `include` parameter accepts. */
export const DUPLICATE_INCLUDE_FIELDS = [
  'assignee',
  'attachments',
  'dates',
  'dependencies',
  'followers',
  'notes',
  'parent',
  'projects',
  'subtasks',
  'tags',
] as const

/**
 * Parse and validate the comma-separated `--include` value.
 * @returns the normalized `a,b` list sent to the API
 * @throws UsageError(INVALID_FIELD_NAME) for an empty list or unknown field
 */
function parseIncludeFields(raw: string): string {
  const fields = raw
    .split(',')
    .map(field => field.trim())
    .filter(field => field.length > 0)
  const unknown = fields.filter(field => !(DUPLICATE_INCLUDE_FIELDS as readonly string[]).includes(field))

  if (fields.length > 0 && unknown.length === 0) {
    return fields.join(',')
  }
  const message = fields.length === 0
    ? '--include requires at least one field'
    : `Invalid --include field: ${unknown.join(', ')}`
  console.error(chalk.red(`✗ ${message}`))
  console.error(chalk.gray(`  Allowed: ${DUPLICATE_INCLUDE_FIELDS.join(', ')}`))
  throw new UsageError(ERROR_IDS.INVALID_FIELD_NAME, message, {
    include: raw,
    allowed: [...DUPLICATE_INCLUDE_FIELDS],
  })
}

interface DuplicateJobView {
  gid: string
  status: string
  new_task_gid?: string
  new_task_name?: string
}

function toJobView(job: any): DuplicateJobView {
  const view: DuplicateJobView = { gid: job.gid, status: job.status }
  if (job.new_task) {
    view.new_task_gid = job.new_task.gid
    view.new_task_name = job.new_task.name
  }
  return view
}

export function createTaskDuplicateCommand(): Command {
  return new Command('duplicate')
    .description('Duplicate a task (runs as an asynchronous job)')
    .argument('<gid>', 'Task GID')
    .requiredOption('-n, --name <name>', 'Name of the new task')
    .option('--include <fields>', `Fields to copy, comma-separated (${DUPLICATE_INCLUDE_FIELDS.join('|')})`)
    .action(async (gid: string, options: { name: string, include?: string }, command: Command) => {
      try {
        validateGid(gid, 'Task GID')
        const data: { name: string, include?: string } = { name: options.name }
        if (options.include !== undefined) {
          data.include = parseIncludeFields(options.include)
        }

        const client = getAsanaClient()
        const job = toJobView(await client.tasks.duplicate(gid, data))

        const suffix = job.new_task_gid ? ` (new task ${job.new_task_gid})` : ''
        emitResult({ job }, `✓ Duplicate job ${job.gid} ${job.status}${suffix}`, getOutputFormat(command))
      }
      catch (error) {
        if (error instanceof ValidationError) {
          failValidation(error, command)
        }
        handleAsanaError(error, 'Task duplication', {
          'Task GID': gid,
          'Name': options.name,
        }, getOutputFormat(command))
      }
    })
}
