/**
 * File-based cache with TTL for slow-changing Asana data
 *
 * Workspace and team lists rarely change, so commands cache them on disk
 * (cache.json in the config dir, ~/.asana-cli by default) to avoid repeated
 * API round-trips.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { getConfigDir } from './config'

export const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000

interface CacheEntry {
  value: unknown
  expiresAt: number
}

type CacheStore = Record<string, CacheEntry>

export class FileCache {
  constructor(
    private readonly filePath: string,
    private readonly defaultTtlMs: number = DEFAULT_CACHE_TTL_MS,
  ) {}

  get<T>(key: string): T | null {
    const entry = this.load()[key]

    if (!entry || Date.now() >= entry.expiresAt) {
      return null
    }

    return entry.value as T
  }

  set(key: string, value: unknown, ttlMs: number = this.defaultTtlMs): void {
    const store = this.load()
    store[key] = { value, expiresAt: Date.now() + ttlMs }
    this.persist(store)
  }

  clear(): void {
    this.persist({})
  }

  private load(): CacheStore {
    if (!existsSync(this.filePath)) {
      return {}
    }

    try {
      return JSON.parse(readFileSync(this.filePath, 'utf-8'))
    }
    catch {
      // Corrupt cache is not fatal; behave as if empty and let set() rewrite it
      return {}
    }
  }

  private persist(store: CacheStore): void {
    try {
      const dir = dirname(this.filePath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      writeFileSync(this.filePath, JSON.stringify(store))
    }
    catch {
      // Cache is a performance optimization; a failed write (permissions,
      // full disk) must never fail the command that triggered it
    }
  }
}

/**
 * Cache in the current config dir. Resolved on every call so it follows
 * `ASANA_CONFIG_DIR` changes, matching config.json; FileCache holds no
 * in-memory state, so a fresh instance is cheap.
 */
export function getDefaultCache(): FileCache {
  return new FileCache(join(getConfigDir(), 'cache.json'))
}
