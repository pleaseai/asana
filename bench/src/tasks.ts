import type { BenchContext, BenchTask, VerifyResult } from './types'
import { AsanaClient } from './asana'

function pass(detail: string): VerifyResult {
  return { success: true, detail }
}

function fail(detail: string): VerifyResult {
  return { success: false, detail }
}

async function findByName(client: AsanaClient, ctx: BenchContext, name: string) {
  const tasks = await client.tasksInProject(ctx.projectGid)
  return tasks.find(t => t.name === name)
}

/**
 * T1 — single read: locate one task and extract a field.
 * Measures discovery cost (workspace → project → task) plus one read.
 */
const readLookup: BenchTask = {
  id: 'read_lookup',
  description: 'Find a task by name and report its due date',
  async seed(ctx) {
    const client = await AsanaClient.create()
    const task = await client.createTask({
      name: `${ctx.prefix} Fix login flow`,
      notes: 'Reported by QA. Login form rejects valid credentials.',
      due_on: '2026-07-20',
      projects: [ctx.projectGid],
    })
    return [task.gid]
  },
  prompt(ctx) {
    return `In the Asana workspace "${ctx.workspaceName}", project "${ctx.projectName}", find the task named "${ctx.prefix} Fix login flow" and reply with exactly its due date in YYYY-MM-DD format and nothing else.`
  },
  async verify(_ctx, resultText) {
    if (resultText.includes('2026-07-20')) {
      return pass('due date 2026-07-20 present in answer')
    }
    return fail(`expected 2026-07-20 in answer, got: ${resultText.slice(0, 200)}`)
  },
}

/**
 * T2 — single write: create a task with several fields set.
 * Verified against ground truth, not against the agent's claim.
 */
const writeCreate: BenchTask = {
  id: 'write_create',
  description: 'Create a task with name, due date, and notes',
  async seed() {
    return []
  },
  prompt(ctx) {
    return `In the Asana workspace "${ctx.workspaceName}", project "${ctx.projectName}", create a task named "${ctx.prefix} Release checklist" with due date 2026-07-25 and notes "Created by interface benchmark". Reply "done" when finished.`
  },
  async verify(ctx) {
    const client = await AsanaClient.create()
    const task = await findByName(client, ctx, `${ctx.prefix} Release checklist`)
    if (!task) {
      return fail('task not found in project')
    }
    if (task.due_on !== '2026-07-25') {
      return fail(`due_on is ${task.due_on}, expected 2026-07-25`)
    }
    if (!String(task.notes ?? '').includes('benchmark')) {
      return fail(`notes missing "benchmark": ${String(task.notes).slice(0, 100)}`)
    }
    return pass(`task ${task.gid} created with correct fields`)
  },
}

/**
 * T3 — multi-step mutation: find a task among siblings, complete it,
 * and add a comment. Measures chained read → write → write.
 */
const multiStep: BenchTask = {
  id: 'multi_step',
  description: 'Complete a specific task and add a comment',
  async seed(ctx) {
    const client = await AsanaClient.create()
    const names = ['Deploy hotfix', 'Update docs', 'Refactor auth']
    const gids: string[] = []
    for (const name of names) {
      const task = await client.createTask({
        name: `${ctx.prefix} ${name}`,
        projects: [ctx.projectGid],
      })
      gids.push(task.gid)
    }
    return gids
  },
  prompt(ctx) {
    return `In the Asana workspace "${ctx.workspaceName}", project "${ctx.projectName}", find the incomplete task named "${ctx.prefix} Deploy hotfix", mark it complete, and add the comment "Completed via benchmark." to it. Reply "done" when finished.`
  },
  async verify(ctx) {
    const client = await AsanaClient.create()
    const task = await findByName(client, ctx, `${ctx.prefix} Deploy hotfix`)
    if (!task) {
      return fail('target task not found')
    }
    if (!task.completed) {
      return fail('task is not completed')
    }
    const stories = await client.stories(task.gid)
    const comment = stories.find(s => s.type === 'comment' && s.text?.includes('Completed via benchmark'))
    if (!comment) {
      return fail('comment "Completed via benchmark." not found')
    }
    return pass(`task ${task.gid} completed with comment`)
  },
}

/**
 * T4 — aggregation: count tasks across two dimensions and answer as JSON.
 * Measures how well the interface supports scanning + client-side reasoning.
 */
const aggregate: BenchTask = {
  id: 'aggregate',
  description: 'Count incomplete tasks by assignment and answer as JSON',
  async seed(ctx) {
    const client = await AsanaClient.create()
    const gids: string[] = []
    const specs = [
      { name: 'Ship v2 API', assignee: ctx.meGid, completed: false },
      { name: 'Review PR queue', assignee: ctx.meGid, completed: false },
      { name: 'Write onboarding doc', assignee: null, completed: false },
      { name: 'Clean stale branches', assignee: null, completed: false },
      { name: 'Archive old sprint', assignee: null, completed: true },
    ]
    for (const spec of specs) {
      const task = await client.createTask({
        name: `${ctx.prefix} ${spec.name}`,
        projects: [ctx.projectGid],
        completed: spec.completed,
        ...(spec.assignee ? { assignee: spec.assignee } : {}),
      })
      gids.push(task.gid)
    }
    return gids
  },
  prompt(ctx) {
    return `In the Asana workspace "${ctx.workspaceName}", project "${ctx.projectName}", consider only tasks whose name starts with "${ctx.prefix}". Among the INCOMPLETE ones, count how many are assigned to me (the authenticated user) and how many are unassigned. Reply with ONLY this JSON and nothing else: {"assigned_to_me": <n>, "unassigned": <n>}`
  },
  async verify(_ctx, resultText) {
    const match = resultText.match(/\{[^{}]*"assigned_to_me"[^{}]*\}/)
    if (!match) {
      return fail(`no JSON answer found in: ${resultText.slice(0, 200)}`)
    }
    let parsed: { assigned_to_me?: number, unassigned?: number }
    try {
      parsed = JSON.parse(match[0])
    }
    catch {
      return fail(`unparseable JSON: ${match[0]}`)
    }
    if (parsed.assigned_to_me === 2 && parsed.unassigned === 2) {
      return pass('counts correct (2 assigned, 2 unassigned)')
    }
    return fail(`expected {assigned_to_me:2, unassigned:2}, got ${match[0]}`)
  },
}

export const TASKS: BenchTask[] = [readLookup, writeCreate, multiStep, aggregate]

export function resolveTasks(ids?: string[]): BenchTask[] {
  if (!ids || ids.length === 0) {
    return TASKS
  }
  return ids.map((id) => {
    const task = TASKS.find(t => t.id === id)
    if (!task) {
      throw new Error(`Unknown task "${id}". Available: ${TASKS.map(t => t.id).join(', ')}`)
    }
    return task
  })
}
