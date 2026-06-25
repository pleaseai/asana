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
 * URL parsing is shared with the CLI via `src/lib/asana-url.ts`.
 */

import process from 'node:process'
import { parseAsanaUrl } from '../src/lib/asana-url'

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

  // Not an Asana URL → allow the fetch.
  if (!url || !parseAsanaUrl(url)) {
    return {}
  }

  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: 'Asana URL detected — use the asana CLI for authenticated, structured access',
    },
    systemMessage: `⚠️ ${buildCliGuidance(url)}`,
  }
}

/**
 * Build the `asana` CLI guidance for an Asana URL. `asana fetch` resolves the
 * URL to its task/project/comment itself, so the agent can pass the link
 * verbatim instead of extracting a gid and choosing a subcommand.
 */
export function buildCliGuidance(url: string): string {
  return `Asana URL detected. Use the asana CLI instead of WebFetch:

  asana fetch ${url} --format toon`
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
