import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { getConfigDir, loadConfig, saveConfig } from '../../src/lib/config'

const DEFAULT_CONFIG_DIR = join(homedir(), '.asana-cli')

describe('getConfigDir', () => {
  const originalConfigDir = process.env.ASANA_CONFIG_DIR
  let tempConfigDir: string

  beforeEach(() => {
    tempConfigDir = mkdtempSync(join(tmpdir(), 'asana-cli-config-dir-'))
  })

  afterEach(() => {
    rmSync(tempConfigDir, { recursive: true, force: true })
    if (originalConfigDir === undefined) {
      delete process.env.ASANA_CONFIG_DIR
    }
    else {
      process.env.ASANA_CONFIG_DIR = originalConfigDir
    }
  })

  test('follows ASANA_CONFIG_DIR set after the module was imported', () => {
    process.env.ASANA_CONFIG_DIR = tempConfigDir

    expect(getConfigDir()).toBe(tempConfigDir)
    expect(getConfigDir()).not.toBe(DEFAULT_CONFIG_DIR)
  })

  test('saveConfig and loadConfig read and write config.json inside ASANA_CONFIG_DIR', () => {
    process.env.ASANA_CONFIG_DIR = tempConfigDir

    saveConfig({ accessToken: 'override-token', authType: 'pat' })

    expect(existsSync(join(tempConfigDir, 'config.json'))).toBe(true)
    expect(loadConfig()?.accessToken).toBe('override-token')
  })

  test('falls back to ~/.asana-cli when ASANA_CONFIG_DIR is unset', () => {
    delete process.env.ASANA_CONFIG_DIR

    expect(getConfigDir()).toBe(DEFAULT_CONFIG_DIR)
  })

  test('falls back to ~/.asana-cli when ASANA_CONFIG_DIR is empty', () => {
    process.env.ASANA_CONFIG_DIR = ''

    expect(getConfigDir()).toBe(DEFAULT_CONFIG_DIR)
  })
})
