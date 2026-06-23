/**
 * AXI structured output helper tests.
 *
 * Covers the format-aware error rendering introduced for AXI §6 (ADR-003):
 * machine formats (toon/json) emit a structured payload to stdout, while the
 * human `plain` format keeps colored stderr output.
 */

import * as nodeFs from 'node:fs'
import { describe, expect, mock, spyOn, test } from 'bun:test'
import { ERROR_IDS } from '../../src/constants/errorIds'
import {
  buildErrorPayload,
  emitError,
  emitResult,
  formatStructuredError,
} from '../../src/lib/axi-output'

describe('buildErrorPayload', () => {
  test('maps message and code to error/code with a stable key order', () => {
    const payload = buildErrorPayload({
      code: ERROR_IDS.TASK_NOT_FOUND,
      message: 'Task not found',
    })

    expect(Object.keys(payload)).toEqual(['error', 'code'])
    expect(payload.error).toBe('Task not found')
    expect(payload.code).toBe(ERROR_IDS.TASK_NOT_FOUND)
  })

  test('includes help and context only when provided', () => {
    const payload = buildErrorPayload({
      code: ERROR_IDS.INVALID_TASK_GID,
      message: 'Invalid GID',
      help: 'Run `asana task list` to find a valid GID',
      context: { gid: 'abc' },
    })

    expect(Object.keys(payload)).toEqual(['error', 'code', 'help', 'context'])
    expect(payload.help).toBe('Run `asana task list` to find a valid GID')
    expect(payload.context).toEqual({ gid: 'abc' })
  })

  test('omits empty context object', () => {
    const payload = buildErrorPayload({
      code: ERROR_IDS.API_ERROR,
      message: 'boom',
      context: {},
    })

    expect(Object.keys(payload)).toEqual(['error', 'code'])
  })
})

describe('formatStructuredError', () => {
  test('renders valid JSON with error and code keys', () => {
    const out = formatStructuredError(
      { code: ERROR_IDS.TASK_NOT_FOUND, message: 'Task not found' },
      'json',
    )
    const parsed = JSON.parse(out)

    expect(parsed.error).toBe('Task not found')
    expect(parsed.code).toBe(ERROR_IDS.TASK_NOT_FOUND)
  })

  test('renders TOON containing the message and code', () => {
    const out = formatStructuredError(
      { code: ERROR_IDS.TASK_NOT_FOUND, message: 'Task not found' },
      'toon',
    )

    expect(out).toContain('error')
    expect(out).toContain('Task not found')
    expect(out).toContain('code')
    expect(out).toContain(ERROR_IDS.TASK_NOT_FOUND)
  })
})

describe('emitError', () => {
  test('writes a structured payload synchronously to stdout (fd 1) for json format', () => {
    // Synchronous write (not console.log) so process.exit cannot truncate it
    // when stdout is piped.
    const writeSpy = spyOn(nodeFs, 'writeSync').mockImplementation(() => 0)
    const err = spyOn(console, 'error').mockImplementation(() => {})

    emitError({ code: ERROR_IDS.TASK_NOT_FOUND, message: 'Task not found' }, 'json')

    expect(err).not.toHaveBeenCalled()
    expect(writeSpy).toHaveBeenCalledTimes(1)
    const call = writeSpy.mock.calls[0]
    expect(call?.[0]).toBe(1)
    const parsed = JSON.parse(String(call?.[1]))
    expect(parsed.code).toBe(ERROR_IDS.TASK_NOT_FOUND)

    mock.restore()
  })

  test('writes colored human output to stderr for plain format', () => {
    const log = spyOn(console, 'log').mockImplementation(() => {})
    const err = spyOn(console, 'error').mockImplementation(() => {})

    emitError(
      { code: ERROR_IDS.TASK_NOT_FOUND, message: 'Task not found', help: 'Try again' },
      'plain',
    )

    expect(log).not.toHaveBeenCalled()
    expect(err).toHaveBeenCalled()
    const joined = err.mock.calls.map(call => String(call[0])).join('\n')
    expect(joined).toContain('Task not found')
    expect(joined).toContain('Try again')

    mock.restore()
  })

  test('renders object context values without [object Object] in plain output', () => {
    spyOn(console, 'log').mockImplementation(() => {})
    const err = spyOn(console, 'error').mockImplementation(() => {})

    emitError(
      { code: ERROR_IDS.NO_UPDATE_FIELDS, message: 'No fields', context: { fields: { name: 'x' } } },
      'plain',
    )

    const joined = err.mock.calls.map(call => String(call[0])).join('\n')
    expect(joined).not.toContain('[object Object]')
    expect(joined).toContain('name')

    mock.restore()
  })
})

describe('emitResult', () => {
  test('emits a structured payload to stdout for machine formats', () => {
    const log = spyOn(console, 'log').mockImplementation(() => {})

    emitResult({ task: { gid: '1', status: 'success' } }, '✓ done', 'json')

    expect(log).toHaveBeenCalledTimes(1)
    const parsed = JSON.parse(String(log.mock.calls[0]?.[0]))
    expect(parsed.task.gid).toBe('1')

    mock.restore()
  })

  test('emits the human plain message for plain format', () => {
    const log = spyOn(console, 'log').mockImplementation(() => {})

    emitResult({ task: { gid: '1' } }, '✓ done', 'plain')

    const out = String(log.mock.calls[0]?.[0])
    expect(out).toContain('✓ done')
    // The structured payload must not leak into plain output.
    expect(out).not.toContain('gid')

    mock.restore()
  })
})
