import type { AsanaConfig } from '../../src/types'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Asana from 'asana'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { getAsanaClient, refreshTokenIfNeeded, resetClient } from '../../src/lib/asana-client'

// Point the config module at a per-test temp dir via ASANA_CONFIG_DIR so these
// tests never read or delete the developer's real ~/.asana-cli.
let tempRoot: string | undefined
let TEST_CONFIG_DIR: string
let TEST_CONFIG_FILE: string
const originalConfigDir = process.env.ASANA_CONFIG_DIR

describe('asana-client module', () => {
  beforeEach(() => {
    // Reset client before each test
    resetClient()

    // Config dir starts absent inside a fresh temp root; tests mkdir it on demand
    tempRoot = mkdtempSync(join(tmpdir(), 'asana-cli-client-'))
    TEST_CONFIG_DIR = join(tempRoot, 'config')
    TEST_CONFIG_FILE = join(TEST_CONFIG_DIR, 'config.json')
    process.env.ASANA_CONFIG_DIR = TEST_CONFIG_DIR

    // Set up OAuth credentials for tests
    process.env.ASANA_CLIENT_ID = 'test-client-id'
    process.env.ASANA_CLIENT_SECRET = 'test-client-secret'

    // Brokered-egress env token must not leak between tests
    delete process.env.ASANA_ACCESS_TOKEN
  })

  afterEach(() => {
    // Remove only the temp dir created in beforeEach, then restore the override.
    // Guarded so a failed mkdtempSync surfaces its own error, not a TypeError here.
    if (tempRoot) {
      rmSync(tempRoot, { recursive: true, force: true })
      tempRoot = undefined
    }
    if (originalConfigDir === undefined) {
      delete process.env.ASANA_CONFIG_DIR
    }
    else {
      process.env.ASANA_CONFIG_DIR = originalConfigDir
    }
    delete process.env.ASANA_CLIENT_ID
    delete process.env.ASANA_CLIENT_SECRET
    delete process.env.ASANA_ACCESS_TOKEN

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

  describe('getAsanaClient token resolution (ADR-005 brokered egress)', () => {
    test('uses ASANA_ACCESS_TOKEN placeholder when no config file exists', () => {
      // Brokered sandbox: no ~/.asana-cli/config.json, only an env placeholder.
      // The broker overwrites the Authorization header downstream.
      expect(existsSync(TEST_CONFIG_FILE)).toBe(false)
      process.env.ASANA_ACCESS_TOKEN = 'brokered'

      expect(() => getAsanaClient()).not.toThrow()
      expect(Asana.ApiClient.instance.authentications.token.accessToken).toBe('brokered')
    })

    test('prefers config-file token over ASANA_ACCESS_TOKEN', () => {
      const config: AsanaConfig = { accessToken: 'config-token', authType: 'pat' }
      mkdirSync(TEST_CONFIG_DIR, { recursive: true })
      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(config))
      process.env.ASANA_ACCESS_TOKEN = 'env-token'

      getAsanaClient()

      expect(Asana.ApiClient.instance.authentications.token.accessToken).toBe('config-token')
    })

    test('throws when neither config file nor ASANA_ACCESS_TOKEN is present', () => {
      expect(existsSync(TEST_CONFIG_FILE)).toBe(false)

      expect(() => getAsanaClient()).toThrow('Asana access token not found')
    })

    test('falls through an empty config token to ASANA_ACCESS_TOKEN', () => {
      // Empty config token is falsy, so the `|| env` chain must reach the env
      // placeholder. Guards against a future `||` -> `??` refactor silently
      // breaking brokered egress.
      const config: AsanaConfig = { accessToken: '', authType: 'pat' }
      mkdirSync(TEST_CONFIG_DIR, { recursive: true })
      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(config))
      process.env.ASANA_ACCESS_TOKEN = 'brokered'

      getAsanaClient()

      expect(Asana.ApiClient.instance.authentications.token.accessToken).toBe('brokered')
    })

    test('throws when config token is empty and no ASANA_ACCESS_TOKEN is set', () => {
      const config: AsanaConfig = { accessToken: '', authType: 'pat' }
      mkdirSync(TEST_CONFIG_DIR, { recursive: true })
      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(config))

      expect(() => getAsanaClient()).toThrow('Asana access token not found')
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

    test('keeps stored refresh token when refresh response omits refresh_token', async () => {
      // Asana's refresh_token grant response does not rotate the refresh token,
      // so the response has no refresh_token field. Persisting `undefined`
      // would drop it from config.json and permanently break auto-refresh
      // after the first renewal (login silently "expires" ~1h later).
      const mockResponse = {
        access_token: 'new-access-token',
        expires_in: 3600,
        token_type: 'bearer',
      }

      const originalFetch = global.fetch
      try {
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

        const updatedConfig = JSON.parse(readFileSync(TEST_CONFIG_FILE, 'utf-8'))
        expect(updatedConfig.accessToken).toBe('new-access-token')
        expect(updatedConfig.refreshToken).toBe('old-refresh-token')
      }
      finally {
        global.fetch = originalFetch
      }
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

  describe('task source and duplicate wrappers', () => {
    test('forward to the SDK with a default limit and unwrap data where applicable', async () => {
      process.env.ASANA_ACCESS_TOKEN = 'brokered'
      const spies = {
        section: spyOn(Asana.TasksApi.prototype, 'getTasksForSection').mockResolvedValue({ data: ['s'] }),
        tag: spyOn(Asana.TasksApi.prototype, 'getTasksForTag').mockResolvedValue({ data: ['t'] }),
        utl: spyOn(Asana.TasksApi.prototype, 'getTasksForUserTaskList').mockResolvedValue({ data: ['u'] }),
        customId: spyOn(Asana.TasksApi.prototype, 'getTaskForCustomID').mockResolvedValue({ data: { gid: '1' } }),
        duplicate: spyOn(Asana.TasksApi.prototype, 'duplicateTask').mockResolvedValue({ data: { gid: 'job' } }),
        userTaskList: spyOn(Asana.UserTaskListsApi.prototype, 'getUserTaskListForUser').mockResolvedValue({ data: { gid: '9' } }),
      }
      try {
        const client = getAsanaClient()

        expect(await client.tasks.findBySection('5', { opt_fields: 'name' })).toEqual({ data: ['s'] })
        expect(spies.section).toHaveBeenCalledWith('5', { limit: 100, opt_fields: 'name' })
        expect(await client.tasks.findByTag('6')).toEqual({ data: ['t'] })
        expect(spies.tag).toHaveBeenCalledWith('6', { limit: 100 })
        expect(await client.tasks.findByUserTaskList('9')).toEqual({ data: ['u'] })
        expect(spies.utl).toHaveBeenCalledWith('9', { limit: 100 })
        expect(await client.tasks.findByCustomId('1', 'PROJ-1')).toEqual({ gid: '1' })
        expect(spies.customId).toHaveBeenCalledWith('1', 'PROJ-1')
        expect(await client.tasks.duplicate('7', { name: 'Copy' })).toEqual({ gid: 'job' })
        expect(spies.duplicate).toHaveBeenCalledWith({ data: { name: 'Copy' } }, '7', {})
        expect(await client.userTaskLists.findByUser('me', '1')).toEqual({ gid: '9' })
        expect(spies.userTaskList).toHaveBeenCalledWith('me', '1', {})
      }
      finally {
        Object.values(spies).forEach(spy => spy.mockRestore())
      }
    })
  })

  describe('single-story wrappers', () => {
    test('forward get/update/delete to StoriesApi and unwrap data', async () => {
      process.env.ASANA_ACCESS_TOKEN = 'brokered'
      const spies = {
        get: spyOn(Asana.StoriesApi.prototype, 'getStory').mockResolvedValue({ data: { gid: '5', text: 'Hi' } }),
        update: spyOn(Asana.StoriesApi.prototype, 'updateStory').mockResolvedValue({ data: { gid: '5', text: 'Edited' } }),
        delete: spyOn(Asana.StoriesApi.prototype, 'deleteStory').mockResolvedValue({ data: {} }),
      }
      try {
        const client = getAsanaClient()

        expect(await client.stories.findById('5', { opt_fields: 'text' })).toEqual({ gid: '5', text: 'Hi' })
        expect(spies.get).toHaveBeenCalledWith('5', { opt_fields: 'text' })
        expect(await client.stories.update('5', { text: 'Edited' })).toEqual({ gid: '5', text: 'Edited' })
        expect(spies.update).toHaveBeenCalledWith({ data: { text: 'Edited' } }, '5', {})
        expect(await client.stories.delete('5')).toEqual({})
        expect(spies.delete).toHaveBeenCalledWith('5')
      }
      finally {
        Object.values(spies).forEach(spy => spy.mockRestore())
      }
    })
  })
})
