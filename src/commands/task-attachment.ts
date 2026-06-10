import type { AttachmentDownloadOptions } from '../types'
import { createReadStream, existsSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import chalk from 'chalk'
import { Command } from 'commander'
import { getAsanaClient } from '../lib/asana-client'
import { handleAsanaError } from '../lib/error-handler'
import { validateFileExists, validateGid, ValidationError } from '../lib/validators'
import { formatOutput, getOutputFormat } from '../utils/formatter'

// Request the fields we render explicitly; the API returns a compact
// representation (gid + name only) by default.
const ATTACHMENT_LIST_FIELDS = { opt_fields: 'name,resource_subtype,size,created_at' }
const ATTACHMENT_DOWNLOAD_FIELDS = { opt_fields: 'name,download_url' }

/**
 * `asana task attach <task-gid> <file>` — upload a local file to a task.
 *
 * Registered directly on the task command (not under `attachment`) to match
 * the ergonomics of `git add`-style frequent operations.
 */
export function createAttachCommand(): Command {
  return new Command('attach')
    .description('Upload a file as an attachment to a task')
    .argument('<task-gid>', 'Task GID')
    .argument('<file>', 'Path to the file to upload')
    .action(async (taskGid: string, file: string, options: unknown, command: Command) => {
      try {
        validateGid(taskGid, 'Task GID')
        const filePath = resolve(file)
        validateFileExists(filePath, 'Attachment file')

        const client = getAsanaClient()
        // Stream from disk so large files are not buffered in memory
        const result = await client.attachments.createForObject({
          parent: taskGid,
          file: createReadStream(filePath),
          name: basename(filePath),
        })

        const format = getOutputFormat(command)
        const resultData = {
          status: 'success',
          gid: result.gid,
          name: result.name ?? basename(filePath),
          parent: taskGid,
        }
        console.log(formatOutput({ attachment: resultData }, { format, colors: process.stdout.isTTY }))
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Attachment upload', {
          'Task GID': taskGid,
          'File': file,
        })
      }
    })
}

/**
 * `asana task attachment <list|download>` — manage existing attachments.
 */
export function createAttachmentCommand(): Command {
  const attachment = new Command('attachment')
    .description('Manage task attachments')

  attachment
    .command('list')
    .description('List attachments on a task')
    .argument('<task-gid>', 'Task GID')
    .action(async (taskGid: string, options: unknown, command: Command) => {
      try {
        validateGid(taskGid, 'Task GID')
        const client = getAsanaClient()
        const response = await client.attachments.findByParent(taskGid, ATTACHMENT_LIST_FIELDS)
        const attachments = (response.data || []).map((item: any) => ({
          gid: item.gid,
          name: item.name,
          type: item.resource_subtype ?? 'unknown',
          size: item.size ?? 0,
          created_at: item.created_at ?? '',
        }))

        if (attachments.length === 0) {
          console.log(chalk.yellow('No attachments found'))
          return
        }

        const format = getOutputFormat(command)
        console.log(formatOutput({ attachments }, { format, colors: process.stdout.isTTY }))
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Attachment listing', { 'Task GID': taskGid })
      }
    })

  attachment
    .command('download')
    .description('Download an attachment to a local file')
    .argument('<attachment-gid>', 'Attachment GID')
    .option('-o, --output <path>', 'Output file path (defaults to the attachment name)')
    .option('--force', 'Overwrite the output file if it already exists')
    .action(async (attachmentGid: string, options: AttachmentDownloadOptions, command: Command) => {
      try {
        validateGid(attachmentGid, 'Attachment GID')
        const client = getAsanaClient()
        const attachment = await client.attachments.findById(attachmentGid, ATTACHMENT_DOWNLOAD_FIELDS)

        if (!attachment.download_url) {
          console.error(chalk.red('✗ Attachment is not downloadable'))
          console.error(chalk.gray('  External attachments (e.g. Google Drive links) have no download URL.'))
          process.exit(1)
        }

        const outputPath = resolve(options.output ?? attachment.name ?? `attachment-${attachmentGid}`)
        if (existsSync(outputPath) && !options.force) {
          console.error(chalk.red(`✗ Output file already exists: ${outputPath}`))
          console.error(chalk.gray('  Use --force to overwrite or choose another path with --output.'))
          process.exit(1)
        }

        const response = await fetch(attachment.download_url)
        if (!response.ok) {
          console.error(chalk.red(`✗ Download failed (HTTP ${response.status})`))
          process.exit(1)
        }
        // Bun.write streams the response body to disk without buffering
        const bytes = await Bun.write(outputPath, response)

        const format = getOutputFormat(command)
        const resultData = {
          status: 'success',
          gid: attachmentGid,
          name: attachment.name,
          path: outputPath,
          size: bytes,
        }
        console.log(formatOutput({ attachment: resultData }, { format, colors: process.stdout.isTTY }))
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Attachment download', { 'Attachment GID': attachmentGid })
      }
    })

  return attachment
}
