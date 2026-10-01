import type { Command } from 'commander'
import type { ValidationError } from './validators'
import { getOutputFormat } from '../utils/formatter'
import { emitError } from './axi-output'
import { UsageError } from './validators'

const EXIT_FAILURE = 1
const EXIT_USAGE = 2

/**
 * Exit on a validation failure, emitting a structured error to stdout for
 * machine formats (AXI §6). For `plain` the validator has already written a
 * human-readable message to stderr, so we avoid printing it twice.
 *
 * Usage errors (UsageError) exit 2, other validation errors exit 1.
 *
 * emitError writes the payload synchronously, so the following process.exit
 * cannot truncate it when stdout is piped.
 */
export function failValidation(error: ValidationError, command: Command): never {
  const format = getOutputFormat(command)
  if (format !== 'plain') {
    emitError({ code: error.errorId, message: error.message, context: error.context }, format)
  }
  process.exit(error instanceof UsageError ? EXIT_USAGE : EXIT_FAILURE)
}
