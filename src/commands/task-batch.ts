import type { BatchResult } from '../lib/batch'
import type { BatchCreateOptions, BatchFileOptions } from '../types'
import { resolve } from 'node:path'
import chalk from 'chalk'
import { Command } from 'commander'
import { getAsanaClient } from '../lib/asana-client'
import { parseCsvRecords, parseGidLines, parseJsonRecords, runBatch } from '../lib/batch'
import { loadConfig } from '../lib/config'
import { handleAsanaError } from '../lib/error-handler'
import { validateFileExists, ValidationError } from '../lib/validators'
import { formatOutput, getOutputFormat } from '../utils/formatter'

/**
 * Map a parsed batch record onto the Asana task fields accepted by the
 * create/update endpoints. Unknown keys are passed through untouched so
 * power users can set any API field (e.g. `html_notes`).
 */
function toTaskData(record: Record<string, any>): Record<string, any> {
  const { gid, due_on, completed, ...rest } = record
  const data: Record<string, any> = { ...rest }
  if (due_on !== undefined) {
    data.due_on = due_on
  }
  if (completed !== undefined) {
    // CSV values arrive as strings; the API expects a boolean
    data.completed = completed === true || completed === 'true'
  }
  return data
}

function printBatchSummary(result: BatchResult, command: Command): void {
  const summary = {
    total: result.total,
    succeeded: result.succeeded,
    failed: result.failed,
    failures: result.failures,
  }
  const output = formatOutput({ batch: summary }, {
    format: getOutputFormat(command),
    colors: process.stdout.isTTY,
  })
  console.log(output)
}

async function readBatchFile(file: string): Promise<{ path: string, content: string }> {
  const path = resolve(file)
  validateFileExists(path, 'Batch file')
  const content = await Bun.file(path).text()
  return { path, content }
}

export function createBatchUpdateCommand(): Command {
  return new Command('batch-update')
    .description('Update multiple tasks from a JSON file (each entry needs a "gid")')
    .requiredOption('--file <path>', 'JSON file: array of {gid, ...fields} or {"tasks": [...]}')
    .action(async (options: BatchFileOptions, command: Command) => {
      try {
        const { content } = await readBatchFile(options.file)
        const records = parseJsonRecords(content)

        const missingGid = records.filter(record => !/^\d+$/.test(String(record.gid ?? '')))
        if (missingGid.length > 0) {
          console.error(chalk.red(`✗ ${missingGid.length} record(s) are missing a valid "gid"`))
          process.exit(1)
        }

        const client = getAsanaClient()
        const result = await runBatch(
          records,
          record => client.tasks.update(String(record.gid), toTaskData(record)),
          { describe: record => String(record.gid) },
        )
        printBatchSummary(result, command)
        process.exitCode = result.failed > 0 ? 1 : 0
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Batch update', { File: options.file })
      }
    })
}

export function createBatchCreateCommand(): Command {
  return new Command('batch-create')
    .description('Create multiple tasks from a JSON or CSV file')
    .requiredOption('--file <path>', 'JSON array or CSV (with header row) of tasks to create')
    .option('-w, --workspace <workspace>', 'Workspace GID (defaults to configured workspace)')
    .action(async (options: BatchCreateOptions, command: Command) => {
      try {
        const { path, content } = await readBatchFile(options.file)
        const records = path.toLowerCase().endsWith('.csv')
          ? parseCsvRecords(content)
          : parseJsonRecords(content)

        const config = loadConfig()
        const workspace = options.workspace || config?.workspace
        if (!workspace) {
          throw new Error('Workspace is required. Set default workspace or use -w option.')
        }

        const missingName = records.filter(record => !record.name)
        if (missingName.length > 0) {
          console.error(chalk.red(`✗ ${missingName.length} record(s) are missing a "name"`))
          process.exit(1)
        }

        const client = getAsanaClient()
        const result = await runBatch(
          records,
          (record) => {
            const { project, ...fields } = record
            const taskData: Record<string, any> = { workspace, ...toTaskData(fields) }
            if (project) {
              taskData.projects = [project]
            }
            return client.tasks.create(taskData)
          },
          { describe: record => String(record.name) },
        )
        printBatchSummary(result, command)
        process.exitCode = result.failed > 0 ? 1 : 0
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Batch create', { File: options.file })
      }
    })
}

export function createBatchDeleteCommand(): Command {
  return new Command('batch-delete')
    .description('Delete multiple tasks listed in a text file (one GID per line)')
    .requiredOption('--file <path>', 'Text file with one task GID per line (# for comments)')
    .option('--yes', 'Skip the confirmation prompt')
    .action(async (options: BatchFileOptions & { yes?: boolean }, command: Command) => {
      try {
        const { content } = await readBatchFile(options.file)
        const gids = parseGidLines(content)

        if (gids.length === 0) {
          console.log(chalk.yellow('No task GIDs found in file'))
          return
        }

        if (!options.yes) {
          // Bun provides a Web-style confirm() prompt on stdin for CLIs
          // eslint-disable-next-line no-alert
          const confirmed = confirm(`Delete ${gids.length} task(s)? This cannot be undone.`)
          if (!confirmed) {
            console.log(chalk.yellow('Aborted'))
            return
          }
        }

        const client = getAsanaClient()
        const result = await runBatch(
          gids,
          gid => client.tasks.delete(gid),
          { describe: gid => gid },
        )
        printBatchSummary(result, command)
        process.exitCode = result.failed > 0 ? 1 : 0
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Batch delete', { File: options.file })
      }
    })
}
