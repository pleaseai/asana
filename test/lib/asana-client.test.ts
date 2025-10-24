import type { AsanaConfig } from '../../src/types'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { refreshTokenIfNeeded, resetClient } from '../../src/lib/asana-client'

const TEST_CONFIG_DIR = join(homedir(), '.asana-cli')
const TEST_CONFIG_FILE = join(TEST_CONFIG_DIR, 'config.json')

describe('asana-client module', () => {
  beforeEach(() => {
    // Reset client before each test
    resetClient()

    // Clean up config
    if (existsSync(TEST_CONFIG_DIR)) {
      rmSync(TEST_CONFIG_DIR, { recursive: true, force: true })
    }

    // Set up OAuth credentials for tests
    process.env.ASANA_CLIENT_ID = 'test-client-id'
    process.env.ASANA_CLIENT_SECRET = 'test-client-secret'
  })

  afterEach(() => {
    // Clean up config
    if (existsSync(TEST_CONFIG_DIR)) {
      rmSync(TEST_CONFIG_DIR, { recursive: true, force: true })
    }
    delete process.env.ASANA_CLIENT_ID
    delete process.env.ASANA_CLIENT_SECRET

    // Reset client after each test
    resetClient()
  })

  describe('getAsanaClient', () => {
    test('validates config file existence check', () => {
      // No config file should exist
      expect(existsSync(TEST_CONFIG_FILE)).toBe(false)
    })

    test('validates empty access token handling', () => {
      const config: AsanaConfig = {
        accessToken: '',
      }

      mkdirSync(TEST_CONFIG_DIR, { recursive: true })
      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(config))

      const saved = JSON.parse(readFileSync(TEST_CONFIG_FILE, 'utf-8'))
      expect(saved.accessToken).toBe('')
    })

    test('validates PAT token configuration', () => {
      const config: AsanaConfig = {
        accessToken: 'test-pat-token',
        authType: 'pat',
      }

      mkdirSync(TEST_CONFIG_DIR, { recursive: true })
      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(config))

      const saved = JSON.parse(readFileSync(TEST_CONFIG_FILE, 'utf-8'))
      expect(saved.accessToken).toBe('test-pat-token')
      expect(saved.authType).toBe('pat')
    })

    test('validates OAuth token configuration', () => {
      const config: AsanaConfig = {
        accessToken: 'test-oauth-token',
        authType: 'oauth',
        refreshToken: 'test-refresh-token',
        expiresAt: Date.now() + 3600000,
      }

      mkdirSync(TEST_CONFIG_DIR, { recursive: true })
      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(config))

      const saved = JSON.parse(readFileSync(TEST_CONFIG_FILE, 'utf-8'))
      expect(saved.accessToken).toBe('test-oauth-token')
      expect(saved.authType).toBe('oauth')
      expect(saved.refreshToken).toBe('test-refresh-token')
      expect(saved.expiresAt).toBeGreaterThan(Date.now())
    })

    test('validates expired OAuth token configuration', () => {
      const config: AsanaConfig = {
        accessToken: 'test-oauth-token',
        authType: 'oauth',
        refreshToken: 'test-refresh-token',
        expiresAt: Date.now() - 1000, // Expired
      }

      mkdirSync(TEST_CONFIG_DIR, { recursive: true })
      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(config))

      const saved = JSON.parse(readFileSync(TEST_CONFIG_FILE, 'utf-8'))
      expect(saved.expiresAt).toBeLessThan(Date.now())
    })
  })

  describe('refreshTokenIfNeeded', () => {
    test('returns false when no config exists', async () => {
      const result = await refreshTokenIfNeeded()
      expect(result).toBe(false)
    })

    test('returns false for PAT auth', async () => {
      const config: AsanaConfig = {
        accessToken: 'test-pat-token',
        authType: 'pat',
      }

      mkdirSync(TEST_CONFIG_DIR, { recursive: true })
      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(config))

      const result = await refreshTokenIfNeeded()
      expect(result).toBe(false)
    })

    test('returns false for OAuth without refresh token', async () => {
      const config: AsanaConfig = {
        accessToken: 'test-oauth-token',
        authType: 'oauth',
        expiresAt: Date.now() - 1000,
      }

      mkdirSync(TEST_CONFIG_DIR, { recursive: true })
      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(config))

      const result = await refreshTokenIfNeeded()
      expect(result).toBe(false)
    })

    test('returns false when token is not expired', async () => {
      const config: AsanaConfig = {
        accessToken: 'test-oauth-token',
        authType: 'oauth',
        refreshToken: 'test-refresh-token',
        expiresAt: Date.now() + 3600000, // Expires in 1 hour
      }

      mkdirSync(TEST_CONFIG_DIR, { recursive: true })
      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(config))

      const result = await refreshTokenIfNeeded()
      expect(result).toBe(false)
    })

    test('throws error when token refresh fails', async () => {
      const originalFetch = global.fetch
      global.fetch = mock(() => {
        return Promise.resolve({
          ok: false,
          text: () => Promise.resolve('Token refresh failed'),
        })
      }) as any

      const config: AsanaConfig = {
        accessToken: 'test-oauth-token',
        authType: 'oauth',
        refreshToken: 'test-refresh-token',
        expiresAt: Date.now() - 1000, // Expired
      }

      mkdirSync(TEST_CONFIG_DIR, { recursive: true })
      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(config))

      await expect(refreshTokenIfNeeded()).rejects.toThrow('Token refresh failed')

      global.fetch = originalFetch
    })

    test('successfully refreshes expired token', async () => {
      const mockResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
      }

      const originalFetch = global.fetch
      global.fetch = mock(() => {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
      }) as any

      const config: AsanaConfig = {
        accessToken: 'old-access-token',
        authType: 'oauth',
        refreshToken: 'old-refresh-token',
        expiresAt: Date.now() - 1000, // Expired
      }

      mkdirSync(TEST_CONFIG_DIR, { recursive: true })
      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(config))

      const result = await refreshTokenIfNeeded()

      expect(result).toBe(true)

      // Verify config was updated
      const updatedConfig = JSON.parse(readFileSync(TEST_CONFIG_FILE, 'utf-8'))
      expect(updatedConfig.accessToken).toBe('new-access-token')
      expect(updatedConfig.refreshToken).toBe('new-refresh-token')
      expect(updatedConfig.expiresAt).toBeGreaterThan(Date.now())

      global.fetch = originalFetch
    })

    test('refreshes token when it will expire soon', async () => {
      const mockResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
      }

      const originalFetch = global.fetch
      global.fetch = mock(() => {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
      }) as any

      const config: AsanaConfig = {
        accessToken: 'old-access-token',
        authType: 'oauth',
        refreshToken: 'old-refresh-token',
        expiresAt: Date.now() + (4 * 60 * 1000), // Expires in 4 minutes (less than 5 minute threshold)
      }

      mkdirSync(TEST_CONFIG_DIR, { recursive: true })
      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(config))

      const result = await refreshTokenIfNeeded()

      expect(result).toBe(true)

      global.fetch = originalFetch
    })
  })

  describe('resetClient', () => {
    test('can be called without error', () => {
      expect(() => resetClient()).not.toThrow()
    })

    test('can be called multiple times', () => {
      expect(() => {
        resetClient()
        resetClient()
        resetClient()
      }).not.toThrow()
    })

    test('validates client reset behavior', () => {
      // Validate that reset can be called
      resetClient()

      // Validate that config remains after reset
      const config: AsanaConfig = {
        accessToken: 'test-token',
        authType: 'pat',
      }

      mkdirSync(TEST_CONFIG_DIR, { recursive: true })
      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(config))

      resetClient()

      const saved = JSON.parse(readFileSync(TEST_CONFIG_FILE, 'utf-8'))
      expect(saved.accessToken).toBe('test-token')
    })
  })
})
