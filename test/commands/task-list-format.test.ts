import { afterAll, afterEach, describe, expect, mock, test } from 'bun:test'
import { Command } from 'commander'
import * as realClient from '../../src/lib/asana-client'
import * as realConfig from '../../src/lib/config'

// Bun's `mock.restore()` does NOT revert `mock.module()` registrations, so the
// module mocks below would leak into later test files and make the suite order-
// dependent (e.g. a stubbed `loadConfig` breaks asana-client tests on CI where
// the file order differs). Capture the real modules by value at load time and
// re-install them once this file's tests finish.
const REAL_CLIENT = { ...realClient }
const REAL_CONFIG = { ...realConfig }

/**
 * Regression test for `task list` output format.
 *
 * The list action read the format from `command.parent` (the `task` command),
 * but the global `--format` option lives on the ROOT command — two levels up.
 * As a result `task list --format json` was silently ignored and always
 * printed TOON. This wires up the real root→task→list hierarchy and asserts
 * the global flag is honored. The asana client + config are mocked.
 */
describe('task list output format', () => {
  afterEach(() => {
    mock.restore()
  })

  afterAll(() => {
    mock.module('../../src/lib/asana-client', () => REAL_CLIENT)
    mock.module('../../src/lib/config', () => REAL_CONFIG)
  })

  async function runList(globalArgs: string[]): Promise<string> {
    mock.module('../../src/lib/asana-client', () => ({
      getAsanaClient: () => ({
        tasks: {
          findAll: async () => ({
            data: [{ gid: '1', name: 'T', resource_type: 'task', resource_subtype: 'default_task' }],
          }),
        },
      }),
    }))
    mock.module('../../src/lib/config', () => ({
      loadConfig: () => ({ workspace: '123' }),
    }))

    const { createTaskCommand } = await import('../../src/commands/task')
    const program = new Command()
    program.name('asana').option('-f, --format <type>', 'Output format', 'toon')
    program.addCommand(createTaskCommand())

    const logs: string[] = []
    const original = console.log
    console.log = (...args: any[]) => {
      logs.push(args.join(' '))
    }
    try {
      await program.parseAsync([...globalArgs, 'task', 'list', '-a', 'me'], { from: 'user' })
    }
    finally {
      console.log = original
    }
    return logs.join('\n')
  }

  test('honors global --format json', async () => {
    const out = await runList(['--format', 'json'])
    expect(out.trim().startsWith('{')).toBe(true)
    expect(JSON.parse(out)).toHaveProperty('tasks')
  })

  test('defaults to TOON when no format is given', async () => {
    const out = await runList([])
    expect(out).toContain('tasks[')
  })
})
