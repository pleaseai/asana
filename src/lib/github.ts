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

/**
 * Resolve the GitHub REST API base URL.
 *
 * Defaults to the public API but honors `GITHUB_API_URL` so the same code can
 * target GitHub Enterprise or a local emulator (e.g. emulate.dev) in tests.
 */
export function getGitHubApiBaseUrl(): string {
  return process.env.GITHUB_API_URL || DEFAULT_GITHUB_API_BASE_URL
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
 * The GitHub Issues API auto-creates a label that does not yet exist, so these
 * stay safe to send without pre-provisioning. Every issue also gets a common
 * `feedback` label so submissions are easy to triage.
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
  const parts: string[] = []

  if (input.body && input.body.trim().length > 0) {
    parts.push(input.body.trim())
  }

  parts.push(
    '---',
    `- Type: ${input.type}`,
    `- CLI version: ${packageJson.version}`,
    `- Platform: ${process.platform} ${process.arch}`,
  )

  return parts.join('\n')
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
}): string {
  const query = new URLSearchParams({
    title: params.title,
    body: params.body,
    labels: params.labels.join(','),
  })
  return `https://github.com/${params.repo}/issues/new?${query.toString()}`
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
  const response = await fetch(`${baseUrl}/repos/${params.repo}/issues`, {
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
  })

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
