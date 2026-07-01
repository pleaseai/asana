import type { AsanaConfig } from '../types'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const CONFIG_DIR = join(homedir(), '.asana-cli')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

export function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
}

export function saveConfig(config: AsanaConfig): void {
  ensureConfigDir()
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
}

export function loadConfig(): AsanaConfig | null {
  if (!existsSync(CONFIG_FILE)) {
    return null
  }

  try {
    const data = readFileSync(CONFIG_FILE, 'utf-8')
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
  if (!existsSync(CONFIG_FILE)) {
    return null
  }

  const data = readFileSync(CONFIG_FILE, 'utf-8')
  return JSON.parse(data) as AsanaConfig
}

export function getAccessToken(config: AsanaConfig | null = loadConfig()): string | null {
  return config?.accessToken || process.env.ASANA_ACCESS_TOKEN || null
}
