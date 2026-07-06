import type { ClaudeMetrics, Condition } from './types'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

export interface RunClaudeOptions {
  prompt: string
  condition: Condition
  model: string
  maxTurns: number
  timeoutMs: number
}

/**
 * Runs one headless `claude -p` session and extracts metrics from the
 * stream-json transcript. The session runs in a fresh temp cwd with only
 * project-level setting sources so user hooks, memory, and global CLAUDE.md
 * cannot contaminate the measurement.
 */
export async function runClaude(options: RunClaudeOptions): Promise<ClaudeMetrics> {
  const cwd = mkdtempSync(join(tmpdir(), 'asana-bench-'))

  try {
    return await runClaudeIn(cwd, options)
  }
  finally {
    rmSync(cwd, { recursive: true, force: true })
  }
}

async function runClaudeIn(cwd: string, options: RunClaudeOptions): Promise<ClaudeMetrics> {
  const { prompt, condition, model, maxTurns, timeoutMs } = options

  const args = [
    '-p',
    prompt,
    '--output-format',
    'stream-json',
    '--verbose',
    '--model',
    model,
    '--max-turns',
    String(maxTurns),
    '--setting-sources',
    'project',
    '--strict-mcp-config',
    '--mcp-config',
    condition.mcpConfigPath,
    '--append-system-prompt',
    condition.systemPromptAppend,
  ]
  if (condition.allowedTools.length > 0) {
    args.push('--allowedTools', condition.allowedTools.join(','))
  }
  if (condition.disallowedTools.length > 0) {
    args.push('--disallowedTools', condition.disallowedTools.join(','))
  }

  const proc = Bun.spawn(['claude', ...args], {
    cwd,
    env: { ...process.env, ...condition.env },
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const timer = setTimeout(() => proc.kill(), timeoutMs)
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  const exitCode = await proc.exited
  clearTimeout(timer)

  const metrics = parseStream(stdout)
  if (!metrics) {
    return {
      isError: true,
      subtype: exitCode === null || exitCode !== 0 ? `exit_${exitCode}_or_timeout` : 'no_result_event',
      numTurns: 0,
      durationMs: timeoutMs,
      durationApiMs: 0,
      costUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      toolCalls: {},
      totalToolCalls: 0,
      resultText: stderr.slice(0, 500),
      sessionId: '',
    }
  }
  return metrics
}

function parseStream(stdout: string): ClaudeMetrics | null {
  const toolCalls: Record<string, number> = {}
  let result: Record<string, any> | null = null

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{')) {
      continue
    }
    let event: Record<string, any>
    try {
      event = JSON.parse(trimmed)
    }
    catch {
      continue
    }
    if (event.type === 'assistant') {
      for (const block of event.message?.content ?? []) {
        if (block.type === 'tool_use') {
          toolCalls[block.name] = (toolCalls[block.name] ?? 0) + 1
        }
      }
    }
    else if (event.type === 'result') {
      result = event
    }
  }

  if (!result) {
    return null
  }

  const usage = result.usage ?? {}
  return {
    isError: Boolean(result.is_error),
    subtype: result.subtype ?? 'unknown',
    numTurns: result.num_turns ?? 0,
    durationMs: result.duration_ms ?? 0,
    durationApiMs: result.duration_api_ms ?? 0,
    costUsd: result.total_cost_usd ?? 0,
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
    toolCalls,
    totalToolCalls: Object.values(toolCalls).reduce((sum, n) => sum + n, 0),
    resultText: String(result.result ?? '').slice(0, 1000),
    sessionId: result.session_id ?? '',
  }
}
