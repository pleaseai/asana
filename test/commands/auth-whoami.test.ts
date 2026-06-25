import { afterAll, afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import * as realClient from '../../src/lib/asana-client'
import * as realErrorHandler from '../../src/lib/error-handler'

// Bun's `mock.restore()` does NOT revert `mock.module()` registrations, so the
// module mocks below would leak into later test files. Capture the real modules
// by value at load time and re-install them once this file finishes.
const REAL_CLIENT = { ...realClient }
const REAL_ERROR_HANDLER = { ...realErrorHandler }

/**
 * Regression test for `asana auth whoami` error handling.
 *
 * `whoami` used a bare `catch {}` that discarded the real error and always
 * printed "✗ Not authenticated. Run \"asana auth login\" first." — masking the
 * actual cause (e.g. an Asana 400 "This endpoint requires an API app." or an
 * expired-token 401). It now routes failures through `handleAsanaError`, while
 * keeping the friendly hint only for the genuine missing-credentials case.
 */
describe('auth whoami error surfacing', () => {
  afterEach(() => {
    mock.restore()
  })

  afterAll(() => {
    mock.module('../../src/lib/asana-client', () => REAL_CLIENT)
    mock.module('../../src/lib/error-handler', () => REAL_ERROR_HANDLER)
  })

  test('routes real API failures through handleAsanaError, not the generic "Not authenticated" message', async () => {
    // Asana rejects /users/me for non-API apps with a structured 400 error.
    const asanaError = {
      value: { errors: [{ message: 'This endpoint requires an API app.', help: 'https://developers.asana.com/docs/errors' }] },
    }

    mock.module('../../src/lib/asana-client', () => ({
      getAsanaClient: () => ({ users: { me: async () => { throw asanaError } } }),
      resetClient: () => {},
    }))

    // Capture the error routed to handleAsanaError; throw to stop the action
    // (the real implementation calls process.exit).
    const handled: any[] = []
    mock.module('../../src/lib/error-handler', () => ({
      handleAsanaError: (error: any) => {
        handled.push(error)
        throw new Error('__handled__')
      },
    }))

    const errorSpy = spyOn(console, 'error').mockImplementation(() => {})

    const { createAuthCommand } = await import('../../src/commands/auth')
    const auth = createAuthCommand()
    await expect(auth.parseAsync(['whoami'], { from: 'user' })).rejects.toThrow('__handled__')

    // The real Asana error reached the centralized handler...
    expect(handled).toHaveLength(1)
    expect(JSON.stringify(handled[0])).toContain('This endpoint requires an API app.')
    // ...and the generic masking message was NOT printed.
    const printed = errorSpy.mock.calls.flat().join(' ')
    expect(printed).not.toContain('Not authenticated')

    errorSpy.mockRestore()
  })

  test('keeps the friendly login hint when no credentials are stored', async () => {
    mock.module('../../src/lib/asana-client', () => ({
      getAsanaClient: () => {
        throw new Error('Asana access token not found. Please run "asana auth login" first.')
      },
      resetClient: () => {},
    }))

    const handled: any[] = []
    mock.module('../../src/lib/error-handler', () => ({
      handleAsanaError: (error: any) => { handled.push(error) },
    }))

    const errorSpy = spyOn(console, 'error').mockImplementation(() => {})
    const exitSpy = spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('__exit__')
    }) as any)

    const { createAuthCommand } = await import('../../src/commands/auth')
    const auth = createAuthCommand()
    await expect(auth.parseAsync(['whoami'], { from: 'user' })).rejects.toThrow('__exit__')

    // Missing credentials → friendly hint, and NOT routed as an API error.
    const printed = errorSpy.mock.calls.flat().join(' ')
    expect(printed).toContain('Not authenticated')
    expect(handled).toHaveLength(0)

    errorSpy.mockRestore()
    exitSpy.mockRestore()
  })
})
