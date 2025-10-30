/**
 * Centralized error handling utilities
 *
 * Provides consistent error handling across all commands.
 */

import type { ErrorId } from '../constants/errorIds'
import chalk from 'chalk'

/**
 * Handle Asana API errors with specific messages and guidance
 */
export function handleAsanaError(
  error: any,
  operation: string,
  context: Record<string, any>,
): never {
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
