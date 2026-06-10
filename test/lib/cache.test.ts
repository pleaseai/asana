import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { DEFAULT_CACHE_TTL_MS, FileCache } from '../../src/lib/cache'

describe('FileCache', () => {
  let cacheDir: string
  let cacheFile: string

  beforeEach(() => {
    cacheDir = mkdtempSync(join(tmpdir(), 'asana-cli-cache-'))
    cacheFile = join(cacheDir, 'cache.json')
  })

  afterEach(() => {
    rmSync(cacheDir, { recursive: true, force: true })
  })

  describe('get and set', () => {
    test('should return null for missing key', () => {
      const cache = new FileCache(cacheFile)

      expect(cache.get('missing')).toBeNull()
    })

    test('should return stored value before TTL expires', () => {
      const cache = new FileCache(cacheFile)

      cache.set('workspaces', [{ gid: '1', name: 'Acme' }])

      expect(cache.get('workspaces')).toEqual([{ gid: '1', name: 'Acme' }])
    })

    test('should persist values across instances', () => {
      const writer = new FileCache(cacheFile)
      writer.set('teams:42', [{ gid: '7', name: 'Platform' }])

      const reader = new FileCache(cacheFile)

      expect(reader.get('teams:42')).toEqual([{ gid: '7', name: 'Platform' }])
    })

    test('should return null after TTL expires', () => {
      const cache = new FileCache(cacheFile, -1)

      cache.set('workspaces', [{ gid: '1' }])

      expect(cache.get('workspaces')).toBeNull()
    })

    test('should use per-entry TTL over default TTL', () => {
      const cache = new FileCache(cacheFile, DEFAULT_CACHE_TTL_MS)

      cache.set('expired', 'value', -1)
      cache.set('fresh', 'value')

      expect(cache.get('expired')).toBeNull()
      expect(cache.get('fresh')).toBe('value')
    })
  })

  describe('clear', () => {
    test('should remove all entries', () => {
      const cache = new FileCache(cacheFile)
      cache.set('a', 1)
      cache.set('b', 2)

      cache.clear()

      expect(cache.get('a')).toBeNull()
      expect(cache.get('b')).toBeNull()
    })
  })

  describe('corrupt cache file', () => {
    test('should treat unreadable JSON as empty cache', () => {
      writeFileSync(cacheFile, 'not-json{{{')
      const cache = new FileCache(cacheFile)

      expect(cache.get('anything')).toBeNull()
    })

    test('should recover by overwriting corrupt file on set', () => {
      writeFileSync(cacheFile, 'not-json{{{')
      const cache = new FileCache(cacheFile)

      cache.set('key', 'value')

      expect(cache.get('key')).toBe('value')
      expect(existsSync(cacheFile)).toBe(true)
    })
  })
})
