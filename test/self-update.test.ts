import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { compareVersions } from '../src/commands/self-update'

describe('self-update command', () => {
  beforeEach(() => {
    // Mock fetch for GitHub API calls
    global.fetch = mock(async (url: string | URL | Request) => {
      const urlStr = url.toString()

      if (urlStr.includes('/releases/latest')) {
        return new Response(JSON.stringify({
          tag_name: 'v0.2.0',
          name: 'Release v0.2.0',
          prerelease: false,
          assets: [
            {
              name: 'asana-darwin-x64',
              browser_download_url: 'https://example.com/asana-darwin-x64',
            },
            {
              name: 'asana-darwin-x64.sha256',
              browser_download_url: 'https://example.com/asana-darwin-x64.sha256',
            },
          ],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response('Not found', { status: 404 })
    }) as typeof fetch
  })

  afterEach(() => {
    mock.restore()
  })

  test('should detect platform correctly', () => {
    const platform = process.platform
    const arch = process.arch

    expect(['darwin', 'linux']).toContain(platform)
    expect(['x64', 'arm64']).toContain(arch)
  })

  test('should compare versions correctly', () => {
    expect(compareVersions('0.1.0', '0.2.0')).toBe(-1)
    expect(compareVersions('0.2.0', '0.1.0')).toBe(1)
    expect(compareVersions('0.1.0', '0.1.0')).toBe(0)
    expect(compareVersions('v0.1.0', 'v0.2.0')).toBe(-1)
    expect(compareVersions('1.0.0', '0.9.9')).toBe(1)
  })

  test('should treat non-numeric (pre-release) segments as zero', () => {
    // `Number('0-beta')` is NaN, which the `|| 0` fallback coerces to 0,
    // so a pre-release tag compares equal to its release version.
    expect(compareVersions('0.7.0-beta.1', '0.7.0')).toBe(0)
  })

  test('should fetch latest release from GitHub', async () => {
    const response = await fetch('https://api.github.com/repos/pleaseai/asana/releases/latest')
    expect(response.ok).toBe(true)

    const data = await response.json() as any
    expect(data.tag_name).toBe('v0.2.0')
    expect(data.assets).toHaveLength(2)
  })

  test('should handle homebrew installation detection', () => {
    const isHomebrewPath = (path: string): boolean => {
      return path.includes('/Cellar/') || path.includes('/opt/homebrew/')
    }

    expect(isHomebrewPath('/usr/local/Cellar/asana-cli/0.1.0/bin/asana')).toBe(true)
    expect(isHomebrewPath('/opt/homebrew/bin/asana')).toBe(true)
    expect(isHomebrewPath('/home/user/.local/bin/asana')).toBe(false)
    expect(isHomebrewPath('/usr/local/bin/asana')).toBe(false)
  })
})
