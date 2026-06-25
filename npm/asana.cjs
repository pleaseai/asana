#!/usr/bin/env node
'use strict'

/**
 * Node launcher for the `asana` CLI.
 *
 * The real CLI is a self-contained binary compiled with `bun build --compile`.
 * It is shipped per-platform as an `optionalDependency` (e.g.
 * `@pleaseai/asana-darwin-arm64`); npm installs only the one matching the host.
 * This launcher resolves that binary and execs it, forwarding all arguments,
 * stdio, and the exit code.
 */

const { spawnSync } = require('node:child_process')

/** npm package name holding the binary for the given platform/arch. */
function platformPackageName(platform, arch) {
  return `@pleaseai/asana-${platform}-${arch}`
}

/**
 * Resolve the absolute path to the platform binary, or throw if the matching
 * platform package is not installed (unsupported platform).
 */
function resolveBinaryPath(platform, arch) {
  const pkg = platformPackageName(platform, arch)
  return require.resolve(`${pkg}/bin/asana`)
}

function run(argv, platform, arch) {
  let binary
  try {
    binary = resolveBinaryPath(platform, arch)
  }
  catch {
    process.stderr.write(
      `asana: no prebuilt binary for ${platform}-${arch}.\n`
      + 'Your platform may be unsupported, or installation skipped optional dependencies.\n'
      + 'Download a binary from https://github.com/pleaseai/asana/releases\n',
    )
    return 1
  }

  const result = spawnSync(binary, argv, { stdio: 'inherit' })
  if (result.error) {
    process.stderr.write(`asana: failed to launch binary: ${result.error.message}\n`)
    return 1
  }
  // Mirror a signal-terminated child: re-raise the signal on ourselves so the
  // parent shell records the conventional 128+signal exit (e.g. 130 for SIGINT)
  // instead of a plain failure. The return is a fallback if we survive it.
  if (result.signal) {
    process.kill(process.pid, result.signal)
    return 1
  }
  return result.status ?? 1
}

module.exports = { platformPackageName, resolveBinaryPath, run }

if (require.main === module) {
  process.exit(run(process.argv.slice(2), process.platform, process.arch))
}
