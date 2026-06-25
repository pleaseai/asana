import { afterAll, afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { Command } from 'commander'
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
 * keeping the friendly hint only for the genuine missing-credentials case in
 * the human-readable `plain` format. Machine formats (json/toon) route the
 * missing-credentials case through `handleAsanaError` too, so consumers receive
 * structured output instead of a plain colored line.
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

  test('keeps the friendly login hint for plain format when no credentials are stored', async () => {
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

    // Mount auth under a root program that owns the global --format option so
    // `getOutputFormat` resolves `plain` via optsWithGlobals().
    const program = new Command()
    program.option('-f, --format <type>', 'output format', 'toon')
    const { createAuthCommand } = await import('../../src/commands/auth')
    program.addCommand(createAuthCommand())
    await expect(
      program.parseAsync(['--format', 'plain', 'auth', 'whoami'], { from: 'user' }),
    ).rejects.toThrow('__exit__')

    // Missing credentials in plain format → friendly hint, NOT routed as an API error.
    const printed = errorSpy.mock.calls.flat().join(' ')
    expect(printed).toContain('Not authenticated')
    expect(handled).toHaveLength(0)

    errorSpy.mockRestore()
    exitSpy.mockRestore()
  })

  test('routes missing credentials through handleAsanaError for machine formats (default toon)', async () => {
    mock.module('../../src/lib/asana-client', () => ({
      getAsanaClient: () => {
        throw new Error('Asana access token not found. Please run "asana auth login" first.')
      },
      resetClient: () => {},
    }))

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
    // No --format → default 'toon' (machine format) → structured error path.
    await expect(auth.parseAsync(['whoami'], { from: 'user' })).rejects.toThrow('__handled__')

    expect(handled).toHaveLength(1)
    expect(String((handled[0] as Error).message)).toContain('Asana access token not found')
    // The plain friendly hint must NOT be printed for machine formats.
    const printed = errorSpy.mock.calls.flat().join(' ')
    expect(printed).not.toContain('Not authenticated')

    errorSpy.mockRestore()
  })
})
