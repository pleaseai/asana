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

  // Subtask and dependency errors
  DEPENDENCY_LIMIT_EXCEEDED: 'DEPENDENCY_LIMIT_EXCEEDED',
  SELF_DEPENDENCY: 'SELF_DEPENDENCY',

  // Validation errors
  INVALID_TASK_GID: 'INVALID_TASK_GID',
  INVALID_PROJECT_GID: 'INVALID_PROJECT_GID',
  INVALID_SECTION_GID: 'INVALID_SECTION_GID',
  INVALID_DATE_FORMAT: 'INVALID_DATE_FORMAT',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',

  // Custom field errors
  INVALID_CUSTOM_FIELD_VALUE: 'INVALID_CUSTOM_FIELD_VALUE',
  UNSUPPORTED_CUSTOM_FIELD_TYPE: 'UNSUPPORTED_CUSTOM_FIELD_TYPE',

  // Batch operation errors
  INVALID_BATCH_FILE: 'INVALID_BATCH_FILE',

  // Authentication and authorization errors
  AUTH_FAILED: 'AUTH_FAILED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',

  // API errors
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  API_ERROR: 'API_ERROR',
} as const

export type ErrorId = typeof ERROR_IDS[keyof typeof ERROR_IDS]
