export interface Condition {
  /** short id used in results and CLI args */
  name: string
  description: string
  /** absolute path to the --mcp-config file for this condition */
  mcpConfigPath: string
  allowedTools: string[]
  disallowedTools: string[]
  /** extra env vars for the claude process (e.g. ENABLE_TOOL_SEARCH) */
  env: Record<string, string>
  /** one-line hint appended to the system prompt — keep symmetric across conditions */
  systemPromptAppend: string
}

export interface BenchContext {
  /** unique per-run prefix baked into every seeded/created task name */
  prefix: string
  workspaceGid: string
  workspaceName: string
  projectGid: string
  projectName: string
  /** authenticated user gid (for assignee seeding/verification) */
  meGid: string
}

export interface VerifyResult {
  success: boolean
  detail: string
}

export interface BenchTask {
  id: string
  description: string
  /** create fixture state; returns gids of seeded tasks for cleanup */
  seed: (ctx: BenchContext) => Promise<string[]>
  prompt: (ctx: BenchContext) => string
  /** check ground truth via the Asana REST API (never via the interface under test) */
  verify: (ctx: BenchContext, resultText: string) => Promise<VerifyResult>
}

export interface ClaudeMetrics {
  isError: boolean
  subtype: string
  numTurns: number
  durationMs: number
  durationApiMs: number
  costUsd: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  toolCalls: Record<string, number>
  totalToolCalls: number
  resultText: string
  sessionId: string
}

export interface RunRecord extends ClaudeMetrics {
  timestamp: string
  session: string
  condition: string
  task: string
  iteration: number
  model: string
  success: boolean
  verifyDetail: string
}
