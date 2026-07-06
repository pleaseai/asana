#!/usr/bin/env bun
/**
 * End-to-end smoke driver for the asana CLI.
 *
 * Starts an in-process mock Asana API (mock-asana.mjs), then runs a battery of
 * real CLI invocations against it through launch.ts — exercising command
 * parsing, token resolution, SDK/raw-fetch request building, and TOON/JSON
 * output formatting — with no real Asana credentials. Drives the core task
 * lifecycle (create → list → get → complete → delete) plus workspace/user reads.
 *
 * Run:  bun .claude/skills/run-asana/smoke.mjs
 * Exit: 0 if every check passes, 1 otherwise (prints a PASS/FAIL summary).
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startMock } from './mock-asana.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const launcher = resolve(here, 'launch.ts')

const mock = startMock()
const env = { ...process.env, ASANA_API_BASE_URL: mock.url, ASANA_ACCESS_TOKEN: 'fake-token-for-mock' }

let passed = 0
let failed = 0

async function cli(args) {
  const proc = Bun.spawn(['bun', launcher, ...args], { env, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  const code = await proc.exited
  return { code, stdout, stderr, out: stdout + stderr }
}

function check(name, ok, detail = '') {
  if (ok) {
    passed++
    console.log(`  ✓ ${name}`)
  }
  else {
    failed++
    console.log(`  ✗ ${name}${detail ? `\n      ${detail.replace(/\n/g, '\n      ')}` : ''}`)
  }
}

try {
  console.log(`\nmock Asana API → ${mock.url}\n`)

  // 1. Version — no network, proves the binary parses and runs.
  {
    const r = await cli(['--version'])
    check('asana --version exits 0 and prints a version', r.code === 0 && /\d+\.\d+\.\d+/.test(r.out), r.out.trim())
  }

  // 2. Workspace list (SDK-backed, redirected via launch.ts).
  {
    const r = await cli(['-f', 'json', 'workspace', 'list'])
    check('workspace list returns the mocked workspace', r.code === 0 && r.out.includes('My Workspace'), r.out.trim())
  }

  // 3. Create a task (SDK POST /tasks) and capture its gid.
  let gid = null
  {
    const r = await cli(['-f', 'json', 'task', 'create', '-n', 'Buy milk', '-w', '111'])
    try { gid = JSON.parse(r.stdout).task?.gid } catch { /* leave null */ }
    check('task create succeeds and returns a gid', r.code === 0 && Boolean(gid), r.out.trim())
  }

  // 4. List tasks — the created task is now in the mock's store.
  {
    const r = await cli(['-f', 'json', 'task', 'list', '-w', '111', '-a', 'me'])
    check('task list includes the created task', r.code === 0 && r.out.includes('Buy milk'), r.out.trim())
  }

  // 5. Get the task by gid.
  if (gid) {
    const r = await cli(['-f', 'json', 'task', 'get', gid])
    check('task get returns the task by gid', r.code === 0 && r.out.includes(gid), r.out.trim())
  }

  // 6. api command (raw-fetch path, honors ASANA_API_BASE_URL directly).
  {
    const r = await cli(['-f', 'json', 'api', '/users/me'])
    check('api /users/me returns the mocked user', r.code === 0 && r.out.includes('Mock User'), r.out.trim())
  }

  // 7. Complete then delete the task (SDK PUT + DELETE).
  if (gid) {
    const c = await cli(['task', 'complete', gid])
    check('task complete exits 0', c.code === 0, c.out.trim())
    const d = await cli(['task', 'delete', gid])
    check('task delete exits 0', d.code === 0, d.out.trim())
  }

  // 8. Default TOON output format (no -f flag) still renders.
  {
    const r = await cli(['workspace', 'list'])
    check('default (TOON) workspace list renders the workspace', r.code === 0 && r.out.includes('My Workspace'), r.out.trim())
  }
}
finally {
  mock.stop()
}

console.log(`\n${failed === 0 ? '✓ PASS' : '✗ FAIL'} — ${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
