import type { RunRecord } from './types'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const RESULTS_DIR = join(import.meta.dir, '..', 'results')

function median(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0)
}

async function loadRecords(files: string[]): Promise<RunRecord[]> {
  const records: RunRecord[] = []
  for (const file of files) {
    const text = await Bun.file(file).text()
    for (const line of text.split('\n')) {
      if (!line.trim()) {
        continue
      }
      try {
        records.push(JSON.parse(line))
      }
      catch {
        console.warn(`skipping malformed line in ${file}: ${line.slice(0, 80)}`)
      }
    }
  }
  return records
}

function summarize(records: RunRecord[]) {
  return {
    n: records.length,
    successRate: records.filter(r => r.success).length / records.length,
    costUsd: median(records.map(r => r.costUsd)),
    durationS: median(records.map(r => r.durationMs)) / 1000,
    turns: median(records.map(r => r.numTurns)),
    toolCalls: median(records.map(r => r.totalToolCalls)),
    inputTokens: median(records.map(r => r.inputTokens + r.cacheCreationTokens + r.cacheReadTokens)),
    outputTokens: median(records.map(r => r.outputTokens)),
  }
}

function row(name: string, s: ReturnType<typeof summarize>): string {
  return `| ${name} | ${s.n} | ${(s.successRate * 100).toFixed(0)}% | $${s.costUsd.toFixed(4)} | ${s.durationS.toFixed(1)}s | ${s.turns} | ${s.toolCalls} | ${Math.round(s.inputTokens).toLocaleString()} | ${Math.round(s.outputTokens).toLocaleString()} |`
}

const HEADER = `| condition | n | success | cost (med) | time (med) | turns | tool calls | input tok (med) | output tok (med) |
|---|---|---|---|---|---|---|---|---|`

export async function printReport(files: string[]): Promise<void> {
  const records = await loadRecords(files)
  if (records.length === 0) {
    console.log('No records found.')
    return
  }

  const conditions = [...new Set(records.map(r => r.condition))]
  const tasks = [...new Set(records.map(r => r.task))]

  console.log(`# Asana interface benchmark — ${records.length} runs, model ${[...new Set(records.map(r => r.model))].join('/')}\n`)

  console.log('## Overall (all tasks)\n')
  console.log(HEADER)
  for (const condition of conditions) {
    console.log(row(condition, summarize(records.filter(r => r.condition === condition))))
  }

  for (const task of tasks) {
    console.log(`\n## Task: ${task}\n`)
    console.log(HEADER)
    for (const condition of conditions) {
      const subset = records.filter(r => r.condition === condition && r.task === task)
      if (subset.length > 0) {
        console.log(row(condition, summarize(subset)))
      }
    }
  }

  const failures = records.filter(r => !r.success)
  if (failures.length > 0) {
    console.log('\n## Failures\n')
    for (const failure of failures) {
      console.log(`- ${failure.task} × ${failure.condition} #${failure.iteration}: ${failure.verifyDetail}`)
    }
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const files = args.length > 0
    ? args
    : readdirSync(RESULTS_DIR).filter(f => f.endsWith('.jsonl')).map(f => join(RESULTS_DIR, f))
  printReport(files).catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
}
