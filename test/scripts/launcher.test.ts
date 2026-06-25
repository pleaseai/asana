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
    test('warns and returns exit code 1 when no platform package is installed', () => {
      // A platform that has no published package and is not installed here.
      // Stub stderr so the intentional warning stays out of the test output
      // while we still assert the user-facing message.
      const written: string[] = []
      const original = process.stderr.write
      process.stderr.write = ((chunk: string | Uint8Array): boolean => {
        written.push(String(chunk))
        return true
      }) as typeof process.stderr.write
      try {
        const code = launcher.run(['--version'], 'sunos', 'mips')
        expect(code).toBe(1)
      }
      finally {
        process.stderr.write = original
      }
      expect(written.join('')).toContain('no prebuilt binary for sunos-mips')
    })
  })
})
