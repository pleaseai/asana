import * as nodeFs from 'node:fs'
import { afterAll, afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { Command } from 'commander'
import { ERROR_IDS } from '../../src/constants/errorIds'
import * as realClient from '../../src/lib/asana-client'
import * as realConfig from '../../src/lib/config'

// Bun's `mock.restore()` does NOT revert `mock.module()` registrations —
// capture the real modules and re-install them when this file finishes
// (same pattern as task-list-scan.test.ts).
const REAL_CLIENT = { ...realClient }
const REAL_CONFIG = { ...realConfig }

const EXIT_USAGE = 2
const DEFAULT_WORKSPACE = '123'
const USER_TASK_LIST_GID = '777'

const TASKS = [
  { gid: '1', name: 'A', completed: false, assignee: { gid: '10', name: 'Alice' } },
  { gid: '2', name: 'B', completed: true, assignee: { gid: '10', name: 'Alice' } },
  { gid: '3', name: 'C', completed: false, assignee: null },
]

/**
 * `task list --section | --tag | --my-tasks` (issue #106): routing to the
 * right endpoint, request params, interaction with the scan options, and the
 * usage errors (exit 2, no API call) for conflicting/missing flags.
 */
describe('task list sources', () => {
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

  function record(method: string, result: any) {
    return async (...args: any[]) => {
      calls.push({ method, args })
      return result
    }
  }

  async function runList(args: string[], opts: { workspace?: string, format?: string } = {}): Promise<string> {
    mock.module('../../src/lib/asana-client', () => ({
      getAsanaClient: () => ({
        tasks: {
          findByProject: record('findByProject', { data: TASKS }),
          findAll: record('findAll', { data: TASKS }),
          findBySection: record('findBySection', { data: TASKS }),
          findByTag: record('findByTag', { data: TASKS }),
          findByUserTaskList: record('findByUserTaskList', { data: TASKS }),
        },
        userTaskLists: {
          findByUser: record('findByUser', { gid: USER_TASK_LIST_GID }),
        },
        users: {
          me: async () => ({ gid: '10', name: 'Alice' }),
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

    await program.parseAsync(['--format', opts.format ?? 'json', 'task', 'list', ...args], { from: 'user' })
    return logs.join('\n')
  }

  function stdoutError(): any {
    return JSON.parse(String(writeSpy.mock.calls[0]?.[1]))
  }

  function callOf(method: string) {
    return calls.find(call => call.method === method)
  }

  test('--section lists the section tasks through findBySection', async () => {
    const out = await runList(['--section', '555'])

    expect(calls.map(call => call.method)).toEqual(['findBySection'])
    expect(callOf('findBySection')!.args[0]).toBe('555')
    expect(JSON.parse(out).tasks.map((t: any) => t.gid)).toEqual(['1', '2', '3'])
  })

  test('--tag lists the tag tasks through findByTag', async () => {
    const out = await runList(['--tag', '444'])

    expect(calls.map(call => call.method)).toEqual(['findByTag'])
    expect(callOf('findByTag')!.args[0]).toBe('444')
    expect(JSON.parse(out).tasks).toHaveLength(3)
  })

  test('--tag --incomplete-only omits completed_since and filters client-side', async () => {
    const out = await runList(['--tag', '444', '--incomplete-only'])

    const params = callOf('findByTag')!.args[1]
    expect(params.completed_since).toBeUndefined()
    expect(params.opt_fields.split(',')).toContain('completed')
    expect(JSON.parse(out).tasks.map((t: any) => t.gid)).toEqual(['1', '3'])
  })

  test('--section --incomplete-only sends completed_since=now', async () => {
    await runList(['--section', '555', '--incomplete-only'])

    expect(callOf('findBySection')!.args[1].completed_since).toBe('now')
  })

  test('--my-tasks resolves the user task list for the default workspace', async () => {
    const out = await runList(['--my-tasks'])

    expect(calls.map(call => call.method)).toEqual(['findByUser', 'findByUserTaskList'])
    expect(callOf('findByUser')!.args).toEqual(['me', DEFAULT_WORKSPACE])
    expect(callOf('findByUserTaskList')!.args[0]).toBe(USER_TASK_LIST_GID)
    expect(JSON.parse(out).tasks).toHaveLength(3)
  })

  test('--my-tasks prefers --workspace over the configured default', async () => {
    await runList(['--my-tasks', '--workspace', '999'])

    expect(callOf('findByUser')!.args).toEqual(['me', '999'])
  })

  test('--my-tasks without any workspace is a usage error before any API call', async () => {
    await expect(runList(['--my-tasks'], { workspace: undefined })).rejects.toThrow('__exit__')

    expect(exitSpy).toHaveBeenCalledWith(EXIT_USAGE)
    expect(stdoutError().code).toBe(ERROR_IDS.MISSING_REQUIRED_OPTION)
    expect(calls).toHaveLength(0)
  })

  test.each([
    [['--project', '1', '--section', '2'], ['--project', '--section']],
    [['--section', '2', '--tag', '3'], ['--section', '--tag']],
    [['--tag', '3', '--my-tasks'], ['--tag', '--my-tasks']],
    [['--project', '1', '--my-tasks'], ['--project', '--my-tasks']],
  ])('conflicting sources %p exit 2 with CONFLICTING_OPTIONS and no API call', async (args, flags) => {
    await expect(runList(args)).rejects.toThrow('__exit__')

    expect(exitSpy).toHaveBeenCalledWith(EXIT_USAGE)
    const payload = stdoutError()
    expect(payload.code).toBe(ERROR_IDS.CONFLICTING_OPTIONS)
    expect(payload.context.flags).toEqual(flags)
    expect(calls).toHaveLength(0)
  })

  test('--assignee none filters a section client-side', async () => {
    const out = await runList(['--section', '555', '--assignee', 'none'])

    expect(callOf('findBySection')!.args[1].opt_fields.split(',')).toContain('assignee.gid')
    expect(JSON.parse(out).tasks.map((t: any) => t.gid)).toEqual(['3'])
  })

  test('--assignee me filters My Tasks client-side', async () => {
    const out = await runList(['--my-tasks', '--assignee', 'me'])

    expect(JSON.parse(out).tasks.map((t: any) => t.gid)).toEqual(['1', '2'])
  })

  test('--count works with a tag source', async () => {
    const out = await runList(['--tag', '444', '--count'])

    expect(JSON.parse(out)).toEqual({ summary: { total: 3 } })
  })

  test('--group-by completed works with a section source', async () => {
    const out = await runList(['--section', '555', '--group-by', 'completed'])

    expect(JSON.parse(out).summary.groups).toEqual([
      { completed: 'incomplete', count: 2 },
      { completed: 'completed', count: 1 },
    ])
  })

  test('--fields flattens rows for a section source', async () => {
    const out = await runList(['--section', '555', '--fields', 'completed,assignee'])

    expect(JSON.parse(out).tasks[0]).toEqual({ gid: '1', name: 'A', completed: false, assignee: 'Alice' })
  })

  test('toon format is honored for a section source', async () => {
    const out = await runList(['--section', '555'], { format: 'toon' })

    expect(() => JSON.parse(out)).toThrow()
    expect(out).toContain('tasks[3')
  })

  test('plain format is honored for a section source', async () => {
    const out = await runList(['--section', '555'], { format: 'plain' })

    expect(() => JSON.parse(out)).toThrow()
    expect(out).toContain('gid')
  })
})
