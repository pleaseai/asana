/**
 * Integration tests for `asana feedback` against a local GitHub emulator
 * (emulate.dev). Unlike the unit tests that stub `fetch`, these exercise the
 * real request/response protocol end to end: a real HTTP server creates and
 * persists issues, so we verify the command actually produces a retrievable
 * GitHub issue with the expected title, body footer, and labels.
 *
 * The emulator authenticates any `ghp_`-prefixed token as a default user, so we
 * create that user's repo and target it via `--repo`.
 */

import type { Emulator } from 'emulate'
import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test'
import { createEmulator } from 'emulate'
import { createFeedbackCommand } from '../../src/commands/feedback'
import { createGitHubIssue } from '../../src/lib/github'

const TOKEN = 'ghp_emulatetesttoken'
const ORIGINAL_API_URL = process.env.GITHUB_API_URL
const ORIGINAL_TOKEN = process.env.GITHUB_TOKEN
const ORIGINAL_GH_TOKEN = process.env.GH_TOKEN

// Other suites assign `global.fetch = mock(...)` without restoring it (Bun's
// `mock.restore()` does not revert a direct assignment), which would route these
// real HTTP calls into a leaked stub. Capture the native fetch at import (before
// any test body runs) and reinstate it for the duration of these tests.
const NATIVE_FETCH = globalThis.fetch
let leakedFetch: typeof globalThis.fetch

let github: Emulator

function authHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'asana-cli',
  }
}

async function createRepo(name: string): Promise<string> {
  const res = await fetch(`${github.url}/user/repos`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    throw new Error(`Failed to seed repo (${res.status})`)
  }
  return (await res.json() as { full_name: string }).full_name
}

async function listIssues(repo: string): Promise<Array<{ title: string, body: string, labels: Array<{ name: string }> }>> {
  const res = await fetch(`${github.url}/repos/${repo}/issues`, { headers: authHeaders() })
  return await res.json() as Array<{ title: string, body: string, labels: Array<{ name: string }> }>
}

describe('feedback command (emulate.dev GitHub integration)', () => {
  beforeAll(async () => {
    leakedFetch = globalThis.fetch
    globalThis.fetch = NATIVE_FETCH
    github = await createEmulator({ service: 'github' })
  })

  afterAll(async () => {
    restoreEnv('GITHUB_API_URL', ORIGINAL_API_URL)
    restoreEnv('GITHUB_TOKEN', ORIGINAL_TOKEN)
    restoreEnv('GH_TOKEN', ORIGINAL_GH_TOKEN)
    await github.close()
    globalThis.fetch = leakedFetch
  })

  test('createGitHubIssue persists an issue retrievable via the API', async () => {
    const repo = await createRepo('lib-level')

    const issue = await createGitHubIssue({
      repo,
      token: TOKEN,
      title: 'Lib bug report',
      body: 'Body from lib\n---\n- Type: bug',
      labels: ['feedback', 'bug'],
      baseUrl: github.url,
    })

    expect(issue.number).toBeGreaterThan(0)
    expect(issue.html_url).toContain(repo)

    const issues = await listIssues(repo)
    const created = issues.find(i => i.title === 'Lib bug report')
    expect(created).toBeDefined()
    expect(created!.labels.map(l => l.name).sort()).toEqual(['bug', 'feedback'])
  })

  test('feedback command creates a real issue end-to-end via env config', async () => {
    const repo = await createRepo('command-e2e')
    process.env.GITHUB_API_URL = github.url
    process.env.GITHUB_TOKEN = TOKEN
    delete process.env.GH_TOKEN

    const logSpy = spyOn(console, 'log').mockImplementation(() => {})
    try {
      const feedback = createFeedbackCommand()
      await feedback.parseAsync(
        ['--type', 'feature', '--title', 'Add CSV export', '--body', 'Please add export', '--repo', repo],
        { from: 'user' },
      )

      const output = logSpy.mock.calls.map(args => String(args[0])).join('\n')
      expect(output).toContain(`${github.url}/${repo}/issues/`)
    }
    finally {
      logSpy.mockRestore()
    }

    const issues = await listIssues(repo)
    const created = issues.find(i => i.title === 'Add CSV export')
    expect(created).toBeDefined()
    // The command appends an environment footer and a feature → enhancement label.
    expect(created!.body).toContain('Please add export')
    expect(created!.body).toContain('- Type: feature')
    expect(created!.labels.map(l => l.name).sort()).toEqual(['enhancement', 'feedback'])
  })
})

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key]
  }
  else {
    process.env[key] = value
  }
}
