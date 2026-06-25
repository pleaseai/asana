import type { OutputFormat } from '../utils/formatter'
import { Command } from 'commander'
import { ERROR_IDS } from '../constants/errorIds'
import { getAsanaClient } from '../lib/asana-client'
import { parseAsanaUrl } from '../lib/asana-url'
import { COMMENT_FIELDS, toCommentViews, toProjectView, toTaskView } from '../lib/asana-views'
import { emitError } from '../lib/axi-output'
import { handleAsanaError } from '../lib/error-handler'
import { formatOutput, getOutputFormat } from '../utils/formatter'

/**
 * What an Asana URL resolves to: the resource kind to fetch and the gid to
 * fetch it by. A comment URL resolves to its task's comment list because the
 * API/CLI has no single-comment fetch.
 */
export interface FetchTarget {
  kind: 'task' | 'project' | 'commentsForTask'
  gid: string
}

/**
 * Map an Asana URL to a concrete fetch, or null if it is not a recognizable
 * task/project/comment URL (or lacks the id needed to fetch it).
 */
export function resolveFetchTarget(url: string): FetchTarget | null {
  const match = parseAsanaUrl(url)
  if (!match) {
    return null
  }

  if (match.type === 'task' && match.taskId) {
    return { kind: 'task', gid: match.taskId }
  }
  if (match.type === 'project' && match.projectId) {
    return { kind: 'project', gid: match.projectId }
  }
  if (match.type === 'comment' && match.taskId) {
    return { kind: 'commentsForTask', gid: match.taskId }
  }

  return null
}

/**
 * `asana fetch <url>` — resolve an app.asana.com URL to the underlying resource
 * and fetch it through the API, so an agent can pass a pasted Asana link
 * directly instead of extracting the gid and picking the right subcommand.
 */
export function createFetchCommand(): Command {
  return new Command('fetch')
    .description('Fetch an Asana task, project, or comment thread by its app.asana.com URL')
    .argument('<url>', 'Asana URL (e.g. https://app.asana.com/1/<ws>/task/<gid>)')
    .action(async (url: string, _options: unknown, command: Command) => {
      const format = getOutputFormat(command)

      const target = resolveFetchTarget(url)
      if (!target) {
        emitError({
          code: ERROR_IDS.INVALID_ASANA_URL,
          message: `Not a recognizable Asana task, project, or comment URL: ${url}`,
          help: 'Pass a link like https://app.asana.com/1/<workspace>/task/<gid> or https://app.asana.com/0/<project>/<task>',
          context: { url },
        }, format)
        process.exit(1)
      }

      try {
        const data = await fetchResource(target)
        const output = formatOutput(data, { format: format as OutputFormat, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        handleAsanaError(error, 'Asana fetch', { URL: url }, format)
      }
    })
}

/**
 * Fetch the resolved resource and shape it with the shared presenters, matching
 * the output of the equivalent `task get` / `project get` / `comment list`.
 */
async function fetchResource(target: FetchTarget): Promise<Record<string, unknown>> {
  const client = getAsanaClient()

  switch (target.kind) {
    case 'task': {
      const task = await client.tasks.findById(target.gid)
      return { task: toTaskView(task) }
    }
    case 'project': {
      const project = await client.projects.findById(target.gid)
      return { project: toProjectView(project) }
    }
    case 'commentsForTask': {
      const response = await client.stories.findByTask(target.gid, COMMENT_FIELDS)
      return { comments: toCommentViews(response.data) }
    }
    default: {
      // Exhaustiveness: a new FetchTarget kind must add a case above.
      const exhaustiveCheck: never = target.kind
      throw new Error(`Unsupported fetch target kind: ${String(exhaustiveCheck)}`)
    }
  }
}
