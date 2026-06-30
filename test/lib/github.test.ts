import { afterEach, describe, expect, mock, test } from 'bun:test'
import packageJson from '../../package.json'
import {
  buildIssueBody,
  buildNewIssueUrl,
  createGitHubIssue,
  DEFAULT_REPO,
  getGitHubToken,
  GitHubApiError,
  mapTypeToLabels,
} from '../../src/lib/github'

describe('getGitHubToken', () => {
  const originalGitHubToken = process.env.GITHUB_TOKEN
  const originalGhToken = process.env.GH_TOKEN

  afterEach(() => {
    restoreEnv('GITHUB_TOKEN', originalGitHubToken)
    restoreEnv('GH_TOKEN', originalGhToken)
  })

  test('prefers GITHUB_TOKEN over GH_TOKEN', () => {
    process.env.GITHUB_TOKEN = 'primary'
    process.env.GH_TOKEN = 'secondary'
    expect(getGitHubToken()).toBe('primary')
  })

  test('falls back to GH_TOKEN when GITHUB_TOKEN is absent', () => {
    delete process.env.GITHUB_TOKEN
    process.env.GH_TOKEN = 'secondary'
    expect(getGitHubToken()).toBe('secondary')
  })

  test('returns null when neither is set', () => {
    delete process.env.GITHUB_TOKEN
    delete process.env.GH_TOKEN
    expect(getGitHubToken()).toBeNull()
  })
})

describe('mapTypeToLabels', () => {
  test('maps bug to the bug label', () => {
    expect(mapTypeToLabels('bug')).toEqual(['feedback', 'bug'])
  })

  test('maps feature and suggestion to enhancement', () => {
    expect(mapTypeToLabels('feature')).toEqual(['feedback', 'enhancement'])
    expect(mapTypeToLabels('suggestion')).toEqual(['feedback', 'enhancement'])
  })
})

describe('buildIssueBody', () => {
  test('includes the provided body and an environment footer', () => {
    const result = buildIssueBody({ type: 'bug', body: 'It crashes' })
    expect(result).toContain('It crashes')
    expect(result).toContain('- Type: bug')
    expect(result).toContain(`- CLI version: ${packageJson.version}`)
    expect(result).toContain(`- Platform: ${process.platform} ${process.arch}`)
  })

  test('omits an empty body but still includes the footer', () => {
    const result = buildIssueBody({ type: 'feature', body: '   ' })
    expect(result.startsWith('---')).toBe(true)
    expect(result).toContain('- Type: feature')
  })

  test('separates the body from the footer with a blank line (no Setext heading)', () => {
    const result = buildIssueBody({ type: 'bug', body: 'last line of body' })
    // A blank line before `---` keeps it a horizontal rule, not an <h2> underline.
    expect(result).toContain('last line of body\n\n---')
    expect(result).not.toContain('last line of body\n---')
  })
})

describe('buildNewIssueUrl', () => {
  test('encodes title, body, and labels into query params', () => {
    const url = buildNewIssueUrl({
      repo: DEFAULT_REPO,
      title: 'Bug: a & b',
      body: 'line1\nline2',
      labels: ['feedback', 'bug'],
    })

    expect(url.startsWith(`https://github.com/${DEFAULT_REPO}/issues/new?`)).toBe(true)
    const params = new URL(url).searchParams
    expect(params.get('title')).toBe('Bug: a & b')
    expect(params.get('body')).toBe('line1\nline2')
    expect(params.get('labels')).toBe('feedback,bug')
  })

  test('honors an explicit web base URL (GitHub Enterprise / emulator)', () => {
    const url = buildNewIssueUrl({
      repo: DEFAULT_REPO,
      title: 'T',
      body: 'B',
      labels: ['feedback'],
      webBaseUrl: 'https://github.example.com',
    })
    expect(url.startsWith(`https://github.example.com/${DEFAULT_REPO}/issues/new?`)).toBe(true)
  })
})

describe('createGitHubIssue', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  test('POSTs to the issues endpoint with auth header and returns the issue', async () => {
    const calls: Array<{ url: string, init: RequestInit }> = []
    global.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: url.toString(), init: init ?? {} })
      return new Response(JSON.stringify({ number: 42, html_url: 'https://github.com/pleaseai/asana/issues/42' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch

    const issue = await createGitHubIssue({
      repo: DEFAULT_REPO,
      token: 'secret-token',
      title: 'Title',
      body: 'Body',
      labels: ['feedback', 'bug'],
    })

    expect(issue).toEqual({ number: 42, html_url: 'https://github.com/pleaseai/asana/issues/42' })
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe(`https://api.github.com/repos/${DEFAULT_REPO}/issues`)
    expect(calls[0]!.init.method).toBe('POST')
    const headers = calls[0]!.init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer secret-token')
    const sentBody = JSON.parse(calls[0]!.init.body as string)
    expect(sentBody).toEqual({ title: 'Title', body: 'Body', labels: ['feedback', 'bug'] })
  })

  test('throws GitHubApiError with the API message on a non-2xx response', async () => {
    global.fetch = mock(async () => {
      return new Response(JSON.stringify({ message: 'Bad credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch

    const promise = createGitHubIssue({
      repo: DEFAULT_REPO,
      token: 'bad',
      title: 'Title',
      body: 'Body',
      labels: [],
    })

    await expect(promise).rejects.toBeInstanceOf(GitHubApiError)
    await expect(promise).rejects.toThrow('Bad credentials')
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
