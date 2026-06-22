import { afterAll, afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import * as realClient from '../../src/lib/asana-client'
import * as realConfig from '../../src/lib/config'

// Bun's `mock.restore()` does NOT revert `mock.module()` registrations, so the
// module mocks below leak into later test files and make the suite order-
// dependent. Capture the real modules by value at load time and re-install them
// once this file's tests finish.
const REAL_CLIENT = { ...realClient }
const REAL_CONFIG = { ...realConfig }

/**
 * Regression test for `task create` due date handling.
 *
 * The create command exposed `--due` but the action only read `options.dueOn`,
 * so the due date was silently dropped (the API received no `due_on`). This
 * verifies the canonical `--due-on` flag and the legacy `--due` alias both
 * reach the API as `due_on`. The asana client and config are mocked, so no
 * network or disk is touched.
 */
describe('task create due date', () => {
  afterEach(() => {
    mock.restore()
  })

  afterAll(() => {
    mock.module('../../src/lib/asana-client', () => REAL_CLIENT)
    mock.module('../../src/lib/config', () => REAL_CONFIG)
  })

  async function runCreate(args: string[]): Promise<any> {
    let captured: any = null
    mock.module('../../src/lib/asana-client', () => ({
      getAsanaClient: () => ({
        tasks: {
          create: async (taskData: any) => {
            captured = taskData
            return { gid: '1', name: taskData.name, permalink_url: 'https://app.asana.com/x' }
          },
        },
      }),
    }))
    mock.module('../../src/lib/config', () => ({
      loadConfig: () => ({ workspace: '123' }),
    }))

    const { createTaskCommand } = await import('../../src/commands/task')
    const task = createTaskCommand()
    await task.parseAsync(['create', ...args], { from: 'user' })
    return captured
  }

  test('--due-on sets due_on on the created task', async () => {
    const taskData = await runCreate(['-n', 'Task', '-w', '123', '--due-on', '2026-06-26'])
    expect(taskData?.due_on).toBe('2026-06-26')
  })

  test('legacy --due alias also sets due_on', async () => {
    const taskData = await runCreate(['-n', 'Task', '-w', '123', '--due', '2026-06-26'])
    expect(taskData?.due_on).toBe('2026-06-26')
  })

  test('invalid date format exits without calling the API', async () => {
    // validateDateFormat throws a ValidationError, which the create action
    // catches and turns into process.exit(1) (consistent with sibling
    // commands). Stub process.exit to throw so the action stops here instead
    // of terminating the test runner, and silence the validation output
    // written to stderr.
    const exitSpy = spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called')
    }) as never)
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {})
    try {
      await expect(
        runCreate(['-n', 'Task', '-w', '123', '--due-on', 'invalid-date']),
      ).rejects.toThrow('process.exit called')
      expect(exitSpy).toHaveBeenCalledWith(1)
    }
    finally {
      exitSpy.mockRestore()
      errorSpy.mockRestore()
    }
  })
})
