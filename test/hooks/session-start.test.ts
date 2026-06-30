import type { AsanaConfig } from '../../src/types'
import { describe, expect, test } from 'bun:test'

import { decideSessionStart, deriveAuthState } from '../../hooks/session-start'

// `deriveAuthState` maps config + env token to the auth state; `decideSessionStart`
// is the pure decision built on top of it. Both are tested here.

const NOW = 1_700_000_000_000

describe('decideSessionStart', () => {
  test('always injects asana CLI guidance as SessionStart additionalContext', () => {
    const out = decideSessionStart({ hasToken: true, authType: 'pat', hasRefreshToken: false }, NOW)
    expect(out.hookSpecificOutput?.hookEventName).toBe('SessionStart')
    expect(out.hookSpecificOutput?.additionalContext).toContain('asana')
    expect(out.hookSpecificOutput?.additionalContext).toContain('asana fetch')
  })

  describe('authenticated', () => {
    test('reports a PAT identity and emits no user warning', () => {
      const out = decideSessionStart({ hasToken: true, authType: 'pat', hasRefreshToken: false }, NOW)
      expect(out.hookSpecificOutput?.additionalContext).toContain('personal access token')
      expect(out.systemMessage).toBeUndefined()
    })

    test('reports a valid OAuth identity and emits no user warning', () => {
      const out = decideSessionStart(
        { hasToken: true, authType: 'oauth', expiresAt: NOW + 60_000, hasRefreshToken: true },
        NOW,
      )
      expect(out.hookSpecificOutput?.additionalContext).toContain('OAuth')
      expect(out.systemMessage).toBeUndefined()
    })

    test('notes auto-refresh for an expired OAuth token that still has a refresh token', () => {
      const out = decideSessionStart(
        { hasToken: true, authType: 'oauth', expiresAt: NOW - 1, hasRefreshToken: true },
        NOW,
      )
      // The CLI refreshes on the next command, so this is informational, not a warning.
      expect(out.hookSpecificOutput?.additionalContext).toContain('refresh')
      expect(out.systemMessage).toBeUndefined()
    })
  })

  describe('needs attention', () => {
    test('warns the user when no token is configured', () => {
      const out = decideSessionStart({ hasToken: false, hasRefreshToken: false }, NOW)
      expect(out.systemMessage).toContain('asana auth login')
      expect(out.systemMessage?.startsWith('⚠️')).toBe(true)
      expect(out.hookSpecificOutput?.additionalContext).toContain('asana auth login')
    })

    test('warns when an OAuth token is expired with no refresh token', () => {
      const out = decideSessionStart(
        { hasToken: true, authType: 'oauth', expiresAt: NOW - 1, hasRefreshToken: false },
        NOW,
      )
      expect(out.systemMessage).toContain('asana auth login')
      expect(out.systemMessage?.startsWith('⚠️')).toBe(true)
    })
  })
})

describe('deriveAuthState', () => {
  const oauthConfig: AsanaConfig = {
    accessToken: 'config-oauth-token',
    authType: 'oauth',
    expiresAt: NOW - 1,
    // no refreshToken → an expired, non-refreshable OAuth session
  }

  test('uses config OAuth metadata when a config token resolves', () => {
    const state = deriveAuthState(oauthConfig, undefined)
    expect(state).toEqual({
      hasToken: true,
      authType: 'oauth',
      expiresAt: NOW - 1,
      hasRefreshToken: false,
    })
  })

  test('a config token wins over ASANA_ACCESS_TOKEN, mirroring getAccessToken precedence', () => {
    // getAccessToken is `config?.accessToken || env`, so the env var never
    // overrides a present config token — the hook must report what the CLI uses.
    const state = deriveAuthState(oauthConfig, 'env-pat-token')
    expect(state.authType).toBe('oauth')
    expect(state.expiresAt).toBe(NOW - 1)
  })

  test('falls back to the env PAT with no stale OAuth metadata when there is no config token', () => {
    // Regression: an env token must never be paired with config OAuth fields,
    // which would raise a false re-auth warning.
    const state = deriveAuthState(null, 'env-pat-token')
    expect(state).toEqual({ hasToken: true, authType: 'pat', hasRefreshToken: false })
  })

  test('treats an empty config token as absent and uses the env PAT', () => {
    const stale: AsanaConfig = { accessToken: '', authType: 'oauth', expiresAt: NOW - 1 }
    const state = deriveAuthState(stale, 'env-pat-token')
    expect(state).toEqual({ hasToken: true, authType: 'pat', hasRefreshToken: false })
  })

  test('reports no token when neither config nor env provides one', () => {
    const state = deriveAuthState(null, undefined)
    expect(state).toEqual({ hasToken: false, hasRefreshToken: false })
  })
})
