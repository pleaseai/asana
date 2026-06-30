import { describe, expect, test } from 'bun:test'

import { decideSessionStart } from '../../hooks/session-start'

// The auth state itself is derived from config.json / ASANA_ACCESS_TOKEN by the
// impure `readAuthState`; here we only test the pure decision built on top of it.

const NOW = 1_700_000_000_000

describe('decideSessionStart', () => {
  test('always injects asana CLI guidance as SessionStart additionalContext', () => {
    const out = decideSessionStart({ hasToken: true, authType: 'pat' }, NOW)
    expect(out.hookSpecificOutput?.hookEventName).toBe('SessionStart')
    expect(out.hookSpecificOutput?.additionalContext).toContain('asana')
    expect(out.hookSpecificOutput?.additionalContext).toContain('asana fetch')
  })

  describe('authenticated', () => {
    test('reports a PAT identity and emits no user warning', () => {
      const out = decideSessionStart({ hasToken: true, authType: 'pat' }, NOW)
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
      const out = decideSessionStart({ hasToken: false }, NOW)
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
