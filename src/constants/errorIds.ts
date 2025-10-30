/**
 * Error ID constants for tracking and monitoring
 *
 * Used for structured logging and error analytics.
 * Each error has a unique ID for easy identification in logs.
 */

export const ERROR_IDS = {
  // Task operation errors
  TASK_UPDATE_FAILED: 'TASK_UPDATE_FAILED',
  TASK_MOVE_FAILED: 'TASK_MOVE_FAILED',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  NO_UPDATE_FIELDS: 'NO_UPDATE_FIELDS',

  // Validation errors
  INVALID_TASK_GID: 'INVALID_TASK_GID',
  INVALID_PROJECT_GID: 'INVALID_PROJECT_GID',
  INVALID_SECTION_GID: 'INVALID_SECTION_GID',
  INVALID_DATE_FORMAT: 'INVALID_DATE_FORMAT',

  // Authentication and authorization errors
  AUTH_FAILED: 'AUTH_FAILED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',

  // API errors
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  API_ERROR: 'API_ERROR',
} as const

export type ErrorId = typeof ERROR_IDS[keyof typeof ERROR_IDS]
