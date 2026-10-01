import { beforeEach, describe, expect, test } from 'bun:test'
import { ERROR_IDS } from '../../src/constants/errorIds'
import { useTaskCliHarness } from './helpers/task-cli-harness'

const EXIT_USAGE = 2
const DEFAULT_WORKSPACE = '123'
const TASK = { gid: '42', name: 'Fix login', completed: false, assignee: { name: 'Alice' }, due_on: null, notes: 'n' }

/** `task get <gid>` and `task get --custom-id <id>` (issue #106). */
describe('task get', () => {
  let calls: Array<{ method: string, args: any[] }>
  const harness = useTaskCliHarness()

  beforeEach(() => {
    calls = []
  })

  async function runGet(args: string[], opts: { workspace?: string, format?: string } = {}): Promise<any> {
    harness.mockModules(
      {
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
      },
      {
        loadConfig: () => ({ workspace: 'workspace' in opts ? opts.workspace : DEFAULT_WORKSPACE }),
      },
    )

    const out = await harness.runTask(['get', ...args], opts.format)
    return JSON.parse(out)
  }

  const stdoutError = () => harness.stdoutError()

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

    expect(harness.exitSpy).toHaveBeenCalledWith(EXIT_USAGE)
    expect(stdoutError().code).toBe(ERROR_IDS.CONFLICTING_OPTIONS)
    expect(calls).toHaveLength(0)
  })

  test('neither a gid nor --custom-id is a usage error before any API call', async () => {
    await expect(runGet([])).rejects.toThrow('__exit__')

    expect(harness.exitSpy).toHaveBeenCalledWith(EXIT_USAGE)
    expect(stdoutError().code).toBe(ERROR_IDS.MISSING_REQUIRED_OPTION)
    expect(calls).toHaveLength(0)
  })

  test('a non-numeric gid is rejected before any API call', async () => {
    await expect(runGet(['not-a-gid'])).rejects.toThrow('__exit__')

    expect(harness.exitSpy).toHaveBeenCalledWith(1)
    expect(stdoutError().code).toBe(ERROR_IDS.INVALID_TASK_GID)
    expect(calls).toHaveLength(0)
  })

  test('--custom-id with a non-numeric workspace is rejected before any API call', async () => {
    await expect(runGet(['--custom-id', 'PROJ-7', '--workspace', 'acme'])).rejects.toThrow('__exit__')

    expect(harness.exitSpy).toHaveBeenCalledWith(1)
    expect(stdoutError().context.fieldName).toBe('Workspace GID')
    expect(calls).toHaveLength(0)
  })

  test('--custom-id without any workspace is a usage error before any API call', async () => {
    await expect(runGet(['--custom-id', 'PROJ-7'], { workspace: undefined })).rejects.toThrow('__exit__')

    expect(harness.exitSpy).toHaveBeenCalledWith(EXIT_USAGE)
    expect(stdoutError().code).toBe(ERROR_IDS.MISSING_REQUIRED_OPTION)
    expect(calls).toHaveLength(0)
  })
})
