import type { BenchContext, BenchTask, Condition, RunRecord } from './types'
import { randomUUID } from 'node:crypto'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import { AsanaClient } from './asana'
import { runClaude } from './claude'
import { resolveConditions } from './conditions'
import { printReport } from './report'
import { resolveTasks } from './tasks'

const RESULTS_DIR = join(import.meta.dir, '..', 'results')

interface CliOptions {
  conditions: Condition[]
  tasks: BenchTask[]
  runs: number
  model: string
  maxTurns: number
  timeoutMs: number
  session: string
  workspace?: string
  project?: string
  keepTasks: boolean
  dryRun: boolean
}

function parseCliOptions(): CliOptions {
  const { values } = parseArgs({
    options: {
      'conditions': { type: 'string' },
      'tasks': { type: 'string' },
      'runs': { type: 'string', default: '3' },
      'model': { type: 'string', default: 'sonnet' },
      'workspace': { type: 'string' },
      'project': { type: 'string' },
      'session': { type: 'string' },
      'max-turns': { type: 'string', default: '40' },
      'timeout-min': { type: 'string', default: '10' },
      'keep-tasks': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
    },
  })

  const runs = Number(values.runs)
  const maxTurns = Number(values['max-turns'])
  const timeoutMinutes = Number(values['timeout-min'])
  if (!Number.isInteger(runs) || runs < 1) {
    throw new Error(`Invalid --runs value: ${values.runs}`)
  }
  if (!Number.isFinite(maxTurns) || maxTurns < 1) {
    throw new Error(`Invalid --max-turns value: ${values['max-turns']}`)
  }
  if (!Number.isFinite(timeoutMinutes) || timeoutMinutes <= 0) {
    throw new Error(`Invalid --timeout-min value: ${values['timeout-min']}`)
  }

  return {
    conditions: resolveConditions(values.conditions?.split(',')),
    tasks: resolveTasks(values.tasks?.split(',')),
    runs,
    model: values.model!,
    maxTurns,
    timeoutMs: timeoutMinutes * 60_000,
    session: values.session ?? new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16),
    workspace: values.workspace,
    project: values.project ?? process.env.BENCH_PROJECT_GID,
    keepTasks: values['keep-tasks']!,
    dryRun: values['dry-run']!,
  }
}

async function resolveWorkspace(
  client: AsanaClient,
  requested?: string,
): Promise<{ workspaceGid: string, workspaceName: string }> {
  const workspaces = await client.workspaces()
  const workspaceGid = requested ?? process.env.BENCH_WORKSPACE_GID ?? workspaces[0]?.gid
  if (!workspaceGid) {
    throw new Error('No Asana workspace available')
  }
  return {
    workspaceGid,
    workspaceName: workspaces.find(w => w.gid === workspaceGid)?.name ?? workspaceGid,
  }
}

async function main(): Promise<void> {
  const opts = parseCliOptions()
  const client = await AsanaClient.create()
  const me = await client.me()
  const { workspaceGid, workspaceName } = await resolveWorkspace(client, opts.workspace)

  if (opts.dryRun) {
    console.log(`session=${opts.session} model=${opts.model} workspace=${workspaceName} project=${opts.project ?? '(would create a new bench project)'}`)
    console.log(`conditions=[${opts.conditions.map(c => c.name).join(', ')}] tasks=[${opts.tasks.map(t => t.id).join(', ')}] runs=${opts.runs}`)
    console.log('Dry run — no sessions started.')
    return
  }

  const projectGid = opts.project ?? await createBenchProject(client, workspaceGid, opts.session)
  const projectName = (await client.getProject(projectGid)).name

  console.log(`session=${opts.session} model=${opts.model} workspace=${workspaceName} project=${projectName}`)
  console.log(`conditions=[${opts.conditions.map(c => c.name).join(', ')}] tasks=[${opts.tasks.map(t => t.id).join(', ')}] runs=${opts.runs}`)

  mkdirSync(RESULTS_DIR, { recursive: true })
  const resultsFile = join(RESULTS_DIR, `${opts.session}.jsonl`)

  const base = { workspaceGid, workspaceName, projectGid, projectName, meGid: me.gid }
  await runBenchmarkLoop(client, base, opts, resultsFile)

  console.log(`\nResults written to ${resultsFile}\n`)
  await printReport([resultsFile])
}

