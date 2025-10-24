import type { AsanaConfig } from '../../src/types'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

// Test helper functions that mimic the config module behavior
const TEST_CONFIG_DIR = join(tmpdir(), `asana-cli-test-${process.pid}`)
const TEST_CONFIG_FILE = join(TEST_CONFIG_DIR, 'config.json')

function testEnsureConfigDir(): void {
  if (!existsSync(TEST_CONFIG_DIR)) {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true })
  }
}

function testSaveConfig(config: AsanaConfig): void {
  testEnsureConfigDir()
  writeFileSync(TEST_CONFIG_FILE, JSON.stringify(config, null, 2))
}

function testLoadConfig(): AsanaConfig | null {
  if (!existsSync(TEST_CONFIG_FILE)) {
    return null
  }

  try {
    const data = readFileSync(TEST_CONFIG_FILE, 'utf-8')
    return JSON.parse(data)
  }
  catch (error) {
    console.error('Failed to load config:', error)
    return null
  }
}

function testGetAccessToken(): string | null {
  const config = testLoadConfig()
  return config?.accessToken || process.env.ASANA_ACCESS_TOKEN || null
}

describe('config module logic', () => {
  beforeEach(() => {
    // Clean up test directory before each test
    if (existsSync(TEST_CONFIG_DIR)) {
      rmSync(TEST_CONFIG_DIR, { recursive: true, force: true })
    }
  })

  afterEach(() => {
    // Clean up test directory after each test
    if (existsSync(TEST_CONFIG_DIR)) {
      rmSync(TEST_CONFIG_DIR, { recursive: true, force: true })
    }
    // Clear environment variables
    delete process.env.ASANA_ACCESS_TOKEN
  })

  describe('ensureConfigDir', () => {
    test('creates config directory if it does not exist', () => {
      expect(existsSync(TEST_CONFIG_DIR)).toBe(false)

      testEnsureConfigDir()

      expect(existsSync(TEST_CONFIG_DIR)).toBe(true)
    })

    test('does nothing if config directory already exists', () => {
      mkdirSync(TEST_CONFIG_DIR, { recursive: true })
      expect(existsSync(TEST_CONFIG_DIR)).toBe(true)

      testEnsureConfigDir()

      expect(existsSync(TEST_CONFIG_DIR)).toBe(true)
    })
  })

  describe('saveConfig', () => {
    test('creates config directory and saves config', () => {
      const config: AsanaConfig = {
        accessToken: 'test-token-123',
        authType: 'pat',
      }

      testSaveConfig(config)

      expect(existsSync(TEST_CONFIG_DIR)).toBe(true)
      expect(existsSync(TEST_CONFIG_FILE)).toBe(true)

      const savedData = JSON.parse(readFileSync(TEST_CONFIG_FILE, 'utf-8'))
      expect(savedData).toEqual(config)
    })

    test('saves OAuth config with all fields', () => {
      const config: AsanaConfig = {
        accessToken: 'oauth-token',
        refreshToken: 'refresh-token',
        authType: 'oauth',
        workspace: 'workspace-123',
        expiresAt: Date.now() + 3600000,
      }

      testSaveConfig(config)

      const savedData = JSON.parse(readFileSync(TEST_CONFIG_FILE, 'utf-8'))
      expect(savedData).toEqual(config)
    })

    test('overwrites existing config', () => {
      const config1: AsanaConfig = {
        accessToken: 'token-1',
        authType: 'pat',
      }

      const config2: AsanaConfig = {
        accessToken: 'token-2',
        authType: 'oauth',
        refreshToken: 'refresh',
      }

      testSaveConfig(config1)
      testSaveConfig(config2)

      const savedData = JSON.parse(readFileSync(TEST_CONFIG_FILE, 'utf-8'))
      expect(savedData).toEqual(config2)
    })
  })

  describe('loadConfig', () => {
    test('returns null if config file does not exist', () => {
      const config = testLoadConfig()

      expect(config).toBeNull()
    })

    test('loads and parses existing config', () => {
      const expectedConfig: AsanaConfig = {
        accessToken: 'test-token',
        authType: 'pat',
        workspace: 'ws-123',
      }

      mkdirSync(TEST_CONFIG_DIR, { recursive: true })
      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(expectedConfig))

      const config = testLoadConfig()

      expect(config).toEqual(expectedConfig)
    })

    test('returns null and logs error for invalid JSON', () => {
      const consoleErrorSpy = mock(() => {})
      const originalConsoleError = console.error
      console.error = consoleErrorSpy

      mkdirSync(TEST_CONFIG_DIR, { recursive: true })
      writeFileSync(TEST_CONFIG_FILE, 'invalid json {')

      const config = testLoadConfig()

      expect(config).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()

      console.error = originalConsoleError
    })

    test('loads OAuth config with all fields', () => {
      const expectedConfig: AsanaConfig = {
        accessToken: 'oauth-token',
        refreshToken: 'refresh-token',
        authType: 'oauth',
        workspace: 'workspace-123',
        expiresAt: Date.now() + 3600000,
      }

      mkdirSync(TEST_CONFIG_DIR, { recursive: true })
      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(expectedConfig))

      const config = testLoadConfig()

      expect(config).toEqual(expectedConfig)
    })
  })

  describe('getAccessToken', () => {
    test('returns access token from config file', () => {
      const config: AsanaConfig = {
        accessToken: 'config-token',
        authType: 'pat',
      }

      mkdirSync(TEST_CONFIG_DIR, { recursive: true })
      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(config))

      const token = testGetAccessToken()

      expect(token).toBe('config-token')
    })

    test('returns token from environment variable if config does not exist', () => {
      process.env.ASANA_ACCESS_TOKEN = 'env-token'

      const token = testGetAccessToken()

      expect(token).toBe('env-token')
    })

    test('prioritizes config token over environment variable', () => {
      const config: AsanaConfig = {
        accessToken: 'config-token',
        authType: 'pat',
      }

      mkdirSync(TEST_CONFIG_DIR, { recursive: true })
      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(config))
      process.env.ASANA_ACCESS_TOKEN = 'env-token'

      const token = testGetAccessToken()

      expect(token).toBe('config-token')
    })

    test('returns null if no token is available', () => {
      const token = testGetAccessToken()

      expect(token).toBeNull()
    })
  })
})
