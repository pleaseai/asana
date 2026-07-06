import type { BenchContext, RunRecord } from './types'
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

async function main(): Promise<void> {
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

  const conditions = resolveConditions(values.conditions?.split(','))
  const tasks = resolveTasks(values.tasks?.split(','))
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
  const model = values.model!
  const timeoutMs = timeoutMinutes * 60_000
  const session = values.session ?? new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)

  const client = await AsanaClient.create()
  const me = await client.me()

  const workspaces = await client.workspaces()
  const workspaceGid = values.workspace ?? process.env.BENCH_WORKSPACE_GID ?? workspaces[0]?.gid
  if (!workspaceGid) {
    throw new Error('No Asana workspace available')
  }
  const workspaceName = workspaces.find(w => w.gid === workspaceGid)?.name ?? workspaceGid

  const givenProject = values.project ?? process.env.BENCH_PROJECT_GID

  if (values['dry-run']) {
    console.log(`session=${session} model=${model} workspace=${workspaceName} project=${givenProject ?? '(would create a new bench project)'}`)
    console.log(`conditions=[${conditions.map(c => c.name).join(', ')}] tasks=[${tasks.map(t => t.id).join(', ')}] runs=${runs}`)
    console.log('Dry run — no sessions started.')
    return
  }

  const projectGid = givenProject ?? await createBenchProject(client, workspaceGid, session)
  const projectName = (await client.getProject(projectGid)).name

  console.log(`session=${session} model=${model} workspace=${workspaceName} project=${projectName}`)
  console.log(`conditions=[${conditions.map(c => c.name).join(', ')}] tasks=[${tasks.map(t => t.id).join(', ')}] runs=${runs}`)

  mkdirSync(RESULTS_DIR, { recursive: true })
  const resultsFile = join(RESULTS_DIR, `${session}.jsonl`)

  for (let iteration = 1; iteration <= runs; iteration++) {
    for (const task of tasks) {
      for (const condition of conditions) {
        const prefix = `BM-${randomUUID().slice(0, 5)}`
        const ctx: BenchContext = {
          prefix,
          workspaceGid,
          workspaceName,
          projectGid,
          projectName,
          meGid: me.gid,
        }

        const label = `[${iteration}/${runs}] ${task.id} × ${condition.name}`
        console.log(`${label} — seeding (${prefix})`)
        const seededGids = await task.seed(ctx)

        console.log(`${label} — running claude`)
        const metrics = await runClaude({
          prompt: task.prompt(ctx),
          condition,
          model,
          maxTurns,
          timeoutMs,
        })

        const verdict = metrics.isError
          ? { success: false, detail: `claude error: ${metrics.subtype}` }
          : await task.verify(ctx, metrics.resultText)

        const record: RunRecord = {
          timestamp: new Date().toISOString(),
          session,
          condition: condition.name,
          task: task.id,
          iteration,
          model,
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

        if (!values['keep-tasks']) {
          await cleanup(client, ctx, seededGids)
        }
      }
    }
  }

  console.log(`\nResults written to ${resultsFile}\n`)
  await printReport([resultsFile])
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
