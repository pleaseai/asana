import { beforeEach, describe, expect, test } from 'bun:test'
import { ERROR_IDS } from '../../src/constants/errorIds'
import { useTaskCliHarness } from './helpers/task-cli-harness'

const EXIT_USAGE = 2
const DEFAULT_WORKSPACE = '123'
const TASKS = [
  { gid: '1', name: 'A', assignee: { gid: '10', name: 'Alice' } },
  { gid: '2', name: 'B', assignee: null },
]

/**
 * `task list --assignee` without a container source (issue #122): the
 * workspace listing endpoint needs a workspace, so a missing one is a usage
 * error (exit 2, no API call) instead of a failed API request.
 */
describe('task list --assignee workspace requirement', () => {
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

  async function runList(args: string[], workspace?: string): Promise<string> {
    harness.mockModules(
      {
        getAsanaClient: () => ({
          tasks: {
            findAll: record('findAll', { data: TASKS }),
            findBySection: record('findBySection', { data: TASKS }),
          },
          users: { me: async () => ({ gid: '10', name: 'Alice' }) },
        }),
      },
      { loadConfig: () => ({ workspace }) },
    )
    return harness.runTask(['list', ...args])
  }

  test.each(['me', 'none', '10'])('--assignee %s without any workspace exits 2 before any API call', async (assignee) => {
    await expect(runList(['--assignee', assignee])).rejects.toThrow('__exit__')

    expect(harness.exitSpy).toHaveBeenCalledWith(EXIT_USAGE)
    expect(harness.stdoutError()).toMatchObject({
      code: ERROR_IDS.MISSING_REQUIRED_OPTION,
      context: { option: '--workspace' },
    })
    expect(calls).toHaveLength(0)
  })

  test('--assignee with the configured default workspace lists through findAll', async () => {
    const out = await runList(['--assignee', 'me'], DEFAULT_WORKSPACE)

    expect(calls.map(call => call.method)).toEqual(['findAll'])
    expect(calls[0]!.args[0]).toMatchObject({ assignee: 'me', workspace: DEFAULT_WORKSPACE })
    expect(JSON.parse(out).tasks).toHaveLength(TASKS.length)
  })

  test('--assignee on a section source needs no workspace (filtered client-side)', async () => {
    const out = await runList(['--section', '555', '--assignee', 'none'])

    expect(calls.map(call => call.method)).toEqual(['findBySection'])
    expect(JSON.parse(out).tasks.map((t: any) => t.gid)).toEqual(['2'])
  })
})
