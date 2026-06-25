#!/usr/bin/env bun
/**
 * PreToolUse Hook: Intercept WebFetch/Fetch for Asana URLs
 *
 * Fetching an app.asana.com URL returns a JS-rendered shell, not the task data —
 * and it bypasses authentication. This hook detects Asana URLs in WebFetch/Fetch
 * calls and redirects the agent to the local `asana` CLI, which speaks the API
 * directly and emits agent-friendly `toon` output.
 *
 * Adapted from chatbot-pf/engineering-standards (MCP variant) for this repo:
 * the `asana` CLI itself is the redirect target instead of Asana MCP.
 *
 * URL forms:
 *   V0 (legacy): https://app.asana.com/0/{project_id}/{task_id}
 *   V1 (new):    https://app.asana.com/1/{workspace_id}/project/{project_id}/task/{task_id}
 *                https://app.asana.com/1/{workspace_id}/task/{task_id}
 *                .../task/{task_id}/comment/{comment_id}
 */

import process from 'node:process'

// Minimal local shapes — avoids depending on @anthropic-ai/claude-agent-sdk.
interface PreToolUseHookInput {
  tool_name: string
  tool_input: unknown
}

interface HookJSONOutput {
  hookSpecificOutput?: {
    hookEventName: 'PreToolUse'
    permissionDecision?: 'allow' | 'deny' | 'ask'
    permissionDecisionReason?: string
  }
  systemMessage?: string
}

interface WebFetchToolInput {
  url?: string
  prompt?: string
}

interface AsanaUrlMatch {
  type: 'task' | 'project' | 'comment' | 'unknown'
  workspaceId?: string
  projectId?: string
  taskId?: string
  commentId?: string
}

const ASANA_HOST = 'app.asana.com'

/**
 * Match the Asana identifiers in a URL *pathname* (host already verified).
 * Pathname excludes query/fragment, so anchored `^…$` patterns are exact.
 */
function matchAsanaPath(path: string): AsanaUrlMatch | null {
  // V1: Task with comment - /1/{workspace}/[project/{project}/]task/{task}/comment/{comment}
  const v1Comment = /^\/1\/(\d+)\/(?:project\/(\d+)\/)?task\/(\d+)\/comment\/(\d+)/.exec(path)
  if (v1Comment) {
    const [, workspaceId, projectId, taskId, commentId] = v1Comment
    return { type: 'comment', workspaceId, projectId, taskId, commentId }
  }

  // V1: Task in project - /1/{workspace}/project/{project}/task/{task}
  const v1TaskInProject = /^\/1\/(\d+)\/project\/(\d+)\/task\/(\d+)/.exec(path)
  if (v1TaskInProject) {
    const [, workspaceId, projectId, taskId] = v1TaskInProject
    return { type: 'task', workspaceId, projectId, taskId }
  }

  // V1: Task without project - /1/{workspace}/task/{task}
  const v1Task = /^\/1\/(\d+)\/task\/(\d+)/.exec(path)
  if (v1Task) {
    const [, workspaceId, taskId] = v1Task
    return { type: 'task', workspaceId, taskId }
  }

  // V1: Project - /1/{workspace}/project/{project}
  const v1Project = /^\/1\/(\d+)\/project\/(\d+)\/?$/.exec(path)
  if (v1Project) {
    const [, workspaceId, projectId] = v1Project
    return { type: 'project', workspaceId, projectId }
  }

  // V0 (legacy): Task - /0/{project}/{task}
  const v0Task = /^\/0\/(\d+)\/(\d+)/.exec(path)
  if (v0Task) {
    const [, projectId, taskId] = v0Task
    return { type: 'task', projectId, taskId }
  }

  // V0 (legacy): Project - /0/{project}
  const v0Project = /^\/0\/(\d+)\/?$/.exec(path)
  if (v0Project) {
    const [, projectId] = v0Project
    return { type: 'project', projectId }
  }

  return null
}

/**
 * Parse an Asana URL and extract its identifiers, or return null if it is not
 * a recognizable task/project/comment URL.
 *
 * Parses with the `URL` constructor and verifies `hostname === app.asana.com`
 * before matching, so a non-Asana URL that merely *contains* the string
 * `app.asana.com` (e.g. `https://app.asana.com.evil.com/0/1/2` or
 * `https://proxy.example.com/?to=https://app.asana.com/0/1/2`) is not matched.
 * A non-string or malformed URL throws in `new URL()` and is caught as null.
 */
export function parseAsanaUrl(url: string): AsanaUrlMatch | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  }
  catch {
    return null
  }

  if (parsed.hostname !== ASANA_HOST) {
    return null
  }

  return matchAsanaPath(parsed.pathname)
}

/**
 * Decide the hook output for a tool call: deny + CLI guidance for an Asana URL,
 * or an empty object (allow / pass-through) for anything else. Pure and
 * side-effect free so both the `WebFetch` and `Fetch` paths are unit-testable.
 */
export function decideForToolCall(hookInput: PreToolUseHookInput): HookJSONOutput {
  // Only act on fetch-style tools; pass everything else through untouched.
  if (hookInput.tool_name !== 'WebFetch' && hookInput.tool_name !== 'Fetch') {
    return {}
  }

  const url = (hookInput.tool_input as WebFetchToolInput)?.url
  const match = url ? parseAsanaUrl(url) : null

  // Not an Asana URL → allow the fetch.
  if (!match) {
    return {}
  }

  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: 'Asana URL detected — use the asana CLI for authenticated, structured access',
    },
    systemMessage: `⚠️ ${buildCliGuidance(match)}`,
  }
}

/**
 * Build the `asana` CLI guidance shown to the agent for a matched URL.
 */
export function buildCliGuidance(match: AsanaUrlMatch): string {
  if (match.type === 'comment' && match.taskId) {
    return `Asana comment detected. Use the asana CLI instead of WebFetch:

  asana task comment list ${match.taskId} --format toon

(The CLI lists a task's comments; there is no fetch-single-comment command.)`
  }

  if (match.type === 'task' && match.taskId) {
    return `Asana task detected. Use the asana CLI instead of WebFetch:

  asana task get ${match.taskId} --format toon`
  }

  if (match.type === 'project' && match.projectId) {
    return `Asana project detected. Use the asana CLI instead of WebFetch:

  asana project get ${match.projectId} --format toon`
  }

  return `Asana URL detected. Use the asana CLI instead of WebFetch:

  asana --help          # list commands
  asana task get <gid>  # a task
  asana project get <gid>  # a project`
}

async function main(): Promise<void> {
  try {
    const input = await Bun.stdin.text()
    const hookInput: PreToolUseHookInput = JSON.parse(input)
    const output = decideForToolCall(hookInput)
    process.stdout.write(`${JSON.stringify(output)}\n`)
    process.exit(0)
  }
  catch (error) {
    // Never hard-fail the tool call: notify and fall back to WebFetch.
    const errorMessage = error instanceof Error ? error.message : String(error)
    await Bun.write(Bun.stderr, `Hook error: ${errorMessage}\n`)
    const output: HookJSONOutput = {
      systemMessage: `⚠️ Asana hook error: ${errorMessage}. Falling back to WebFetch.`,
    }
    process.stdout.write(`${JSON.stringify(output)}\n`)
    process.exit(0)
  }
}

// Bun sets import.meta.main only for the directly-executed entry file, so tests
// that import parseAsanaUrl/buildCliGuidance never trigger main().
// main() handles its own errors and exits, so there is nothing to await here.
if (import.meta.main) {
  void main()
}
