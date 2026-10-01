import type { CommentAddOptions } from '../types'
import chalk from 'chalk'
import { Command } from 'commander'
import { ERROR_IDS } from '../constants/errorIds'
import { getAsanaClient } from '../lib/asana-client'
import { COMMENT_FIELDS, toCommentView, toCommentViews } from '../lib/asana-views'
import { emitResult } from '../lib/axi-output'
import { handleAsanaError } from '../lib/error-handler'
import { failValidation } from '../lib/fail-validation'
import { UsageError, validateGid, ValidationError } from '../lib/validators'
import { formatOutput, getOutputFormat } from '../utils/formatter'

/**
 * Asana requires `html_text` to be wrapped in a <body> element. Wrap plain
 * snippets automatically so callers can pass just the inline markup.
 */
function ensureHtmlBody(html: string): string {
  const trimmed = html.trim()
  if (/^<body\b/i.test(trimmed)) {
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
        const comments = toCommentViews(response.data)

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

  comment.addCommand(createCommentGetCommand())
  comment.addCommand(createCommentUpdateCommand())

  return comment
}

/**
 * Require a non-blank `--text` value. Runs before any API call.
 * @throws UsageError(MISSING_REQUIRED_OPTION) when the value is absent or blank
 */
function requireText(text: string | undefined): string {
  if (text === undefined || text.trim().length === 0) {
    console.error(chalk.red('✗ --text is required and must not be empty'))
    throw new UsageError(ERROR_IDS.MISSING_REQUIRED_OPTION, '--text is required and must not be empty', {
      option: '--text',
    })
  }
  return text
}

function createCommentGetCommand(): Command {
  return new Command('get')
    .description('Get a single comment')
    .argument('<story-gid>', 'Comment (story) GID')
    .action(async (storyGid: string, _options: any, command: Command) => {
      try {
        validateGid(storyGid, 'Comment GID')

        const client = getAsanaClient()
        const story = await client.stories.findById(storyGid, COMMENT_FIELDS)

        const format = getOutputFormat(command)
        const output = formatOutput({ comment: toCommentView(story) }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          failValidation(error, command)
        }
        handleAsanaError(error, 'Comment retrieval', { 'Comment GID': storyGid }, getOutputFormat(command))
      }
    })
}

function createCommentUpdateCommand(): Command {
  return new Command('update')
    .description('Edit the text of a comment')
    .argument('<story-gid>', 'Comment (story) GID')
    .option('--text <text>', 'New comment text (required)')
    .action(async (storyGid: string, options: { text?: string }, command: Command) => {
      try {
        validateGid(storyGid, 'Comment GID')
        const text = requireText(options.text)

        const client = getAsanaClient()
        const result = await client.stories.update(storyGid, { text })

        emitResult(
          { comment: { status: 'success', gid: result.gid ?? storyGid, text: result.text ?? text } },
          `✓ Comment ${storyGid} updated`,
          getOutputFormat(command),
        )
      }
      catch (error) {
        if (error instanceof ValidationError) {
          failValidation(error, command)
        }
        handleAsanaError(error, 'Comment update', { 'Comment GID': storyGid }, getOutputFormat(command))
      }
    })
}
