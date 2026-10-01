import type { AsanaConfig } from '../types'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DEFAULT_CONFIG_DIR_NAME = '.asana-cli'
const CONFIG_FILE_NAME = 'config.json'

/**
 * Directory holding config.json and cache.json. Overridable via
 * `ASANA_CONFIG_DIR` (tests, sandboxes, multiple accounts); resolved at call
 * time so the override applies even when set after this module is imported.
 */
export function getConfigDir(): string {
  return process.env.ASANA_CONFIG_DIR || join(homedir(), DEFAULT_CONFIG_DIR_NAME)
}

function getConfigFile(): string {
  return join(getConfigDir(), CONFIG_FILE_NAME)
}

export function ensureConfigDir(): void {
  const configDir = getConfigDir()
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true })
  }
}

export function saveConfig(config: AsanaConfig): void {
  ensureConfigDir()
  writeFileSync(getConfigFile(), JSON.stringify(config, null, 2))
}

export function loadConfig(): AsanaConfig | null {
  const configFile = getConfigFile()
  if (!existsSync(configFile)) {
    return null
  }

  try {
    const data = readFileSync(configFile, 'utf-8')
    return JSON.parse(data)
  }
  catch (error) {
    console.error('Failed to load config:', error)
    return null
  }
}

/**
 * Load the config while distinguishing "no config" from "corrupt config".
 * Returns null only when the file is absent; unlike {@link loadConfig}, it
 * throws when the file exists but can't be read or parsed, so callers that need
 * to surface a real configuration failure (e.g. the SessionStart hook) can tell
 * a broken config apart from a logged-out state. {@link loadConfig} keeps its
 * swallow-and-return-null contract for the CLI's degrade-gracefully paths.
 */
export function loadConfigStrict(): AsanaConfig | null {
  const configFile = getConfigFile()
  if (!existsSync(configFile)) {
    return null
  }

  const data = readFileSync(configFile, 'utf-8')
  return JSON.parse(data) as AsanaConfig
}

export function getAccessToken(config: AsanaConfig | null = loadConfig()): string | null {
  return config?.accessToken || process.env.ASANA_ACCESS_TOKEN || null
}
