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
 * Maximum number of dependencies and dependents combined per task.
 *
 * Asana enforces a hard limit of 30 dependency relationships (dependencies +
 * dependents) per task. We validate locally to give a clear message before the
 * API rejects the request.
 */
export const MAX_DEPENDENCIES_COMBINED = 30

/**
 * Validate that adding `addCount` relationships keeps the combined
 * dependencies + dependents count within the Asana limit.
 */
export function validateDependencyLimit(currentCombinedCount: number, addCount: number = 1): void {
  if (currentCombinedCount + addCount > MAX_DEPENDENCIES_COMBINED) {
    console.error(chalk.red('✗ Dependency limit exceeded'))
    console.error(chalk.gray(`  Asana allows at most ${MAX_DEPENDENCIES_COMBINED} dependencies and dependents combined per task.`))
    console.error(chalk.gray(`  Current: ${currentCombinedCount}, attempting to add: ${addCount}`))
    throw new ValidationError(
      ERROR_IDS.DEPENDENCY_LIMIT_EXCEEDED,
      'Dependency limit exceeded',
      { currentCombinedCount, addCount, limit: MAX_DEPENDENCIES_COMBINED },
    )
  }
}

/**
 * Validate that a task is not being made to depend on (or block) itself.
 */
export function validateNoSelfDependency(taskGid: string, relatedGid: string): void {
  if (taskGid === relatedGid) {
    console.error(chalk.red('✗ A task cannot depend on itself'))
    console.error(chalk.gray(`  Task GID and related GID are both: ${taskGid}`))
    throw new ValidationError(
      ERROR_IDS.SELF_DEPENDENCY,
      'Self-dependency is not allowed',
      { taskGid, relatedGid },
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
