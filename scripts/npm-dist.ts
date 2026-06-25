/**
 * npm distribution builder.
 *
 * The CLI ships as a self-contained binary compiled with `bun build --compile`.
 * To make it installable via `npm i -g @pleaseai/asana` / `npx`, we publish:
 *
 *   - one platform package per target (os/cpu constrained, binary only), and
 *   - a thin main package whose `bin` is a Node launcher that execs the
 *     platform binary pulled in through `optionalDependencies`.
 *
 * npm installs only the platform package matching the host (via the `os`/`cpu`
 * fields), so a user downloads the launcher plus a single ~25 MB binary.
 *
 * This module holds the pure manifest-building logic (no I/O) plus a thin
 * filesystem wrapper, so the package shapes can be unit-tested deterministically.
 */
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const SCOPE = '@pleaseai'
export const BASE_NAME = 'asana'
export const BINARY_FILENAME = 'asana'
export const LAUNCHER_FILENAME = 'asana.cjs'

/** A publishable platform, keyed by Node's `process.platform`/`process.arch`. */
export interface PlatformTarget {
  /** Node `process.platform` value. */
  os: string
  /** Node `process.arch` value. */
  cpu: string
  /** Name of the compiled binary artifact (as produced by the release CI). */
  artifact: string
}

/** Targets built by the release workflow's `build-binaries` matrix. */
export const PLATFORM_TARGETS: PlatformTarget[] = [
  { os: 'darwin', cpu: 'arm64', artifact: 'asana-darwin-arm64' },
  { os: 'darwin', cpu: 'x64', artifact: 'asana-darwin-x64' },
  { os: 'linux', cpu: 'x64', artifact: 'asana-linux-x64' },
  { os: 'linux', cpu: 'arm64', artifact: 'asana-linux-arm64' },
]

/** Fields copied verbatim from the dev manifest onto every published package. */
interface BaseManifest {
  author?: unknown
  license?: string
  homepage?: string
  repository?: unknown
  bugs?: unknown
  keywords?: string[]
}

/** Strip a leading `v` so a git tag like `v0.7.1` becomes a semver string. */
export function normalizeVersion(versionOrTag: string): string {
  return versionOrTag.replace(/^v/, '')
}

/** npm package name for a platform, e.g. `@pleaseai/asana-darwin-arm64`. */
export function platformPackageName(target: Pick<PlatformTarget, 'os' | 'cpu'>): string {
  return `${SCOPE}/${BASE_NAME}-${target.os}-${target.cpu}`
}

/** Build the package.json for a single platform (binary-only) package. */
export function buildPlatformPackageJson(
  target: PlatformTarget,
  version: string,
  base: BaseManifest,
): Record<string, unknown> {
  return {
    name: platformPackageName(target),
    version,
    description: `Prebuilt ${BASE_NAME} CLI binary for ${target.os}-${target.cpu}`,
    license: base.license,
    homepage: base.homepage,
    repository: base.repository,
    bugs: base.bugs,
    os: [target.os],
    cpu: [target.cpu],
    // The compiled binary is self-contained; only the executable is shipped.
    files: ['bin'],
  }
}

/**
 * Build the main package.json: a launcher that resolves the matching platform
 * binary through `optionalDependencies`. Self-contained binaries embed every
 * runtime dependency, so the main package declares no `dependencies`.
 */
export function buildMainPackageJson(
  version: string,
  base: BaseManifest & { name: string, description?: string },
  targets: PlatformTarget[],
): Record<string, unknown> {
  const optionalDependencies: Record<string, string> = {}
  for (const target of targets) {
    optionalDependencies[platformPackageName(target)] = version
  }

  return {
    name: base.name,
    version,
    description: base.description,
    author: base.author,
    license: base.license,
    homepage: base.homepage,
    repository: base.repository,
    bugs: base.bugs,
    keywords: base.keywords,
    bin: { [BASE_NAME]: `./bin/${LAUNCHER_FILENAME}` },
    files: ['bin'],
    engines: { node: '>=18' },
    optionalDependencies,
    publishConfig: { access: 'public' },
  }
}

