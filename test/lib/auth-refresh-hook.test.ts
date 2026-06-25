import { describe, expect, test } from 'bun:test'
import { shouldRefreshAuthForCommand } from '../../src/lib/asana-client'

/**
 * The CLI `preAction` hook (src/index.ts) refreshes an expiring OAuth token
 * before authenticated commands. This guards which command paths are exempt so
 * credential-management and offline commands don't trigger a refresh.
 */
describe('shouldRefreshAuthForCommand', () => {
  test('skips refresh for credential-management and offline commands', () => {
    expect(shouldRefreshAuthForCommand('auth login')).toBe(false)
    expect(shouldRefreshAuthForCommand('auth logout')).toBe(false)
    expect(shouldRefreshAuthForCommand('self-update')).toBe(false)
  })

  test('refreshes for authenticated API commands', () => {
    expect(shouldRefreshAuthForCommand('auth whoami')).toBe(true)
    expect(shouldRefreshAuthForCommand('task list')).toBe(true)
    expect(shouldRefreshAuthForCommand('workspace list')).toBe(true)
    expect(shouldRefreshAuthForCommand('project create')).toBe(true)
  })
})
