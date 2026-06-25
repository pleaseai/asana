/**
 * CLI boundary for the npm distribution builder.
 *
 * Usage (run from the repo root):
 *   bun run scripts/prepare-npm.ts --version v0.7.1 --binaries artifacts --out dist-npm
 *
 * Generates the publishable package tree under `--out` and prints the package
 * names in publish order (platform packages first, main last).
 */
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prepareNpmDist } from './npm-dist'

interface Args {
  version: string
  binaries: string
  out: string
}

function parseArgs(argv: string[]): Args {
  const values: Partial<Args> = { binaries: 'artifacts', out: 'dist-npm' }
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]
    const value = argv[i + 1]
    switch (flag) {
      case '--version':
        values.version = value
        i += 1
        break
      case '--binaries':
        values.binaries = value
        i += 1
        break
      case '--out':
        values.out = value
        i += 1
        break
      default:
        throw new Error(`Unknown argument: ${flag}`)
    }
  }
  if (!values.version) {
    throw new Error('Missing required --version <tag|semver>')
  }
  return values as Args
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  const rootDir = dirname(dirname(fileURLToPath(import.meta.url)))
  const prepared = prepareNpmDist({
    version: args.version,
    rootDir,
    binariesDir: args.binaries,
    outDir: args.out,
  })
  for (const pkg of prepared) {
    console.log(`${args.out}/${pkg.dir}  ->  ${pkg.packageJson.name}@${pkg.packageJson.version}`)
  }
}

main()
