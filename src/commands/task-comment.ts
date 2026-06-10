import type { CommentAddOptions } from '../types'
import chalk from 'chalk'
import { Command } from 'commander'
import { getAsanaClient } from '../lib/asana-client'
import { handleAsanaError } from '../lib/error-handler'
import { validateGid, ValidationError } from '../lib/validators'
import { formatOutput, getOutputFormat } from '../utils/formatter'

// Stories include system events (assignments, status changes); request the
// subtype so we can keep only user comments in `comment list`.
const COMMENT_FIELDS = {
  opt_fields: 'text,html_text,created_at,created_by.name,resource_subtype',
}

const COMMENT_SUBTYPE = 'comment_added'

/**
 * Asana requires `html_text` to be wrapped in a <body> element. Wrap plain
 * snippets automatically so callers can pass just the inline markup.
 */
function ensureHtmlBody(html: string): string {
  const trimmed = html.trim()
  if (trimmed.startsWith('<body')) {
    return trimmed
  }
  return `<body>${trimmed}</body>`
}

export function createCommentCommand(): Command {
  const comment = new Command('comment')
    .description('Manage task comments')

  comment
    .command('add')
    .description('Add a comment to a task')
    .argument('<task-gid>', 'Task GID')
    .argument('<text>', 'Comment text')
    .option('--html', 'Treat text as rich text (Asana HTML, wrapped in <body> automatically)')
    .action(async (taskGid: string, text: string, options: CommentAddOptions, command: Command) => {
      try {
        validateGid(taskGid, 'Task GID')

        const client = getAsanaClient()
        const storyData = options.html
          ? { html_text: ensureHtmlBody(text) }
          : { text }
        const result = await client.stories.createForTask(taskGid, storyData)

        const format = getOutputFormat(command)
        const resultData = {
          status: 'success',
          gid: result.gid,
          task: taskGid,
          text: result.text,
          created_at: result.created_at,
        }
        const output = formatOutput({ comment: resultData }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Comment addition', { 'Task GID': taskGid })
      }
    })

  comment
    .command('list')
    .description('List comments on a task')
    .argument('<task-gid>', 'Task GID')
    .action(async (taskGid: string, options: any, command: Command) => {
      try {
        validateGid(taskGid, 'Task GID')

        const client = getAsanaClient()
        const response = await client.stories.findByTask(taskGid, COMMENT_FIELDS)
        const comments = (response.data || [])
          .filter((story: any) => story.resource_subtype === COMMENT_SUBTYPE)
          .map((story: any) => ({
            gid: story.gid,
            created_at: story.created_at,
            created_by: story.created_by?.name,
            text: story.text,
          }))

        if (comments.length === 0) {
          console.log(chalk.yellow('No comments found'))
          return
        }

        const format = getOutputFormat(command)
        const output = formatOutput({ comments }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Comment listing', { 'Task GID': taskGid })
      }
    })

  return comment
}