async function runBenchmarkLoop(
  client: AsanaClient,
  base: Omit<BenchContext, 'prefix'>,
  opts: CliOptions,
  resultsFile: string,
): Promise<void> {
  for (let iteration = 1; iteration <= opts.runs; iteration++) {
    for (const task of opts.tasks) {
      for (const condition of opts.conditions) {
        const ctx: BenchContext = { prefix: `BM-${randomUUID().slice(0, 5)}`, ...base }
        const label = `[${iteration}/${opts.runs}] ${task.id} × ${condition.name}`
        console.log(`${label} — seeding (${ctx.prefix})`)
        const seededGids = await task.seed(ctx)
        try {
          await executeRun({ ctx, task, condition, opts, resultsFile, label, iteration })
        }
        finally {
          if (!opts.keepTasks) {
            await cleanup(client, ctx, seededGids)
          }
        }
      }
    }
  }
}

interface RunParams {
  ctx: BenchContext
  task: BenchTask
  condition: Condition
  opts: CliOptions
  resultsFile: string
  label: string
  iteration: number
}

async function executeRun({ ctx, task, condition, opts, resultsFile, label, iteration }: RunParams): Promise<void> {
  console.log(`${label} — running claude`)
  const metrics = await runClaude({
    prompt: task.prompt(ctx),
    condition,
    model: opts.model,
    maxTurns: opts.maxTurns,
    timeoutMs: opts.timeoutMs,
  })

  const verdict = metrics.isError
    ? { success: false, detail: `claude error: ${metrics.subtype}` }
    : await task.verify(ctx, metrics.resultText)

  const record: RunRecord = {
    timestamp: new Date().toISOString(),
    session: opts.session,
    condition: condition.name,
    task: task.id,
    iteration,
    model: opts.model,
    success: verdict.success,
    verifyDetail: verdict.detail,
    ...metrics,
  }
  appendFileSync(resultsFile, `${JSON.stringify(record)}\n`)

  const status = verdict.success ? 'PASS' : 'FAIL'
  console.log(`${label} — ${status} | $${metrics.costUsd.toFixed(4)} | ${(metrics.durationMs / 1000).toFixed(1)}s | ${metrics.numTurns} turns | ${metrics.totalToolCalls} tool calls`)
  if (!verdict.success) {
    console.log(`${label} — detail: ${verdict.detail}`)
  }
}

async function createBenchProject(client: AsanaClient, workspaceGid: string, session: string): Promise<string> {
  const teams = await client.myTeams(workspaceGid).catch(() => [])
  const project = await client.createProject(
    workspaceGid,
    `Interface Bench ${session}`,
    teams[0]?.gid,
  )
  console.log(`Created bench project "${project.name}" (${project.gid}) — reuse it with --project ${project.gid}`)
  return project.gid
}

async function cleanup(client: AsanaClient, ctx: BenchContext, seededGids: string[]): Promise<void> {
  const gids = new Set(seededGids)
  const remaining = await client.tasksInProject(ctx.projectGid).catch(() => [] as Awaited<ReturnType<AsanaClient['tasksInProject']>>)
  for (const task of remaining) {
    if (typeof task.name === 'string' && task.name.startsWith(ctx.prefix)) {
      gids.add(task.gid)
    }
  }
  await Promise.all([...gids].map(gid =>
    client.deleteTask(gid).catch((err: Error) =>
      console.warn(`cleanup: failed to delete ${gid}: ${err.message}`),
    ),
  ))
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
