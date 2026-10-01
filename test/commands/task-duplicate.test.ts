import { encodeToon } from '@pleaseai/cli-toolkit/output'
import { beforeEach, describe, expect, test } from 'bun:test'
import { ERROR_IDS } from '../../src/constants/errorIds'
import { useTaskCliHarness } from './helpers/task-cli-harness'

const EXIT_FAILURE = 1
const EXIT_USAGE = 2
const JOB_WITH_TASK = { gid: '900', status: 'succeeded', new_task: { gid: '901', name: 'Copy' } }
const JOB_PENDING = { gid: '900', status: 'in_progress', new_task: null }

/** `task duplicate <gid> --name <name> [--include <fields>]` (issue #106). */
describe('task duplicate', () => {
  let calls: Array<{ gid: string, data: any }>
  const harness = useTaskCliHarness()

  beforeEach(() => {
    calls = []
  })

  async function runDuplicate(args: string[], opts: { job?: any, failWith?: any, format?: string } = {}): Promise<string> {
    harness.mockModules(
      {
        getAsanaClient: () => ({
          tasks: {
            duplicate: async (gid: string, data: any) => {
              calls.push({ gid, data })
              if (opts.failWith) {
                throw opts.failWith
              }
              return opts.job ?? JOB_WITH_TASK
            },
          },
        }),
      },
      {
        loadConfig: () => ({ workspace: '123' }),
      },
    )

    return harness.runTask(['duplicate', ...args], opts.format)
  }

  const stdoutError = () => harness.stdoutError()

  test('is registered with --name as a regular option', async () => {
    const { createTaskCommand } = await import('../../src/commands/task')
    const command = createTaskCommand().commands.find(cmd => cmd.name() === 'duplicate')!

    expect(command).toBeDefined()
    expect(command.options.find(opt => opt.long === '--name')?.mandatory).toBeFalsy()
  })

  test('a missing --name is a structured usage error before any API call', async () => {
    await expect(runDuplicate(['42'])).rejects.toThrow('__exit__')

    expect(harness.exitSpy).toHaveBeenCalledWith(EXIT_USAGE)
    const payload = stdoutError()
    expect(payload.code).toBe(ERROR_IDS.MISSING_REQUIRED_OPTION)
    expect(payload.context.option).toBe('--name')
    expect(calls).toHaveLength(0)
  })

  test('sends name and the comma-separated include list, trimming whitespace', async () => {
    await runDuplicate(['42', '--name', 'Copy', '--include', 'notes, subtasks ,'])

    expect(calls).toEqual([{ gid: '42', data: { name: 'Copy', include: 'notes,subtasks' } }])
  })

  test('omits include when the flag is absent', async () => {
    await runDuplicate(['42', '--name', 'Copy'])

    expect(calls[0]?.data).toEqual({ name: 'Copy' })
  })

  test('emits the job with the new task for machine formats', async () => {
    const out = await runDuplicate(['42', '--name', 'Copy'])

    expect(JSON.parse(out)).toEqual({
      job: { gid: '900', status: 'succeeded', new_task_gid: '901', new_task_name: 'Copy' },
    })
  })

  test('emits the job as TOON, identical to the encoded machine payload', async () => {
    const out = await runDuplicate(['42', '--name', 'Copy'], { format: 'toon' })

    expect(() => JSON.parse(out)).toThrow()
    expect(out).toBe(encodeToon({
      job: { gid: '900', status: 'succeeded', new_task_gid: '901', new_task_name: 'Copy' },
    }))
  })

  test('omits the new task fields while the job has no new task', async () => {
    const out = await runDuplicate(['42', '--name', 'Copy'], { job: JOB_PENDING })

    expect(JSON.parse(out)).toEqual({ job: { gid: '900', status: 'in_progress' } })
  })

  test('plain output names the job and the new task', async () => {
    const out = await runDuplicate(['42', '--name', 'Copy'], { format: 'plain' })

    expect(out).toContain('Duplicate job 900 succeeded (new task 901)')
  })

  test('plain output drops the parenthetical without a new task', async () => {
    const out = await runDuplicate(['42', '--name', 'Copy'], { format: 'plain', job: JOB_PENDING })

    expect(out).toContain('Duplicate job 900 in_progress')
    expect(out).not.toContain('new task')
  })

  test.each([
    ['an unknown value', 'notes,bogus'],
    ['an empty list', ' , '],
  ])('%s in --include is a usage error before any API call', async (_label, include) => {
    await expect(runDuplicate(['42', '--name', 'Copy', '--include', include])).rejects.toThrow('__exit__')

    expect(harness.exitSpy).toHaveBeenCalledWith(EXIT_USAGE)
    const payload = stdoutError()
    expect(payload.code).toBe(ERROR_IDS.INVALID_FIELD_NAME)
    expect(payload.context.allowed).toContain('subtasks')
    expect(calls).toHaveLength(0)
  })

  test('a non-numeric gid exits 1 before any API call', async () => {
    await expect(runDuplicate(['abc', '--name', 'Copy'])).rejects.toThrow('__exit__')

    expect(harness.exitSpy).toHaveBeenCalledWith(EXIT_FAILURE)
    expect(stdoutError().code).toBe(ERROR_IDS.INVALID_TASK_GID)
    expect(calls).toHaveLength(0)
  })

  test('an API error is reported as a structured Task duplication failure', async () => {
    await expect(runDuplicate(['42', '--name', 'Copy'], { failWith: { status: 403 } })).rejects.toThrow('__exit__')

    expect(harness.exitSpy).toHaveBeenCalledWith(EXIT_FAILURE)
    const payload = stdoutError()
    expect(payload.code).toBe(ERROR_IDS.PERMISSION_DENIED)
    expect(payload.context).toEqual({ 'Task GID': '42', 'Name': 'Copy' })
  })
})
