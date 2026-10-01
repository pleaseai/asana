import type { ErrorId } from '../constants/errorIds'
import chalk from 'chalk'
import { Command } from 'commander'
import { ERROR_IDS } from '../constants/errorIds'
import { getAsanaClient } from '../lib/asana-client'
import { toTaskView } from '../lib/asana-views'
import { loadConfig } from '../lib/config'
import { handleAsanaError } from '../lib/error-handler'
import { failValidation } from '../lib/fail-validation'
import { UsageError, validateGid, ValidationError } from '../lib/validators'
import { formatOutput, getOutputFormat } from '../utils/formatter'

interface TaskGetOptions {
  customId?: string
  workspace?: string
}

function usageError(errorId: ErrorId, message: string, context: Record<string, any>): UsageError {
  console.error(chalk.red(`✗ ${message}`))
  return new UsageError(errorId, message, context)
}

/**
 * Validate that exactly one of `<gid>` / `--custom-id` is given, and that a
 * workspace is available for a custom-id lookup. Runs before any API call.
 * @returns the workspace for custom-id lookups
 */
function resolveWorkspaceForLookup(gid: string | undefined, options: TaskGetOptions): string | undefined {
  if (gid && options.customId) {
    throw usageError(ERROR_IDS.CONFLICTING_OPTIONS, 'Specify either <gid> or --custom-id, not both', {
      gid,
      customId: options.customId,
    })
  }
  if (!gid && !options.customId) {
    throw usageError(ERROR_IDS.MISSING_REQUIRED_OPTION, 'Specify a task <gid> or --custom-id', {
      options: ['<gid>', '--custom-id'],
    })
  }
  if (gid) {
    return undefined
  }
  const workspace = options.workspace || loadConfig()?.workspace
  if (!workspace) {
    throw usageError(
      ERROR_IDS.MISSING_REQUIRED_OPTION,
      '--custom-id requires a workspace (use --workspace or set a default workspace)',
      { option: '--workspace' },
    )
  }
  return workspace
}

export function createTaskGetCommand(): Command {
  return new Command('get')
    .description('Get task details')
    .argument('[gid]', 'Task GID (or use --custom-id)')
    .option('--custom-id <id>', 'Look up the task by its custom ID instead of GID')
    .option('-w, --workspace <workspace>', 'Workspace GID for --custom-id (defaults to the configured workspace)')
    .action(async (gid: string | undefined, options: TaskGetOptions, command: Command) => {
      try {
        const workspace = resolveWorkspaceForLookup(gid, options)
        if (gid) {
          validateGid(gid, 'Task GID')
        }
        const client = getAsanaClient()
        const taskDetail = options.customId
          ? await client.tasks.findByCustomId(workspace!, options.customId)
          : await client.tasks.findById(gid!)

        const format = getOutputFormat(command)

        // Format output based on selected format
        const output = formatOutput({ task: toTaskView(taskDetail) }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          failValidation(error, command)
        }
        handleAsanaError(error, 'Task retrieval', {
          'Task GID': gid,
          'Custom ID': options.customId,
        }, getOutputFormat(command))
      }
    })
}
