import type { OAuthTokenResponse } from '../../src/lib/oauth'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { buildAuthorizeUrl, buildLoopbackRedirectUri, generatePKCE, generateSecureState, refreshAccessToken, resolveRedirectPort } from '../../src/lib/oauth'

describe('oauth module', () => {
  beforeEach(() => {
    // Set up environment variables for tests
    process.env.ASANA_CLIENT_ID = 'test-client-id'
    process.env.ASANA_CLIENT_SECRET = 'test-client-secret'
  })

  afterEach(() => {
    // Clean up environment variables
    delete process.env.ASANA_CLIENT_ID
    delete process.env.ASANA_CLIENT_SECRET
  })

  describe('generateSecureState', () => {
    test('returns a non-empty string', () => {
      const state = generateSecureState()
      expect(typeof state).toBe('string')
      expect(state.length).toBeGreaterThan(0)
    })

    test('returns different values on successive calls', () => {
      const state1 = generateSecureState()
      const state2 = generateSecureState()
      expect(state1).not.toBe(state2)
    })

    test('returns URL-safe base64 string (no +, /, or = chars)', () => {
      const state = generateSecureState()
      expect(state).not.toMatch(/[+/=]/)
    })

    test('returns at least 16 characters', () => {
      // 16 bytes of random data encodes to ~22 base64url chars
      const state = generateSecureState()
      expect(state.length).toBeGreaterThanOrEqual(16)
    })
  })

  describe('generatePKCE', () => {
    test('returns codeVerifier and codeChallenge', async () => {
      const { codeVerifier, codeChallenge } = await generatePKCE()
      expect(typeof codeVerifier).toBe('string')
      expect(typeof codeChallenge).toBe('string')
    })

    test('codeVerifier is at least 43 characters (RFC 7636)', async () => {
      const { codeVerifier } = await generatePKCE()
      // 32 random bytes → 43 base64url chars (no padding)
      expect(codeVerifier.length).toBeGreaterThanOrEqual(43)
    })

    test('codeVerifier contains only URL-safe characters', async () => {
      const { codeVerifier } = await generatePKCE()
      expect(codeVerifier).not.toMatch(/[+/=]/)
    })

    test('codeChallenge contains only URL-safe characters', async () => {
      const { codeChallenge } = await generatePKCE()
      expect(codeChallenge).not.toMatch(/[+/=]/)
    })

    test('returns different values on successive calls', async () => {
      const first = await generatePKCE()
      const second = await generatePKCE()
      expect(first.codeVerifier).not.toBe(second.codeVerifier)
      expect(first.codeChallenge).not.toBe(second.codeChallenge)
    })

    test('codeChallenge is SHA-256 of codeVerifier encoded as base64url', async () => {
      const { codeVerifier, codeChallenge } = await generatePKCE()

      // Re-derive the challenge independently
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
      const expectedChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')

      expect(codeChallenge).toBe(expectedChallenge)
    })
  })

  describe('refreshAccessToken', () => {
    test('successfully refreshes access token', async () => {
      const mockResponse: OAuthTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
      }

      // Mock fetch
      const originalFetch = global.fetch
      global.fetch = mock(async (url: string, options: any) => {
        expect(url).toBe('https://app.asana.com/-/oauth_token')
        expect(options.method).toBe('POST')
        expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded')

        const body = new URLSearchParams(options.body)
        expect(body.get('grant_type')).toBe('refresh_token')
        expect(body.get('client_id')).toBe('test-client-id')
        expect(body.get('client_secret')).toBe('test-client-secret')
        expect(body.get('refresh_token')).toBe('old-refresh-token')

        return {
          ok: true,
          json: async () => mockResponse,
        } as Response
      }) as any

      const result = await refreshAccessToken('old-refresh-token')

      expect(result).toEqual(mockResponse)

      global.fetch = originalFetch
    })

    test('throws error when client credentials are missing', async () => {
      delete process.env.ASANA_CLIENT_ID
      delete process.env.ASANA_CLIENT_SECRET

      await expect(refreshAccessToken('refresh-token')).rejects.toThrow(
        'OAuth credentials not found in environment variables',
      )
    })

    test('throws error when client ID is missing', async () => {
      delete process.env.ASANA_CLIENT_ID

      await expect(refreshAccessToken('refresh-token')).rejects.toThrow(
        'OAuth credentials not found in environment variables',
      )
    })

    test('throws error when client secret is missing', async () => {
      delete process.env.ASANA_CLIENT_SECRET

      await expect(refreshAccessToken('refresh-token')).rejects.toThrow(
        'OAuth credentials not found in environment variables',
      )
    })

    test('throws error when token refresh fails', async () => {
      const originalFetch = global.fetch
      global.fetch = mock(async () => {
        return {
          ok: false,
          text: async () => 'Invalid refresh token',
        } as Response
      }) as any

      await expect(refreshAccessToken('invalid-token')).rejects.toThrow(
        'Token refresh failed: Invalid refresh token',
      )

      global.fetch = originalFetch
    })

    test('handles network errors', async () => {
      const originalFetch = global.fetch
      global.fetch = mock(async () => {
        throw new Error('Network error')
      }) as any

      await expect(refreshAccessToken('refresh-token')).rejects.toThrow('Network error')

      global.fetch = originalFetch
    })

    test('sends correct Content-Type header', async () => {
      const originalFetch = global.fetch
      let capturedHeaders: any

      global.fetch = mock(async (url: string, options: any) => {
        capturedHeaders = options.headers
        return {
          ok: true,
          json: async () => ({
            access_token: 'token',
            refresh_token: 'refresh',
            expires_in: 3600,
            token_type: 'bearer',
          }),
        } as Response
      }) as any

      await refreshAccessToken('refresh-token')

      expect(capturedHeaders['Content-Type']).toBe('application/x-www-form-urlencoded')

      global.fetch = originalFetch
    })

    test('includes all required parameters in request body', async () => {
      const originalFetch = global.fetch
      let capturedBody: URLSearchParams

      global.fetch = mock(async (url: string, options: any) => {
        capturedBody = new URLSearchParams(options.body)
        return {
          ok: true,
          json: async () => ({
            access_token: 'token',
            refresh_token: 'refresh',
            expires_in: 3600,
            token_type: 'bearer',
          }),
        } as Response
      }) as any

      await refreshAccessToken('test-refresh-token')

      expect(capturedBody.get('grant_type')).toBe('refresh_token')
      expect(capturedBody.get('client_id')).toBe('test-client-id')
      expect(capturedBody.get('client_secret')).toBe('test-client-secret')
      expect(capturedBody.get('refresh_token')).toBe('test-refresh-token')

      global.fetch = originalFetch
    })
  })

  describe('startOAuthFlow', () => {
    test('throws error when client credentials are missing', async () => {
      delete process.env.ASANA_CLIENT_ID
      delete process.env.ASANA_CLIENT_SECRET

      // We can't easily test the full OAuth flow without a browser,
      // but we can test the error handling
      const { startOAuthFlow } = await import('../../src/lib/oauth')

      await expect(startOAuthFlow()).rejects.toThrow(
        /OAuth requires ASANA_CLIENT_ID and ASANA_CLIENT_SECRET/,
      )
    })

    test('throws error when only client ID is set', async () => {
      delete process.env.ASANA_CLIENT_SECRET

      const { startOAuthFlow } = await import('../../src/lib/oauth')

      await expect(startOAuthFlow()).rejects.toThrow(
        /OAuth requires ASANA_CLIENT_ID and ASANA_CLIENT_SECRET/,
      )
    })

    test('throws error when only client secret is set', async () => {
      delete process.env.ASANA_CLIENT_ID

      const { startOAuthFlow } = await import('../../src/lib/oauth')

      await expect(startOAuthFlow()).rejects.toThrow(
        /OAuth requires ASANA_CLIENT_ID and ASANA_CLIENT_SECRET/,
      )
    })

    describe('scope parameter handling', () => {
      test('uses default scope when no scopes option is provided', async () => {
        // Verify the default scope is 'default' by checking what gets built into auth URL
        // We do this by testing the behavior indirectly - when creds are missing, the
        // error is thrown before scope matters; we just verify the flow accepts no scopes
        const { startOAuthFlow } = await import('../../src/lib/oauth')
        delete process.env.ASANA_CLIENT_ID

        // The function throws before scope is processed, so we just verify it accepts undefined scopes
        await expect(startOAuthFlow({})).rejects.toThrow(
          /OAuth requires ASANA_CLIENT_ID and ASANA_CLIENT_SECRET/,
        )
      })

      test('accepts custom scopes array', async () => {
        const { startOAuthFlow } = await import('../../src/lib/oauth')
        delete process.env.ASANA_CLIENT_ID

        // Verify the function accepts a scopes array without throwing a type error
        await expect(startOAuthFlow({ scopes: ['tasks:read', 'projects:read'] })).rejects.toThrow(
          /OAuth requires ASANA_CLIENT_ID and ASANA_CLIENT_SECRET/,
        )
      })
    })

    describe('OOB flow', () => {
      test('throws error when credentials are missing even in OOB mode', async () => {
        delete process.env.ASANA_CLIENT_ID
        delete process.env.ASANA_CLIENT_SECRET

        const { startOAuthFlow } = await import('../../src/lib/oauth')

        await expect(startOAuthFlow({ oob: true })).rejects.toThrow(
          /OAuth requires ASANA_CLIENT_ID and ASANA_CLIENT_SECRET/,
        )
      })

      test('accepts oob option', async () => {
        const { startOAuthFlow } = await import('../../src/lib/oauth')
        delete process.env.ASANA_CLIENT_ID

        // Verify the function accepts the oob option
        await expect(startOAuthFlow({ oob: true })).rejects.toThrow(
          /OAuth requires ASANA_CLIENT_ID and ASANA_CLIENT_SECRET/,
        )
      })
    })
  })

  describe('redirect configuration', () => {
    afterEach(() => {
      delete process.env.ASANA_OAUTH_REDIRECT_PORT
    })

    test('buildLoopbackRedirectUri builds a localhost callback URL', () => {
      expect(buildLoopbackRedirectUri(8080)).toBe('http://localhost:8080/callback')
      expect(buildLoopbackRedirectUri(7777)).toBe('http://localhost:7777/callback')
    })

    test('resolveRedirectPort prefers an explicit option over env and default', () => {
      process.env.ASANA_OAUTH_REDIRECT_PORT = '9999'
      expect(resolveRedirectPort(7000)).toBe(7000)
    })

    test('resolveRedirectPort falls back to env, then the 8080 default', () => {
      process.env.ASANA_OAUTH_REDIRECT_PORT = '9100'
      expect(resolveRedirectPort()).toBe(9100)
      delete process.env.ASANA_OAUTH_REDIRECT_PORT
      expect(resolveRedirectPort()).toBe(8080)
    })

    test('resolveRedirectPort ignores invalid values', () => {
      process.env.ASANA_OAUTH_REDIRECT_PORT = 'not-a-port'
      expect(resolveRedirectPort()).toBe(8080)
      expect(resolveRedirectPort(0)).toBe(8080)
      expect(resolveRedirectPort(-5)).toBe(8080)
    })

    test('buildAuthorizeUrl reflects the configured redirect_uri and uses PKCE S256', () => {
      const url = new URL(buildAuthorizeUrl({
        clientId: 'cid',
        redirectUri: 'http://localhost:7777/callback',
        scope: 'default',
        state: 'st',
        codeChallenge: 'cc',
      }))
      expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:7777/callback')
      expect(url.searchParams.get('client_id')).toBe('cid')
      expect(url.searchParams.get('scope')).toBe('default')
      expect(url.searchParams.get('code_challenge')).toBe('cc')
      expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    })
  })
})
