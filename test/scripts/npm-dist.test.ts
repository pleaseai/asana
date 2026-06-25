import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  buildMainPackageJson,
  buildPlatformPackageJson,
  normalizeVersion,
  PLATFORM_TARGETS,
  platformPackageName,
  prepareNpmDist,
  resolveArtifactPath,
} from '../../scripts/npm-dist'

const DARWIN_ARM64 = { os: 'darwin', cpu: 'arm64', artifact: 'asana-darwin-arm64' }
const BASE = {
  name: '@pleaseai/asana',
  description: 'Asana CLI',
  license: 'MIT',
  homepage: 'https://example.com',
  repository: { type: 'git', url: 'https://example.com.git' },
  bugs: { url: 'https://example.com/issues' },
  keywords: ['asana', 'cli'],
  author: { name: 'Minsu Lee' },
}

describe('normalizeVersion', () => {
  test('strips a leading v from a git tag', () => {
    expect(normalizeVersion('v0.7.1')).toBe('0.7.1')
  })

  test('leaves a bare semver untouched', () => {
    expect(normalizeVersion('0.7.1')).toBe('0.7.1')
  })
})

describe('platformPackageName', () => {
  test('builds a scoped, os/cpu suffixed name', () => {
    expect(platformPackageName(DARWIN_ARM64)).toBe('@pleaseai/asana-darwin-arm64')
  })
})

describe('buildPlatformPackageJson', () => {
  test('constrains install to the matching os and cpu', () => {
    const pkg = buildPlatformPackageJson(DARWIN_ARM64, '0.7.1', BASE)
    expect(pkg.name).toBe('@pleaseai/asana-darwin-arm64')
    expect(pkg.version).toBe('0.7.1')
    expect(pkg.os).toEqual(['darwin'])
    expect(pkg.cpu).toEqual(['arm64'])
    expect(pkg.files).toEqual(['bin'])
  })
})

describe('buildMainPackageJson', () => {
  test('declares every target as a version-pinned optional dependency', () => {
    const pkg = buildMainPackageJson('0.7.1', BASE, PLATFORM_TARGETS)
    const optional = pkg.optionalDependencies as Record<string, string>
    expect(Object.keys(optional)).toHaveLength(PLATFORM_TARGETS.length)
    expect(optional['@pleaseai/asana-darwin-arm64']).toBe('0.7.1')
    expect(optional['@pleaseai/asana-linux-x64']).toBe('0.7.1')
  })

  test('points bin at the launcher and ships only bin', () => {
    const pkg = buildMainPackageJson('0.7.1', BASE, PLATFORM_TARGETS)
    expect(pkg.bin).toEqual({ asana: './bin/asana.cjs' })
    expect(pkg.files).toEqual(['bin'])
  })

  test('declares no runtime dependencies (binary is self-contained) and is publishable', () => {
    const pkg = buildMainPackageJson('0.7.1', BASE, PLATFORM_TARGETS)
    expect(pkg.dependencies).toBeUndefined()
    expect(pkg.private).toBeUndefined()
    expect(pkg.publishConfig).toEqual({ access: 'public' })
  })
})

describe('resolveArtifactPath', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'npm-dist-artifact-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  test('prefers the nested download-artifact layout', () => {
    mkdirSync(join(dir, 'asana-darwin-arm64'), { recursive: true })
    writeFileSync(join(dir, 'asana-darwin-arm64', 'asana-darwin-arm64'), 'BIN')
    expect(resolveArtifactPath(dir, DARWIN_ARM64)).toBe(
      join(dir, 'asana-darwin-arm64', 'asana-darwin-arm64'),
    )
  })

  test('falls back to a flat layout', () => {
    writeFileSync(join(dir, 'asana-darwin-arm64'), 'BIN')
    expect(resolveArtifactPath(dir, DARWIN_ARM64)).toBe(join(dir, 'asana-darwin-arm64'))
  })
})

describe('prepareNpmDist', () => {
  let root: string
  let binaries: string
  let out: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'npm-dist-root-'))
    binaries = mkdtempSync(join(tmpdir(), 'npm-dist-bins-'))
    out = mkdtempSync(join(tmpdir(), 'npm-dist-out-'))

    // Minimal repo skeleton: dev package.json + launcher template + docs.
    writeFileSync(join(root, 'package.json'), JSON.stringify({ ...BASE, private: true }))
    writeFileSync(join(root, 'README.md'), '# asana')
    writeFileSync(join(root, 'LICENSE'), 'MIT License')
    mkdirSync(join(root, 'npm'), { recursive: true })
    // Copy the real launcher so the integration mirrors production.
    cpSync(join(import.meta.dir, '../../npm/asana.cjs'), join(root, 'npm', 'asana.cjs'))

    // Fake binary artifacts in the nested layout for every target.
    for (const target of PLATFORM_TARGETS) {
      mkdirSync(join(binaries, target.artifact), { recursive: true })
      writeFileSync(join(binaries, target.artifact, target.artifact), `BIN:${target.artifact}`)
    }
  })

  afterEach(() => {
    for (const dir of [root, binaries, out]) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('emits one package per target plus the main package, main last', () => {
    const prepared = prepareNpmDist({ version: 'v0.7.1', rootDir: root, binariesDir: binaries, outDir: out })
    expect(prepared).toHaveLength(PLATFORM_TARGETS.length + 1)
    expect(prepared.at(-1)?.dir).toBe('main')
  })

  test('writes each platform binary as an executable named asana', () => {
    prepareNpmDist({ version: '0.7.1', rootDir: root, binariesDir: binaries, outDir: out })
    const binPath = join(out, 'asana-darwin-arm64', 'bin', 'asana')
    expect(existsSync(binPath)).toBe(true)
    expect(readFileSync(binPath, 'utf8')).toBe('BIN:asana-darwin-arm64')
    // Executable bit restored (download-artifact drops it).
    expect(statSync(binPath).mode & 0o111).toBeGreaterThan(0)
  })

  test('writes the launcher and a versioned main manifest', () => {
    prepareNpmDist({ version: '0.7.1', rootDir: root, binariesDir: binaries, outDir: out })
    expect(existsSync(join(out, 'main', 'bin', 'asana.cjs'))).toBe(true)
    const mainPkg = JSON.parse(readFileSync(join(out, 'main', 'package.json'), 'utf8'))
    expect(mainPkg.version).toBe('0.7.1')
    expect(mainPkg.optionalDependencies['@pleaseai/asana-darwin-arm64']).toBe('0.7.1')
    expect(mainPkg.private).toBeUndefined()
  })

  test('copies README and LICENSE into the main and platform packages', () => {
    prepareNpmDist({ version: '0.7.1', rootDir: root, binariesDir: binaries, outDir: out })
    for (const dir of ['main', 'asana-darwin-arm64']) {
      expect(existsSync(join(out, dir, 'README.md'))).toBe(true)
      expect(existsSync(join(out, dir, 'LICENSE'))).toBe(true)
    }
  })
})
