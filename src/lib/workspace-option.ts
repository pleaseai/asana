import chalk from 'chalk'
import { ERROR_IDS } from '../constants/errorIds'
import { UsageError } from './validators'

/**
 * Resolve the workspace for lookups that must not silently hit another
 * workspace: an explicitly passed but blank `--workspace` is a usage error
 * (stderr message, then UsageError), while an absent one falls back to the
 * configured default.
 */
export function resolveExplicitWorkspace(
  option: string | undefined,
  configured: string | undefined,
): string | undefined {
  if (option === undefined) {
    return configured
  }
  const workspace = option.trim()
  if (workspace === '') {
    const message = '--workspace requires a GID'
    console.error(chalk.red(`✗ ${message}`))
    throw new UsageError(ERROR_IDS.MISSING_REQUIRED_OPTION, message, { option: '--workspace' })
  }
  return workspace
}
