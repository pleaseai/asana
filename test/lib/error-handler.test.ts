/**
 * Error-handler tests.
 *
 * `translateAsanaError` is the pure mapping from a raw Asana/SDK/network error
 * to a structured AxiError (stable code + actionable help). It is unit-tested
 * here without touching the process-exit/emit side effects (AXI §6, ADR-003).
 */

import { describe, expect, test } from 'bun:test'
import { ERROR_IDS } from '../../src/constants/errorIds'
import { isNotFoundError, translateAsanaError } from '../../src/lib/error-handler'

const OP = 'Task creation'
const CTX = { 'Task GID': '123' }

describe('translateAsanaError', () => {
  test('maps Asana SDK structured errors, preserving message and help', () => {
    const error = { value: { errors: [{ message: 'Invalid request', help: 'Check the payload' }] } }
    const result = translateAsanaError(error, OP, CTX)

    expect(result.code).toBe(ERROR_IDS.API_ERROR)
    expect(result.message).toContain('Invalid request')
    expect(result.help).toBe('Check the payload')
    expect(result.context).toEqual(CTX)
  })

  test('maps HTTP 401 to AUTH_FAILED with a re-auth hint', () => {
    const result = translateAsanaError({ status: 401 }, OP, CTX)

    expect(result.code).toBe(ERROR_IDS.AUTH_FAILED)
    expect(result.help).toContain('auth login')
  })

  test('maps HTTP 403 to PERMISSION_DENIED', () => {
    const result = translateAsanaError({ status: 403 }, OP, CTX)
    expect(result.code).toBe(ERROR_IDS.PERMISSION_DENIED)
  })

  test('maps HTTP 404 to a not-found API error', () => {
    const result = translateAsanaError({ status: 404 }, OP, CTX)

    expect(result.code).toBe(ERROR_IDS.API_ERROR)
    expect(result.message.toLowerCase()).toContain('not found')
  })

  test('maps HTTP 429 to RATE_LIMIT_EXCEEDED', () => {
    const result = translateAsanaError({ status: 429 }, OP, CTX)
    expect(result.code).toBe(ERROR_IDS.RATE_LIMIT_EXCEEDED)
  })

  test('maps HTTP 5xx to an API server error', () => {
    const result = translateAsanaError({ status: 503 }, OP, CTX)

    expect(result.code).toBe(ERROR_IDS.API_ERROR)
    expect(result.message.toLowerCase()).toContain('server')
  })

  test('maps network errors to NETWORK_ERROR', () => {
    const result = translateAsanaError({ code: 'ENOTFOUND' }, OP, CTX)

    expect(result.code).toBe(ERROR_IDS.NETWORK_ERROR)
    expect(result.message.toLowerCase()).toContain('network')
  })

  test('maps unknown errors to API_ERROR, preserving operation, context, and the raw message', () => {
    const result = translateAsanaError({ message: 'boom' }, OP, CTX)

    expect(result.code).toBe(ERROR_IDS.API_ERROR)
    expect(result.message).toContain(OP)
    // Original context is preserved and the underlying error detail is folded in.
    expect(result.context).toMatchObject(CTX)
    expect(result.context?.error).toBe('boom')
  })

  test('keeps context untouched when an unknown error carries no message', () => {
    const result = translateAsanaError({}, OP, CTX)

    expect(result.code).toBe(ERROR_IDS.API_ERROR)
    expect(result.context).toEqual(CTX)
  })
})

describe('isNotFoundError', () => {
  test('is true for an HTTP 404 error', () => {
    expect(isNotFoundError({ status: 404 })).toBe(true)
  })

  test('is false for other HTTP statuses', () => {
    expect(isNotFoundError({ status: 403 })).toBe(false)
    expect(isNotFoundError({ status: 500 })).toBe(false)
  })

  test('is false for network and unknown errors', () => {
    expect(isNotFoundError({ code: 'ENOTFOUND' })).toBe(false)
    expect(isNotFoundError({})).toBe(false)
    expect(isNotFoundError(null)).toBe(false)
  })
})
