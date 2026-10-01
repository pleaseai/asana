import * as nodeFs from 'node:fs'
import { afterAll, afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { Command } from 'commander'
import { ERROR_IDS } from '../../src/constants/errorIds'
import * as realClient from '../../src/lib/asana-client'
import * as realConfig from '../../src/lib/config'

// Bun's `mock.restore()` does NOT revert `mock.module()` registrations —
// re-install the real modules when this file finishes.
const REAL_CLIENT = { ...realClient }
const REAL_CONFIG = { ...realConfig }

const EXIT_USAGE = 2
const DEFAULT_WORKSPACE = '123'
const TASK = { gid: '42', name: 'Fix login', completed: false, assignee: { name: 'Alice' }, due_on: null, notes: 'n' }

/** `task get <gid>` and `task get --custom-id <id>` (issue #106). */
describe('task get', () => {
  let calls: Array<{ method: string, args: any[] }>
  let exitSpy: ReturnType<typeof spyOn>
  let errorSpy: ReturnType<typeof spyOn>
  let writeSpy: ReturnType<typeof spyOn>
  let logs: string[]
  const originalLog = console.log

  beforeEach(() => {
    calls = []
    logs = []
    console.log = (...args: any[]) => {
      logs.push(args.join(' '))
    }
    exitSpy = spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('__exit__')
    }) as never)
    errorSpy = spyOn(console, 'error').mockImplementation(() => {})
    writeSpy = spyOn(nodeFs, 'writeSync').mockImplementation(() => 0)
  })

  afterEach(() => {
    console.log = originalLog
    exitSpy.mockRestore()
    errorSpy.mockRestore()
    writeSpy.mockRestore()
    mock.restore()
  })

  afterAll(() => {
    mock.module('../../src/lib/asana-client', () => REAL_CLIENT)
    mock.module('../../src/lib/config', () => REAL_CONFIG)
  })

  async function runGet(args: string[], opts: { workspace?: string, format?: string } = {}): Promise<any> {
    mock.module('../../src/lib/asana-client', () => ({
      getAsanaClient: () => ({
        tasks: {
          findById: async (...a: any[]) => {
            calls.push({ method: 'findById', args: a })
            return TASK
          },
          findByCustomId: async (...a: any[]) => {
            calls.push({ method: 'findByCustomId', args: a })
            return TASK
          },
        },
      }),
    }))
    mock.module('../../src/lib/config', () => ({
      loadConfig: () => ({ workspace: 'workspace' in opts ? opts.workspace : DEFAULT_WORKSPACE }),
    }))

    const { createTaskCommand } = await import('../../src/commands/task')
    const program = new Command()
    program.name('asana').option('-f, --format <type>', 'Output format', 'toon')
    program.addCommand(createTaskCommand())

    await program.parseAsync(['--format', opts.format ?? 'json', 'task', 'get', ...args], { from: 'user' })
    return JSON.parse(logs.join('\n'))
  }

  function stdoutError(): any {
    return JSON.parse(String(writeSpy.mock.calls[0]?.[1]))
  }

  test('a gid keeps using findById', async () => {
    const out = await runGet(['42'])

    expect(calls).toEqual([{ method: 'findById', args: ['42'] }])
    expect(out.task.gid).toBe('42')
  })

  test('--custom-id looks the task up in the default workspace with the same output shape', async () => {
    const out = await runGet(['--custom-id', 'PROJ-7'])

    expect(calls).toEqual([{ method: 'findByCustomId', args: [DEFAULT_WORKSPACE, 'PROJ-7'] }])
    expect(out).toEqual({
      task: { gid: '42', name: 'Fix login', completed: false, assignee: 'Alice', due_on: null, notes: 'n' },
    })
  })

  test('--workspace overrides the configured default', async () => {
    await runGet(['--custom-id', 'PROJ-7', '--workspace', '999'])

    expect(calls[0]?.args).toEqual(['999', 'PROJ-7'])
  })

  test('a gid together with --custom-id is a usage error before any API call', async () => {
    await expect(runGet(['42', '--custom-id', 'PROJ-7'])).rejects.toThrow('__exit__')

    expect(exitSpy).toHaveBeenCalledWith(EXIT_USAGE)
    expect(stdoutError().code).toBe(ERROR_IDS.CONFLICTING_OPTIONS)
    expect(calls).toHaveLength(0)
  })

  test('neither a gid nor --custom-id is a usage error before any API call', async () => {
    await expect(runGet([])).rejects.toThrow('__exit__')

    expect(exitSpy).toHaveBeenCalledWith(EXIT_USAGE)
    expect(stdoutError().code).toBe(ERROR_IDS.MISSING_REQUIRED_OPTION)
    expect(calls).toHaveLength(0)
  })

  test('--custom-id without any workspace is a usage error before any API call', async () => {
    await expect(runGet(['--custom-id', 'PROJ-7'], { workspace: undefined })).rejects.toThrow('__exit__')

    expect(exitSpy).toHaveBeenCalledWith(EXIT_USAGE)
    expect(stdoutError().code).toBe(ERROR_IDS.MISSING_REQUIRED_OPTION)
    expect(calls).toHaveLength(0)
  })
})
