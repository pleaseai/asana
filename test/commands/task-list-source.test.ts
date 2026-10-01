import { beforeEach, describe, expect, test } from 'bun:test'
import { ERROR_IDS } from '../../src/constants/errorIds'
import { useTaskCliHarness } from './helpers/task-cli-harness'

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
  const harness = useTaskCliHarness()

  beforeEach(() => {
    calls = []
  })

  function record(method: string, result: any) {
    return async (...args: any[]) => {
      calls.push({ method, args })
      return result
    }
  }

  async function runList(
    args: string[],
    opts: { workspace?: string, format?: string, tasks?: any[], pages?: Record<string, any> } = {},
  ): Promise<string> {
    // `pages` maps an offset ('' = first page) to a Collection-shaped result,
    // so multi-page sources can be exercised through the same wrapper.
    const paged = (method: string) => async (...args: any[]) => {
      calls.push({ method, args })
      return opts.pages![args[1]?.offset ?? '']
    }
    const source = (method: string) => opts.pages ? paged(method) : record(method, { data: opts.tasks ?? TASKS })
    harness.mockModules(
      {
        getAsanaClient: () => ({
          tasks: {
            findByProject: record('findByProject', { data: opts.tasks ?? TASKS }),
            findAll: record('findAll', { data: opts.tasks ?? TASKS }),
            findBySection: source('findBySection'),
            findByTag: source('findByTag'),
            findByUserTaskList: source('findByUserTaskList'),
          },
          userTaskLists: {
            findByUser: record('findByUser', { gid: USER_TASK_LIST_GID }),
          },
          users: {
            me: async () => ({ gid: '10', name: 'Alice' }),
          },
        }),
      },
      {
        loadConfig: () => ({ workspace: 'workspace' in opts ? opts.workspace : DEFAULT_WORKSPACE }),
      },
    )

    return harness.runTask(['list', ...args], opts.format)
  }

  const stdoutError = () => harness.stdoutError()

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

  test('--tag with deprecated -c excludes completed tasks client-side', async () => {
    const out = await runList(['--tag', '444', '-c'])

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

    expect(harness.exitSpy).toHaveBeenCalledWith(EXIT_USAGE)
    expect(stdoutError().code).toBe(ERROR_IDS.MISSING_REQUIRED_OPTION)
    expect(calls).toHaveLength(0)
  })

  const page = (tasks: any[], nextOffset?: string) => ({
    data: tasks,
    _response: { next_page: nextOffset ? { offset: nextOffset } : null },
  })

  test('--section follows next_page.offset and returns the tasks of every page', async () => {
    const out = await runList(['--section', '555'], {
      pages: { '': page([TASKS[0]!], 'o2'), 'o2': page([TASKS[1]!, TASKS[2]!]) },
    })

    expect(calls.map(call => call.method)).toEqual(['findBySection', 'findBySection'])
    expect(calls[1]!.args[0]).toBe('555')
    expect(calls[1]!.args[1].offset).toBe('o2')
    expect(JSON.parse(out).tasks.map((t: any) => t.gid)).toEqual(['1', '2', '3'])
  })

  test('--count on a multi-page tag counts every page', async () => {
    const out = await runList(['--tag', '444', '--count'], {
      pages: { '': page([TASKS[0]!], 'o2'), 'o2': page([TASKS[1]!], 'o3'), 'o3': page([TASKS[2]!]) },
    })

    expect(calls.map(call => call.method)).toEqual(['findByTag', 'findByTag', 'findByTag'])
    expect(JSON.parse(out)).toEqual({ summary: { total: 3 } })
  })

  test('--my-tasks pages through the user task list and filters client-side across pages', async () => {
    const out = await runList(['--my-tasks', '--assignee', 'none'], {
      pages: { '': page([TASKS[0]!], 'o2'), 'o2': page([TASKS[2]!]) },
    })

    expect(calls.map(call => call.method)).toEqual(['findByUser', 'findByUserTaskList', 'findByUserTaskList'])
    expect(calls[2]!.args[1].offset).toBe('o2')
    expect(JSON.parse(out).tasks.map((t: any) => t.gid)).toEqual(['3'])
  })

  test('a server repeating the same offset stops paging instead of looping forever', async () => {
    const out = await runList(['--section', '555'], {
      pages: { '': page([TASKS[0]!], 'o2'), 'o2': page([TASKS[1]!], 'o2') },
    })

    expect(calls).toHaveLength(2)
    expect(JSON.parse(out).tasks.map((t: any) => t.gid)).toEqual(['1', '2'])
  })

  test('--my-tasks with an explicitly empty --workspace is a usage error, not a default-workspace lookup', async () => {
    await expect(runList(['--my-tasks', '--workspace', ''])).rejects.toThrow('__exit__')

    expect(harness.exitSpy).toHaveBeenCalledWith(EXIT_USAGE)
    expect(stdoutError()).toMatchObject({ code: ERROR_IDS.MISSING_REQUIRED_OPTION, context: { option: '--workspace' } })
    expect(calls).toHaveLength(0)
  })

  test.each([
    [['--project', '1', '--section', '2'], ['--project', '--section']],
    [['--section', '2', '--tag', '3'], ['--section', '--tag']],
    [['--tag', '3', '--my-tasks'], ['--tag', '--my-tasks']],
    [['--project', '1', '--my-tasks'], ['--project', '--my-tasks']],
  ])('conflicting sources %p exit 2 with CONFLICTING_OPTIONS and no API call', async (args, flags) => {
    await expect(runList(args)).rejects.toThrow('__exit__')

    expect(harness.exitSpy).toHaveBeenCalledWith(EXIT_USAGE)
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

  test('an empty result is a definitive empty list for json', async () => {
    const out = await runList(['--section', '555'], { tasks: [] })

    expect(JSON.parse(out)).toEqual({ tasks: [] })
  })

  test('an empty result is a structured empty list for toon', async () => {
    const out = await runList(['--tag', '444'], { format: 'toon', tasks: [] })

    expect(out).toContain('tasks[0')
    expect(out).not.toContain('No tasks found')
  })

  test('an empty result keeps the human message for plain', async () => {
    const out = await runList(['--section', '555'], { format: 'plain', tasks: [] })

    expect(out).toContain('No tasks found')
  })
})
