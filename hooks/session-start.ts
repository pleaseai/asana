#!/usr/bin/env bun
/**
 * SessionStart Hook: announce the asana CLI and check auth at session start
 *
 * Two jobs, mirroring the project's "use the CLI, not raw web access" stance:
 *   1. Inject agent-facing guidance so the session knows the `asana` CLI is the
 *      preferred way to read/write Asana (analogous to intercept-webfetch.ts).
 *   2. Inspect the stored credential (config.json / ASANA_ACCESS_TOKEN) and warn
 *      the user when nothing usable is configured, so the first asana command
 *      doesn't fail with a confusing auth error.
 *
 * Auth resolution is shared with the CLI via src/lib/config.ts.
 */

import type { AsanaConfig } from '../src/types'
import process from 'node:process'
import { loadConfig } from '../src/lib/config'

// Minimal local shapes — avoids depending on @anthropic-ai/claude-agent-sdk.
interface HookJSONOutput {
  hookSpecificOutput?: {
    hookEventName: 'SessionStart'
    additionalContext?: string
  }
  systemMessage?: string
}

/**
 * The credential picture the decision needs. Derived from config.json / env by
 * {@link readAuthState}; passed explicitly so {@link decideSessionStart} stays
 * pure and unit-testable.
 */
export interface AsanaAuthState {
  /** Whether `getAccessToken()` resolved a non-empty token. */
  hasToken: boolean
  authType?: 'pat' | 'oauth'
  /** OAuth access-token expiry, epoch ms. */
  expiresAt?: number
  /** Whether an OAuth refresh token is stored (enables auto-refresh). */
  hasRefreshToken: boolean
}

const AUTH_LOGIN_HINT = 'Run `asana auth login` (OAuth) or set ASANA_ACCESS_TOKEN.'

/**
 * Static, agent-facing primer on using the asana CLI this session. Kept terse
 * because it loads on every session (AXI §7: token-budget-aware) — just enough
 * for the agent to orient and act. The auth status line is appended by
 * {@link decideSessionStart}.
 */
function buildAsanaGuidance(): string {
  return `asana CLI available — prefer it for Asana ops (tasks, projects, comments, custom fields) over web requests.
  asana task list | task view <gid> | task create
  asana fetch "<app.asana.com URL>"   # resolve any Asana link
  asana auth whoami                    # identity / default workspace`
}

/**
 * Describe the credential for the agent. The OAuth-expired-but-refreshable case
 * is informational (the CLI refreshes on the next command), not a failure.
 */
function buildAuthStatusLine(state: AsanaAuthState, now: number): string {
  if (!state.hasToken) {
    return `Auth: not authenticated. ${AUTH_LOGIN_HINT}`
  }

  if (state.authType === 'oauth') {
    const expired = state.expiresAt != null && now >= state.expiresAt
    if (expired && state.hasRefreshToken) {
      return 'Auth: authenticated via OAuth (access token expired; the CLI will refresh it automatically on the next command).'
    }
    if (expired) {
      return `Auth: OAuth session expired. ${AUTH_LOGIN_HINT}`
    }
    return 'Auth: authenticated via OAuth.'
  }

  return 'Auth: authenticated via personal access token.'
}

/**
 * Whether the stored credential needs the user to act before asana commands
 * work: no token at all, or an expired OAuth token with no refresh token.
 */
function needsReauth(state: AsanaAuthState, now: number): boolean {
  if (!state.hasToken) {
    return true
  }
  if (state.authType === 'oauth' && !state.hasRefreshToken) {
    return state.expiresAt != null && now >= state.expiresAt
  }
  return false
}

/**
 * Build the SessionStart output: always inject CLI guidance + auth status as
 * additionalContext, and surface a user-visible warning only when the
 * credential needs attention. Pure and side-effect free.
 */
export function decideSessionStart(state: AsanaAuthState, now: number): HookJSONOutput {
  const additionalContext = `${buildAsanaGuidance()}\n\n${buildAuthStatusLine(state, now)}`

  const output: HookJSONOutput = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext,
    },
  }

  if (needsReauth(state, now)) {
    output.systemMessage = `⚠️ Asana CLI is not authenticated — ${AUTH_LOGIN_HINT}`
  }

  return output
}

/**
 * Map a stored config + env token to the auth state, mirroring
 * `getAccessToken`'s precedence (`config?.accessToken || ASANA_ACCESS_TOKEN`):
 * a config token wins, the env var is the fallback. Crucially, OAuth metadata
 * (authType/expiresAt/refreshToken) is read ONLY when the config token is the
 * one that resolves — never paired with an env-resolved token, so a stale OAuth
 * config can't trigger a false re-auth warning when ASANA_ACCESS_TOKEN is set.
 * Pure, so the source-precedence logic is unit-testable.
 */
export function deriveAuthState(config: AsanaConfig | null, envToken: string | undefined): AsanaAuthState {
  if (config?.accessToken) {
    return {
      hasToken: true,
      authType: config.authType,
      expiresAt: config.expiresAt,
      hasRefreshToken: config.refreshToken != null,
    }
  }

  if (envToken) {
    return { hasToken: true, authType: 'pat', hasRefreshToken: false }
  }

  return { hasToken: false, hasRefreshToken: false }
}

/**
 * Read the stored credential into an {@link AsanaAuthState}. Impure (touches
 * config.json + process.env); kept thin so {@link deriveAuthState} stays testable.
 */
export function readAuthState(): AsanaAuthState {
  return deriveAuthState(loadConfig(), process.env.ASANA_ACCESS_TOKEN)
}

async function main(): Promise<void> {
  try {
    // SessionStart input is consumed but not needed; drain stdin so the hook
    // doesn't block on an unread pipe. Skip when attached to an interactive TTY
    // (manual runs / debugging) — there's no EOF coming, so the read would hang.
    if (!process.stdin.isTTY) {
      await Bun.stdin.text()
    }
    const output = decideSessionStart(readAuthState(), Date.now())
    process.stdout.write(`${JSON.stringify(output)}\n`)
    process.exit(0)
  }
  catch (error) {
    // Never hard-fail session startup. Surface the failure via systemMessage
    // (same contract as intercept-webfetch.ts) instead of a silent `{}`, so a
    // config read/parse error is visible in-session rather than disappearing.
    const errorMessage = error instanceof Error ? error.message : String(error)
    await Bun.write(Bun.stderr, `Hook error: ${errorMessage}\n`)
    const output: HookJSONOutput = {
      systemMessage: `⚠️ Asana SessionStart hook error: ${errorMessage}. Session guidance was not injected.`,
    }
    process.stdout.write(`${JSON.stringify(output)}\n`)
    process.exit(0)
  }
}

// Bun sets import.meta.main only for the directly-executed entry file, so tests
// that import decideSessionStart never trigger main().
if (import.meta.main) {
  void main()
}
