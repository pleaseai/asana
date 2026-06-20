import { afterEach, describe, expect, mock, test } from 'bun:test'

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
})
