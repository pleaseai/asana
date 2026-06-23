/**
 * Centralized error handling utilities
 *
 * Provides consistent error handling across all commands.
 *
 * Machine formats (toon/json) emit a structured error to stdout so agents can
 * read failures; the human `plain` format keeps the existing colored stderr
 * output unchanged for backward compatibility. See ADR-003 (AXI §6).
 */

import type { ErrorId } from '../constants/errorIds'
import type { OutputFormat } from '../utils/formatter'
import type { AxiError } from './axi-output'
import chalk from 'chalk'
import { ERROR_IDS } from '../constants/errorIds'
import { emitError } from './axi-output'

/**
 * Whether an error represents a missing resource (HTTP 404). Pure.
 *
 * Used to make destructive mutations idempotent: deleting an already-gone
 * resource is a no-op success rather than an error (AXI §6).
 */
export function isNotFoundError(error: any): boolean {
  return error?.status === 404
}

/**
 * Translate a raw Asana SDK / HTTP / network error into a structured AxiError
 * (stable code + actionable help). Pure — no side effects.
 */
export function translateAsanaError(
  error: any,
  operation: string,
  context: Record<string, any>,
): AxiError {
  // Asana SDK structured errors
  if (error?.value?.errors) {
    const asanaError = error.value.errors[0]
    return {
      code: ERROR_IDS.API_ERROR,
      message: `${operation} failed: ${asanaError?.message ?? 'Unknown error'}`,
      help: asanaError?.help,
      context,
    }
  }

  // HTTP status code errors
  if (error?.status) {
    return translateHttpError(error.status, operation, context)
  }

  // Network errors
  if (error?.code === 'ENOTFOUND' || error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT') {
    return {
      code: ERROR_IDS.NETWORK_ERROR,
      message: 'Network error',
      help: 'Could not connect to Asana API. Check your internet connection.',
      context,
    }
  }

  // Unknown error
  return {
    code: ERROR_IDS.API_ERROR,
    message: `${operation} failed`,
    context: error?.message ? { ...context, error: error.message } : context,
  }
}

/**
 * Translate an HTTP status code into a structured AxiError. Pure.
 */
function translateHttpError(
  status: number,
  operation: string,
  context: Record<string, any>,
): AxiError {
  switch (status) {
    case 404:
      return {
        code: ERROR_IDS.API_ERROR,
        message: 'Resource not found',
        help: 'The resource may have been deleted or you may not have access to it.',
        context,
      }

    case 401:
      return {
        code: ERROR_IDS.AUTH_FAILED,
        message: 'Authentication failed',
        help: 'Your access token may have expired. Run "asana auth login" to re-authenticate.',
      }

    case 403:
      return {
        code: ERROR_IDS.PERMISSION_DENIED,
        message: 'Permission denied',
        help: 'You do not have permission to perform this operation.',
        context,
      }

    case 429:
      return {
        code: ERROR_IDS.RATE_LIMIT_EXCEEDED,
        message: 'Rate limit exceeded',
        help: 'Please wait a moment and try again. Reduce request frequency or use batch operations.',
      }

    case 500:
    case 502:
    case 503:
      return {
        code: ERROR_IDS.API_ERROR,
        message: 'Asana server error',
        help: 'The Asana service is experiencing issues. Please try again later.',
      }

    default:
      return {
        code: ERROR_IDS.API_ERROR,
        message: `${operation} failed (HTTP ${status})`,
        context,
      }
  }
}

/**
 * Handle Asana API errors with specific messages and guidance.
 *
 * For `toon`/`json` the error is emitted as a structured payload to stdout; for
 * `plain` (the default) the original human-readable stderr behavior is used.
 */
export function handleAsanaError(
  error: any,
  operation: string,
  context: Record<string, any>,
  format: OutputFormat = 'plain',
): never {
  // Machine formats: structured error to stdout (AXI §6). emitError writes the
  // payload synchronously, so the following process.exit cannot truncate it
  // when stdout is piped.
  if (format !== 'plain') {
    emitError(translateAsanaError(error, operation, context), format)
    process.exit(1)
  }

  // Asana SDK structured errors
  if (error.value?.errors) {
    const asanaError = error.value.errors[0]
    console.error(chalk.red(`✗ ${operation} failed: ${asanaError.message}`))
    logContext(context)
    if (asanaError.help) {
      console.error(chalk.gray(`  Help: ${asanaError.help}`))
    }
    process.exit(1)
  }

  // HTTP status code errors
  if (error.status) {
    handleHttpError(error.status, operation, context)
  }

  // Network errors
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    console.error(chalk.red('✗ Network error'))
    console.error(chalk.gray('  Could not connect to Asana API. Check your internet connection.'))
    logContext(context)
    process.exit(1)
  }

  // Unknown error
  console.error(chalk.red(`✗ ${operation} failed`))
  logContext(context)
  if (error.message) {
    console.error(chalk.gray(`  Error: ${error.message}`))
  }
  if (process.env.DEBUG) {
    console.error(chalk.gray('\n  Full error details:'))
    console.error(error)
  }
  process.exit(1)
}

/**
 * Handle HTTP status code errors
 */
function handleHttpError(status: number, operation: string, context: Record<string, any>): never {
  switch (status) {
    case 404:
      console.error(chalk.red('✗ Resource not found'))
      logContext(context)
      console.error(chalk.gray('  The resource may have been deleted or you may not have access to it.'))
      break

    case 401:
      console.error(chalk.red('✗ Authentication failed'))
      console.error(chalk.gray('  Your access token may have expired. Run "asana auth login" to re-authenticate.'))
      break

    case 403:
      console.error(chalk.red('✗ Permission denied'))
      logContext(context)
      console.error(chalk.gray('  You do not have permission to perform this operation.'))
      break

    case 429:
      console.error(chalk.red('✗ Rate limit exceeded'))
      console.error(chalk.gray('  Please wait a moment and try again.'))
      console.error(chalk.gray('  Tip: Reduce request frequency or use batch operations.'))
      break

    case 500:
    case 502:
    case 503:
      console.error(chalk.red('✗ Asana server error'))
      console.error(chalk.gray('  The Asana service is experiencing issues. Please try again later.'))
      break

    default:
      console.error(chalk.red(`✗ ${operation} failed (HTTP ${status})`))
      logContext(context)
  }

  process.exit(1)
}

/**
 * Log operation context in a consistent format
 */
function logContext(context: Record<string, any>): void {
  for (const [key, value] of Object.entries(context)) {
    if (value !== undefined && value !== null) {
      console.error(chalk.gray(`  ${key}: ${value}`))
    }
  }
}

/**
 * Log structured error for monitoring (JSON format for Sentry/etc)
 */
export function logError(
  errorId: ErrorId,
  message: string,
  context: Record<string, any>,
  error?: Error,
): void {
  // In production, this would send to error tracking service
  // For now, log to stderr in structured format
  if (process.env.NODE_ENV === 'production') {
    console.error(JSON.stringify({
      errorId,
      message,
      context,
      error: error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        : undefined,
      timestamp: new Date().toISOString(),
    }))
  }
}
