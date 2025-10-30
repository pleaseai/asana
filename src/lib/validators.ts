/**
 * Input validation utilities
 *
 * Provides reusable validation functions for command inputs.
 * Validates before API calls to provide clear error messages.
 */

import chalk from 'chalk'
import { ERROR_IDS } from '../constants/errorIds'

export class ValidationError extends Error {
  constructor(
    public errorId: string,
    message: string,
    public context: Record<string, any> = {},
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Validate Asana GID format (numeric string)
 */
export function validateGid(gid: string, fieldName: string = 'GID'): void {
  if (!gid || typeof gid !== 'string' || !/^\d+$/.test(gid)) {
    console.error(chalk.red(`✗ Invalid ${fieldName} format. Expected numeric ID.`))
    console.error(chalk.gray(`  Provided: ${gid}`))
    throw new ValidationError(
      ERROR_IDS.INVALID_TASK_GID,
      `Invalid ${fieldName}`,
      { gid, fieldName },
    )
  }
}

/**
 * Validate date format (YYYY-MM-DD)
 */
export function validateDateFormat(date: string, fieldName: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error(chalk.red(`✗ Invalid date format for ${fieldName}`))
    console.error(chalk.gray('  Expected format: YYYY-MM-DD (e.g., 2025-10-30)'))
    console.error(chalk.gray(`  Provided: ${date}`))
    throw new ValidationError(
      ERROR_IDS.INVALID_DATE_FORMAT,
      `Invalid date format for ${fieldName}`,
      { date, fieldName },
    )
  }
}

/**
 * Validate that at least one field is provided for update
 */
export function validateUpdateFields(fields: Record<string, any>): void {
  if (Object.keys(fields).length === 0) {
    console.error(chalk.red('✗ At least one field must be specified for update'))
    console.error(chalk.gray('  Available options: --name, --notes, --assignee, --due-on, --start-on, --completed'))
    console.error(chalk.gray('  Example: asana task update 123456 --name "Updated name" --completed true'))
    throw new ValidationError(
      ERROR_IDS.NO_UPDATE_FIELDS,
      'No update fields provided',
      { fields },
    )
  }
}
