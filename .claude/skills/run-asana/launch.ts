#!/usr/bin/env bun
/**
 * CLI launcher that can redirect the Asana SDK at a mock server.
 *
 * The `api` and `fetch` commands read the base URL from ASANA_API_BASE_URL, but
 * the SDK-backed commands (task/workspace/project/…) talk to the singleton
 * `Asana.ApiClient.instance`, whose basePath is hardcoded to app.asana.com and
 * has no env hook. This shim overrides that singleton *before* loading the CLI,
 * so every command — SDK-backed or raw-fetch — targets ASANA_API_BASE_URL.
 *
 * Must live INSIDE the project tree: `import 'asana'` has to resolve to the same
 * node_modules copy the CLI loads, or Bun gives us a second module instance and
 * the override is lost (the two imports must share one singleton).
 *
 * With ASANA_API_BASE_URL unset this is a transparent pass-through equivalent to
 * `bun src/index.ts …`, so it is safe to use as a general CLI entry too.
 *
 * Usage (args after the script are the normal CLI args):
 *   ASANA_API_BASE_URL=http://localhost:PORT/api/1.0 ASANA_ACCESS_TOKEN=fake \
 *     bun .claude/skills/run-asana/launch.ts -f json task list -w 111 -a me
 */
import Asana from 'asana'

const base = process.env.ASANA_API_BASE_URL
if (base) {
  Asana.ApiClient.instance.basePath = base.replace(/\/+$/, '')
}

// Load the real CLI entry; it parses process.argv on import. argv[1] is this
// script, so commander sees the same arg vector as `bun src/index.ts <args>`.
await import('../../../src/index.ts')
