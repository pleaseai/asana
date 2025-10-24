import type { OAuthTokenResponse } from '../../src/lib/oauth'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { refreshAccessToken } from '../../src/lib/oauth'

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
  })
})
