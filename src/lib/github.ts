/**
 * GitHub integration boundary for the `feedback` command.
 *
 * Side effects (network, env, process info) are isolated here so the command
 * layer stays thin and the pure helpers below remain unit-testable.
 */

import packageJson from '../../package.json'

/** Repository that receives feedback issues by default. */
export const DEFAULT_REPO = 'pleaseai/asana'

/** Public GitHub REST API base, used when no override is configured. */
export const DEFAULT_GITHUB_API_BASE_URL = 'https://api.github.com'

/** Public GitHub web base, used when no override is configured. */
export const DEFAULT_GITHUB_WEB_BASE_URL = 'https://github.com'

/** Abort the GitHub API request after this many ms so the command never hangs. */
export const GITHUB_REQUEST_TIMEOUT_MS = 30_000

/**
 * Resolve the GitHub REST API base URL.
 *
 * Defaults to the public API but honors `GITHUB_API_URL` so the same code can
 * target GitHub Enterprise or a local emulator (e.g. emulate.dev) in tests.
 */
export function getGitHubApiBaseUrl(): string {
  return process.env.GITHUB_API_URL || DEFAULT_GITHUB_API_BASE_URL
}

/**
 * Resolve the GitHub web base URL used by the browser fallback.
 *
 * Mirrors `getGitHubApiBaseUrl` via `GITHUB_WEB_URL` so GitHub Enterprise or
 * emulator setups open the correct host instead of the public site.
 */
export function getGitHubWebBaseUrl(): string {
  return process.env.GITHUB_WEB_URL || DEFAULT_GITHUB_WEB_BASE_URL
}

/** Feedback categories accepted by the command. */
export const FEEDBACK_TYPES = ['bug', 'feature', 'suggestion'] as const

export type FeedbackType = typeof FEEDBACK_TYPES[number]

export interface IssueInput {
  type: FeedbackType
  body?: string
}

export interface CreatedIssue {
  /** GitHub issue number. */
  number: number

  /** Browser URL of the created issue. */
  html_url: string
}

/**
 * Resolve a GitHub token from the environment.
 *
 * Mirrors the layered lookup of `getAccessToken` (config.ts) but reads only the
 * environment — feedback is deliberately not stored in the Asana config so the
 * two credential concerns stay separate.
 */
export function getGitHubToken(): string | null {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null
}

/**
 * Map a feedback type to GitHub labels.
 *
 * Every issue gets a common `feedback` label plus a type label so submissions
 * are easy to triage. GitHub applies only labels that already exist in the
 * target repo and silently drops unknown ones (it never auto-creates them), so
 * these are best-effort and never block submission.
 */
export function mapTypeToLabels(type: FeedbackType): string[] {
  const typeLabel = type === 'bug' ? 'bug' : 'enhancement'
  return ['feedback', typeLabel]
}

/**
 * Build the issue body, appending an environment footer that helps triage
 * (especially for bug reports).
 */
export function buildIssueBody(input: IssueInput): string {
  const footer = [
    '---',
    `- Type: ${input.type}`,
    `- CLI version: ${packageJson.version}`,
    `- Platform: ${process.platform} ${process.arch}`,
  ].join('\n')

  const trimmed = input.body?.trim()

  // Separate the body from the footer with a blank line. Without it, the `---`
  // sits directly under the body's last line and CommonMark/GFM renders that
  // line as a Setext <h2> heading instead of a horizontal rule.
  return trimmed ? `${trimmed}\n\n${footer}` : footer
}

/**
 * Open a URL in the user's default browser.
 *
 * Thin wrapper around the `open` package so the side effect lives at this
 * boundary and the command layer stays testable (spy this in tests). `open` is
 * imported dynamically because it ships as ESM resolved from Bun's store.
 */
export async function openIssueUrl(url: string): Promise<void> {
  const open = (await import('open')).default
  await open(url)
}

/**
 * Build a prefilled "new issue" URL for the browser fallback (no token needed).
 */
export function buildNewIssueUrl(params: {
  repo: string
  title: string
  body: string
  labels: string[]
  /** Override the web base URL (GitHub Enterprise / emulator). */
  webBaseUrl?: string
}): string {
  const baseUrl = params.webBaseUrl ?? getGitHubWebBaseUrl()
  const query = new URLSearchParams({
    title: params.title,
    body: params.body,
    labels: params.labels.join(','),
  })
  return `${baseUrl}/${params.repo}/issues/new?${query.toString()}`
}

/**
 * Create a GitHub issue via the REST API.
 *
 * Throws on a non-2xx response (caller maps it to a structured AXI error). Uses
 * native `fetch` (Bun built-in), matching the pattern in `self-update.ts`.
 */
export async function createGitHubIssue(params: {
  repo: string
  token: string
  title: string
  body: string
  labels: string[]
  /** Override the API base URL (GitHub Enterprise / emulator). */
  baseUrl?: string
}): Promise<CreatedIssue> {
  const baseUrl = params.baseUrl ?? getGitHubApiBaseUrl()

  let response: Response
  try {
    response = await fetch(`${baseUrl}/repos/${params.repo}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${params.token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'asana-cli',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        title: params.title,
        body: params.body,
        labels: params.labels,
      }),
      // Abort a stalled connection so `asana feedback` never hangs.
      signal: AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT_MS),
    })
  }
  catch (error) {
    // Timeout (TimeoutError) or a network failure — surface both through the
    // same structured error path the caller already handles (status 0).
    const detail = error instanceof Error && error.name === 'TimeoutError'
      ? `request timed out after ${GITHUB_REQUEST_TIMEOUT_MS}ms`
      : error instanceof Error ? error.message : 'network error'
    throw new GitHubApiError(0, detail)
  }

  if (!response.ok) {
    const detail = await readErrorDetail(response)
    throw new GitHubApiError(response.status, detail)
  }

  const data = await response.json() as { number: number, html_url: string }
  return { number: data.number, html_url: data.html_url }
}

/** Raised when the GitHub API returns a non-2xx response. */
export class GitHubApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(`GitHub API request failed (${status}): ${detail}`)
    this.name = 'GitHubApiError'
  }
}

/**
 * Extract a human-readable message from a failed GitHub response, falling back
 * to the status text when the body is not the expected JSON shape.
 */
async function readErrorDetail(response: Response): Promise<string> {
  try {
    const data = await response.json() as { message?: string }
    return data.message || response.statusText
  }
  catch {
    return response.statusText
  }
}
