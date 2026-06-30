import type { FeedbackType } from '../lib/github'
import { Command } from 'commander'
import { ERROR_IDS } from '../constants/errorIds'
import { emitError, emitResult } from '../lib/axi-output'
import {
  buildIssueBody,
  buildNewIssueUrl,
  createGitHubIssue,
  DEFAULT_REPO,
  getGitHubToken,
  GitHubApiError,
  mapTypeToLabels,
  openIssueUrl,
} from '../lib/github'
import { validateFeedbackType, ValidationError } from '../lib/validators'
import { getOutputFormat } from '../utils/formatter'

interface FeedbackOptions {
  title: string
  type: string
  body?: string
  repo: string
  /** Commander sets this to `false` when `--no-browser` is passed. */
  browser: boolean
}

/**
 * `asana feedback` — submit a bug, feature request, or suggestion as a GitHub
 * issue on the project repository.
 *
 * Hybrid submission (agent-first):
 * - With `GITHUB_TOKEN` / `GH_TOKEN`: create the issue via the GitHub API.
 * - Without a token: open a prefilled "new issue" page in the browser.
 *   `--no-browser` turns that fallback into a structured error instead.
 */
export function createFeedbackCommand(): Command {
  return new Command('feedback')
    .description('Submit a bug, feature request, or suggestion as a GitHub issue')
    .requiredOption('-t, --title <title>', 'Issue title')
    .option('--type <type>', 'Feedback type: bug | feature | suggestion', 'bug')
    .option('-b, --body <body>', 'Issue body / details')
    .option('--repo <owner/repo>', 'Target repository', DEFAULT_REPO)
    .option('--no-browser', 'Fail instead of opening the browser when no token is set')
    .action(async (options: FeedbackOptions, command: Command) => {
      const format = getOutputFormat(command)

      try {
        validateFeedbackType(options.type)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          if (format !== 'plain') {
            emitError({ code: error.errorId, message: error.message, context: error.context }, format)
          }
          process.exit(1)
        }
        throw error
      }

      const type = options.type as FeedbackType
      const labels = mapTypeToLabels(type)
      const body = buildIssueBody({ type, body: options.body })
      const token = getGitHubToken()

      if (token) {
        await submitViaApi({ repo: options.repo, token, title: options.title, body, labels, type }, format)
        return
      }

      await submitViaBrowser({ repo: options.repo, title: options.title, body, labels, type, allowBrowser: options.browser }, format)
    })
}

/**
 * Create the issue through the GitHub API and report the result. Exits 1 on a
 * GitHub failure with a structured AXI error.
 */
async function submitViaApi(
  params: { repo: string, token: string, title: string, body: string, labels: string[], type: FeedbackType },
  format: ReturnType<typeof getOutputFormat>,
): Promise<void> {
  try {
    const issue = await createGitHubIssue(params)
    emitResult(
      { issue: issue.number, url: issue.html_url, type: params.type, repo: params.repo },
      `✓ Feedback submitted: ${issue.html_url}`,
      format,
    )
  }
  catch (error) {
    const detail = error instanceof GitHubApiError ? error.detail : error instanceof Error ? error.message : 'Unknown error'
    const code = error instanceof GitHubApiError ? ERROR_IDS.GITHUB_API_ERROR : ERROR_IDS.FEEDBACK_SUBMISSION_FAILED
    emitError(
      {
        code,
        message: `Failed to submit feedback: ${detail}`,
        help: 'Check that GITHUB_TOKEN has "repo" (or "public_repo") scope, then retry.',
        context: { repo: params.repo },
      },
      format,
    )
    process.exit(1)
  }
}

/**
 * Open a prefilled "new issue" page in the browser. When `--no-browser` is set
 * (no token, no browser), emit a structured error explaining how to proceed.
 */
async function submitViaBrowser(
  params: { repo: string, title: string, body: string, labels: string[], type: FeedbackType, allowBrowser: boolean },
  format: ReturnType<typeof getOutputFormat>,
): Promise<void> {
  const url = buildNewIssueUrl({ repo: params.repo, title: params.title, body: params.body, labels: params.labels })

  if (!params.allowBrowser) {
    emitError(
      {
        code: ERROR_IDS.FEEDBACK_SUBMISSION_FAILED,
        message: 'No GitHub token found and --no-browser was set',
        help: 'Set GITHUB_TOKEN to submit via the API, or drop --no-browser to open the prefilled issue in a browser.',
        context: { url },
      },
      format,
    )
    process.exit(1)
  }

  await openIssueUrl(url)
  emitResult(
    { url, opened: true, type: params.type, repo: params.repo },
    `Opened browser to file feedback: ${url}`,
    format,
  )
}
