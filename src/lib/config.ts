import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AsanaConfig } from '../types'

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

export function getAccessToken(): string | null {
  const config = loadConfig()
  return config?.accessToken || process.env.ASANA_ACCESS_TOKEN || null
}
