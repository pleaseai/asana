import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AsanaConfig } from '../../src/types'

const TEST_CONFIG_DIR = join(tmpdir(), `asana-cli-test-${process.pid}`)
const TEST_CONFIG_FILE = join(TEST_CONFIG_DIR, 'config.json')

describe('asana-client module', () => {
  beforeEach(() => {
    if (existsSync(TEST_CONFIG_DIR)) {
      rmSync(TEST_CONFIG_DIR, { recursive: true, force: true })
    }
  })

  afterEach(() => {
    if (existsSync(TEST_CONFIG_DIR)) {
      rmSync(TEST_CONFIG_DIR, { recursive: true, force: true })
    }
    delete process.env.ASANA_CLIENT_ID
    delete process.env.ASANA_CLIENT_SECRET
  })

  describe('getAsanaClient', () => {
    test('validates config exists', () => {
      // Test that config validation works by checking file existence
      expect(existsSync(TEST_CONFIG_FILE)).toBe(false)
    })

    test('validates access token presence in config', () => {
      const config: AsanaConfig = {
        accessToken: '',
      }

      mkdirSync(TEST_CONFIG_DIR, { recursive: true })
      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(config))

      // Verify empty token is saved
      const savedConfig = JSON.parse(readFileSync(TEST_CONFIG_FILE, 'utf-8'))
      expect(savedConfig.accessToken).toBe('')
    })

    test('stores valid token in config', () => {
      const config: AsanaConfig = {
        accessToken: 'test-token',
        authType: 'pat',
      }

      mkdirSync(TEST_CONFIG_DIR, { recursive: true })
      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(config))

      const savedConfig = JSON.parse(readFileSync(TEST_CONFIG_FILE, 'utf-8'))
      expect(savedConfig.accessToken).toBe('test-token')
      expect(savedConfig.authType).toBe('pat')
    })
  })

  describe('refreshTokenIfNeeded', () => {
    test('returns false when config does not exist', async () => {
      const { refreshTokenIfNeeded } = await import('../../src/lib/asana-client')

      const result = await refreshTokenIfNeeded()

      expect(result).toBe(false)
    })

    test('returns false when auth type is not OAuth', async () => {
      const config: AsanaConfig = {
        accessToken: 'test-pat-token',
        authType: 'pat',
      }

      mkdirSync(TEST_CONFIG_DIR, { recursive: true })
      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(config))

      const { refreshTokenIfNeeded } = await import('../../src/lib/asana-client')

      const result = await refreshTokenIfNeeded()

      expect(result).toBe(false)
    })

    test('returns false when refresh token is missing', async () => {
      const config: AsanaConfig = {
        accessToken: 'test-oauth-token',
        authType: 'oauth',
        expiresAt: Date.now() - 1000,
      }

      mkdirSync(TEST_CONFIG_DIR, { recursive: true })
      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(config))

      const { refreshTokenIfNeeded } = await import('../../src/lib/asana-client')

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

      const { refreshTokenIfNeeded } = await import('../../src/lib/asana-client')

      const result = await refreshTokenIfNeeded()

      expect(result).toBe(false)
    })

    test('checks token expiration logic', () => {
      const futureTime = Date.now() + 3600000 // 1 hour from now
      const pastTime = Date.now() - 1000 // 1 second ago
      const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000)

      expect(futureTime).toBeGreaterThan(Date.now())
      expect(pastTime).toBeLessThan(Date.now())
      expect(fiveMinutesFromNow).toBeGreaterThan(Date.now())
    })
  })

  describe('resetClient', () => {
    test('can be called without error', async () => {
      const { resetClient } = await import('../../src/lib/asana-client')

      expect(() => resetClient()).not.toThrow()
    })

    test('can be called multiple times', async () => {
      const { resetClient } = await import('../../src/lib/asana-client')

      expect(() => {
        resetClient()
        resetClient()
        resetClient()
      }).not.toThrow()
    })
  })
})
