/**
 * Validator unit tests
 *
 * Covers dependency-limit and self-dependency validation used by the
 * `task dependency` / `task dependent` commands. These are pure functions,
 * so they are tested deterministically without touching the Asana API.
 */

import { describe, expect, test } from 'bun:test'
import { ERROR_IDS } from '../../src/constants/errorIds'
import {
  MAX_DEPENDENCIES_COMBINED,
  validateDependencyLimit,
  validateNoSelfDependency,
  validateUserIdentifier,
  ValidationError,
} from '../../src/lib/validators'

describe('validateDependencyLimit', () => {
  test('allows adding when combined count stays under the limit', () => {
    expect(() => validateDependencyLimit(0, 1)).not.toThrow()
    expect(() => validateDependencyLimit(10, 5)).not.toThrow()
  })

  test('allows adding when combined count exactly reaches the limit', () => {
    expect(() => validateDependencyLimit(MAX_DEPENDENCIES_COMBINED - 1, 1)).not.toThrow()
    expect(() => validateDependencyLimit(MAX_DEPENDENCIES_COMBINED, 0)).not.toThrow()
  })

  test('throws when adding one would exceed the limit', () => {
    expect(() => validateDependencyLimit(MAX_DEPENDENCIES_COMBINED, 1)).toThrow(ValidationError)
  })

  test('throws when a bulk add would exceed the limit', () => {
    expect(() => validateDependencyLimit(28, 5)).toThrow(ValidationError)
  })

  test('defaults addCount to 1 when omitted', () => {
    expect(() => validateDependencyLimit(MAX_DEPENDENCIES_COMBINED)).toThrow(ValidationError)
    expect(() => validateDependencyLimit(MAX_DEPENDENCIES_COMBINED - 1)).not.toThrow()
  })

  test('uses the DEPENDENCY_LIMIT_EXCEEDED error id', () => {
    try {
      validateDependencyLimit(MAX_DEPENDENCIES_COMBINED, 1)
      throw new Error('expected validateDependencyLimit to throw')
    }
    catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).errorId).toBe(ERROR_IDS.DEPENDENCY_LIMIT_EXCEEDED)
    }
  })

  test('exposes the combined limit as 30', () => {
    expect(MAX_DEPENDENCIES_COMBINED).toBe(30)
  })
})

describe('validateNoSelfDependency', () => {
  test('allows distinct task and dependency gids', () => {
    expect(() => validateNoSelfDependency('123', '456')).not.toThrow()
  })

  test('throws when a task depends on itself', () => {
    expect(() => validateNoSelfDependency('123', '123')).toThrow(ValidationError)
  })

  test('uses the SELF_DEPENDENCY error id', () => {
    try {
      validateNoSelfDependency('123', '123')
      throw new Error('expected validateNoSelfDependency to throw')
    }
    catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).errorId).toBe(ERROR_IDS.SELF_DEPENDENCY)
    }
  })
})

describe('validateUserIdentifier', () => {
  test('allows a numeric GID', () => {
    expect(() => validateUserIdentifier('1234567890')).not.toThrow()
  })

  test('allows "me"', () => {
    expect(() => validateUserIdentifier('me')).not.toThrow()
  })

  test('allows an email address', () => {
    expect(() => validateUserIdentifier('user@example.com')).not.toThrow()
  })

  test('throws for arbitrary strings', () => {
    expect(() => validateUserIdentifier('not-a-user')).toThrow(ValidationError)
  })

  test('throws for empty values', () => {
    expect(() => validateUserIdentifier('')).toThrow(ValidationError)
  })

  test('uses the INVALID_USER_IDENTIFIER error id', () => {
    try {
      validateUserIdentifier('not-a-user')
      throw new Error('expected validateUserIdentifier to throw')
    }
    catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).errorId).toBe(ERROR_IDS.INVALID_USER_IDENTIFIER)
    }
  })
})
