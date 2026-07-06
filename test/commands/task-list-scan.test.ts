import { afterAll, afterEach, describe, expect, mock, test } from 'bun:test'
import { Command } from 'commander'
import * as realClient from '../../src/lib/asana-client'
import * as realConfig from '../../src/lib/config'

// Bun's `mock.restore()` does NOT revert `mock.module()` registrations —
// capture the real modules and re-install them when this file finishes
// (same pattern as task-list-format.test.ts).
const REAL_CLIENT = { ...realClient }
const REAL_CONFIG = { ...realConfig }

/**
 * Scan-style `task list` options (issue #88): `--fields`, completion filters,
 * `--assignee none`, `--count`, `--group-by`. Verifies both the request
 * parameters sent to the API (opt_fields, completed_since) and the shaped
 * output, using a mocked Asana client.
 */
describe('task list scan options', () => {
  afterEach(() => {
    mock.restore()
  })

  afterAll(() => {
    mock.module('../../src/lib/asana-client', () => REAL_CLIENT)
    mock.module('../../src/lib/config', () => REAL_CONFIG)
  })

  const PROJECT_TASKS = [
    { gid: '1', name: 'A', completed: false, assignee: { gid: '10', name: 'Alice' }, due_on: '2026-07-01' },
    { gid: '2', name: 'B', completed: true, assignee: { gid: '10', name: 'Alice' }, due_on: null },
    { gid: '3', name: 'C', completed: false, assignee: null, due_on: null },
  ]

  async function runList(args: string[]): Promise<{ out: string, calls: any[] }> {
    const calls: any[] = []
    mock.module('../../src/lib/asana-client', () => ({
      getAsanaClient: () => ({
        tasks: {
          findByProject: async (projectGid: string, opts: any) => {
            calls.push({ method: 'findByProject', projectGid, opts })
            return { data: PROJECT_TASKS }
          },
          findAll: async (opts: any) => {
            calls.push({ method: 'findAll', opts })
            return { data: PROJECT_TASKS }
          },
        },
        users: {
          me: async () => ({ gid: '10', name: 'Alice' }),
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
    console.log = (...logArgs: any[]) => {
      logs.push(logArgs.join(' '))
    }
    try {
      await program.parseAsync(['--format', 'json', 'task', 'list', ...args], { from: 'user' })
    }
    finally {
      console.log = original
    }
    return { out: logs.join('\n'), calls }
  }

  test('--fields expands opt_fields and flattens rows', async () => {
    const { out, calls } = await runList(['-p', '99', '--fields', 'completed,assignee,due_on'])
    const optFields = calls[0].opts.opt_fields.split(',')
    expect(optFields).toContain('completed')
    expect(optFields).toContain('due_on')
    expect(optFields).toContain('assignee.name')

    const { tasks } = JSON.parse(out)
    expect(tasks).toEqual([
      { gid: '1', name: 'A', completed: false, assignee: 'Alice', due_on: '2026-07-01' },
      { gid: '2', name: 'B', completed: true, assignee: 'Alice', due_on: null },
      { gid: '3', name: 'C', completed: false, assignee: null, due_on: null },
    ])
  })

  test('--incomplete-only filters server-side and client-side', async () => {
    const { out, calls } = await runList(['-p', '99', '--incomplete-only'])
    expect(calls[0].opts.completed_since).toBe('now')
    const { tasks } = JSON.parse(out)
    expect(tasks.map((t: any) => t.gid)).toEqual(['1', '3'])
    expect(tasks.every((t: any) => t.completed === false)).toBe(true)
  })

  test('--completed-only keeps only completed tasks', async () => {
    const { out } = await runList(['-p', '99', '--completed-only'])
    const { tasks } = JSON.parse(out)
    expect(tasks.map((t: any) => t.gid)).toEqual(['2'])
  })

  test('--assignee none keeps only unassigned tasks in a project', async () => {
    const { out } = await runList(['-p', '99', '--assignee', 'none'])
    const { tasks } = JSON.parse(out)
    expect(tasks.map((t: any) => t.gid)).toEqual(['3'])
  })

  test('--assignee me resolves the current user for project listings', async () => {
    const { out } = await runList(['-p', '99', '--assignee', 'me'])
    const { tasks } = JSON.parse(out)
    expect(tasks.map((t: any) => t.gid)).toEqual(['1', '2'])
  })

  test('--count returns only the total', async () => {
    const { out } = await runList(['-p', '99', '--count'])
    expect(JSON.parse(out)).toEqual({ summary: { total: 3 } })
  })

  test('--incomplete-only --group-by assignee aggregates in one call', async () => {
    const { out, calls } = await runList(['-p', '99', '--incomplete-only', '--group-by', 'assignee'])
    expect(calls).toHaveLength(1)
    expect(JSON.parse(out)).toEqual({
      summary: {
        total: 2,
        groups: [
          { assignee: 'Alice', count: 1 },
          { assignee: 'unassigned', count: 1 },
        ],
      },
    })
  })

  test('plain listing keeps the legacy request shape (no opt_fields)', async () => {
    const { calls } = await runList(['-a', 'me'])
    expect(calls[0].method).toBe('findAll')
    expect(calls[0].opts.opt_fields).toBeUndefined()
    expect(calls[0].opts.assignee).toBe('me')
  })
})