export interface PreparedPackage {
  /** Output directory name under the dist root. */
  dir: string
  packageJson: Record<string, unknown>
}

export interface PrepareNpmDistOptions {
  /** Git tag or semver (a leading `v` is stripped). */
  version: string
  /** Repo root holding the dev package.json and launcher template. */
  rootDir: string
  /** Directory holding downloaded binary artifacts (CI `download-artifact` output). */
  binariesDir: string
  /** Destination directory for the generated packages. */
  outDir: string
  targets?: PlatformTarget[]
}

/** Locate a downloaded binary artifact, tolerating the artifact-subdir layout. */
export function resolveArtifactPath(binariesDir: string, target: PlatformTarget): string {
  // actions/download-artifact (no name) nests each artifact in its own folder:
  //   <binariesDir>/<artifact>/<artifact>
  // A flat layout (<binariesDir>/<artifact>) is also supported for local runs.
  const nested = join(binariesDir, target.artifact, target.artifact)
  const flat = join(binariesDir, target.artifact)
  return existsFile(nested) ? nested : flat
}

function existsFile(path: string): boolean {
  // Zero-copy existence probe — never read the (up to ~25 MB) binary into memory.
  return existsSync(path)
}

/**
 * Generate the publishable package tree under `outDir`. Returns the planned
 * packages (platform packages first, main last) so the caller can publish in
 * dependency order.
 */
export function prepareNpmDist(options: PrepareNpmDistOptions): PreparedPackage[] {
  const targets = options.targets ?? PLATFORM_TARGETS
  const version = normalizeVersion(options.version)
  const dev = JSON.parse(readFileSync(join(options.rootDir, 'package.json'), 'utf8')) as BaseManifest & {
    name: string
    description?: string
  }

  const prepared: PreparedPackage[] = []

  for (const target of targets) {
    const pkgJson = buildPlatformPackageJson(target, version, dev)
    const dir = `${BASE_NAME}-${target.os}-${target.cpu}`
    const pkgDir = join(options.outDir, dir)
    const binDir = join(pkgDir, 'bin')
    mkdirSync(binDir, { recursive: true })

    const source = resolveArtifactPath(options.binariesDir, target)
    const dest = join(binDir, BINARY_FILENAME)
    copyFileSync(source, dest)
    // upload/download-artifact drops the executable bit; restore it.
    chmodSync(dest, 0o755)

    copyDocs(options.rootDir, pkgDir)
    writePackageJson(pkgDir, pkgJson)
    prepared.push({ dir, packageJson: pkgJson })
  }

  // Main launcher package.
  const mainJson = buildMainPackageJson(version, dev, targets)
  const mainDir = join(options.outDir, 'main')
  const mainBin = join(mainDir, 'bin')
  mkdirSync(mainBin, { recursive: true })
  copyFileSync(join(options.rootDir, 'npm', LAUNCHER_FILENAME), join(mainBin, LAUNCHER_FILENAME))
  copyDocs(options.rootDir, mainDir)
  writePackageJson(mainDir, mainJson)
  prepared.push({ dir: 'main', packageJson: mainJson })

  return prepared
}

function writePackageJson(dir: string, json: Record<string, unknown>): void {
  writeFileSync(join(dir, 'package.json'), `${JSON.stringify(json, null, 2)}\n`)
}

/** Files npm always includes in a tarball; copied into every package for clarity. */
const DOC_FILES = ['README.md', 'LICENSE']

function copyDocs(rootDir: string, destDir: string): void {
  for (const file of DOC_FILES) {
    const source = join(rootDir, file)
    if (existsFile(source)) {
      copyFileSync(source, join(destDir, file))
    }
  }
}
