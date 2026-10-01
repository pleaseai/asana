import * as nodeFs from 'node:fs'
import { afterAll, afterEach, beforeEach, mock, spyOn } from 'bun:test'
import { Command } from 'commander'
import * as realClient from '../../../src/lib/asana-client'
import * as realConfig from '../../../src/lib/config'

// Bun's `mock.restore()` does NOT revert `mock.module()` registrations —
// capture the real modules so each test file can re-install them when it finishes.
const REAL_CLIENT = { ...realClient }
const REAL_CONFIG = { ...realConfig }

export interface TaskCliHarness {
  exitSpy: ReturnType<typeof spyOn>
  errorSpy: ReturnType<typeof spyOn>
  writeSpy: ReturnType<typeof spyOn>
  logs: string[]
  /** Replace the Asana client and config modules seen by `src/commands/task`. */
  mockModules: (client: unknown, config: unknown) => void
  /** Parse `asana --format <format> task <args>` and return the captured stdout. */
  runTask: (args: string[], format?: string) => Promise<string>
  /** The structured error payload written to stdout (via `writeSync`). */
  stdoutError: () => any
}

/**
 * Registers the shared lifecycle hooks (process.exit / console / writeSync
 * spies, console.log capture, real-module restore) for a task command test
 * file. Call once inside the file's top-level `describe`.
 */
export function useTaskCliHarness(): TaskCliHarness {
  const originalLog = console.log
  const harness = {} as TaskCliHarness

  beforeEach(() => {
    harness.logs = []
    console.log = (...args: any[]) => {
      harness.logs.push(args.join(' '))
    }
    harness.exitSpy = spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('__exit__')
    }) as never)
    harness.errorSpy = spyOn(console, 'error').mockImplementation(() => {})
    harness.writeSpy = spyOn(nodeFs, 'writeSync').mockImplementation(() => 0)
  })

  afterEach(() => {
    console.log = originalLog
    harness.exitSpy.mockRestore()
    harness.errorSpy.mockRestore()
    harness.writeSpy.mockRestore()
    mock.restore()
  })

  afterAll(() => {
    mock.module('../../../src/lib/asana-client', () => REAL_CLIENT)
    mock.module('../../../src/lib/config', () => REAL_CONFIG)
  })

  harness.mockModules = (client, config) => {
    mock.module('../../../src/lib/asana-client', () => client)
    mock.module('../../../src/lib/config', () => config)
  }

  harness.runTask = async (args, format = 'json') => {
    const { createTaskCommand } = await import('../../../src/commands/task')
    const program = new Command()
    program.name('asana').option('-f, --format <type>', 'Output format', 'toon')
    program.addCommand(createTaskCommand())

    await program.parseAsync(['--format', format, 'task', ...args], { from: 'user' })
    return harness.logs.join('\n')
  }

  harness.stdoutError = () => JSON.parse(String(harness.writeSpy.mock.calls[0]?.[1]))

  return harness
}
