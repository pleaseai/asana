import { createRequire } from 'node:module'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'

// The launcher ships as published CommonJS; load it the same way npm would.
const require = createRequire(import.meta.url)
const launcher = require(join(import.meta.dir, '../../npm/asana.cjs')) as {
  platformPackageName: (platform: string, arch: string) => string
  resolveBinaryPath: (platform: string, arch: string) => string
  run: (argv: string[], platform: string, arch: string) => number
}

describe('launcher', () => {
  describe('platformPackageName', () => {
    test('maps darwin arm64 to the scoped platform package', () => {
      expect(launcher.platformPackageName('darwin', 'arm64')).toBe('@pleaseai/asana-darwin-arm64')
    })

    test('maps linux x64 to the scoped platform package', () => {
      expect(launcher.platformPackageName('linux', 'x64')).toBe('@pleaseai/asana-linux-x64')
    })
  })

  describe('run', () => {
    test('returns exit code 1 when no platform package is installed', () => {
      // A platform that has no published package and is not installed here.
      const code = launcher.run(['--version'], 'sunos', 'mips')
      expect(code).toBe(1)
    })
  })
})
