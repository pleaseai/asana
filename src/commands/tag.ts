import type { TagCreateOptions, TagListOptions, TagUpdateOptions } from '../types'
import chalk from 'chalk'
import { Command } from 'commander'
import { ERROR_IDS } from '../constants/errorIds'
import { getAsanaClient } from '../lib/asana-client'
import { loadConfig } from '../lib/config'
import { handleAsanaError } from '../lib/error-handler'
import { validateGid, validateTagColor, ValidationError } from '../lib/validators'
import { formatOutput, getOutputFormat } from '../utils/formatter'

const TAG_FIELDS = { opt_fields: 'name,color' }
const TAG_DETAIL_FIELDS = { opt_fields: 'name,color,notes,workspace.name,permalink_url' }

function resolveWorkspace(optionWorkspace?: string): string {
  const workspace = optionWorkspace || loadConfig()?.workspace
  if (!workspace) {
    throw new Error('Workspace is required. Set default workspace or use -w option.')
  }
  return workspace
}

export function createTagCommand(): Command {
  const tag = new Command('tag')
    .description('Manage Asana tags')

  tag
    .command('list')
    .description('List tags in a workspace')
    .option('-w, --workspace <workspace>', 'Workspace GID')
    .action(async (options: TagListOptions, command: Command) => {
      try {
        const workspace = resolveWorkspace(options.workspace)
        validateGid(workspace, 'Workspace GID')

        const client = getAsanaClient()
        const response = await client.tags.findByWorkspace(workspace, TAG_FIELDS)
        const tags = (response.data || []).map((item: any) => ({
          gid: item.gid,
          name: item.name,
          color: item.color,
        }))

        if (tags.length === 0) {
          console.log(chalk.yellow('No tags found'))
          return
        }

        const format = getOutputFormat(command)
        const output = formatOutput({ tags }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Tag listing', { Workspace: options.workspace })
      }
    })

  tag
    .command('create')
    .description('Create a new tag')
    .requiredOption('-n, --name <name>', 'Tag name')
    .option('-w, --workspace <workspace>', 'Workspace GID')
    .option('-c, --color <color>', 'Tag color (e.g., dark-red, light-blue)')
    .option('-d, --notes <notes>', 'Tag description/notes')
    .action(async (options: TagCreateOptions, command: Command) => {
      try {
        const workspace = resolveWorkspace(options.workspace)
        validateGid(workspace, 'Workspace GID')
        if (options.color) {
          validateTagColor(options.color)
        }

        const tagData: Record<string, any> = {
          name: options.name,
          workspace,
        }
        if (options.color) {
          tagData.color = options.color
        }
        if (options.notes) {
          tagData.notes = options.notes
        }

        const client = getAsanaClient()
        const result = await client.tags.create(tagData)

        const format = getOutputFormat(command)
        const resultData = {
          status: 'success',
          gid: result.gid,
          name: result.name,
          color: result.color,
          permalink_url: result.permalink_url,
        }
        const output = formatOutput({ tag: resultData }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Tag creation', {
          'Tag name': options.name,
          'Workspace': options.workspace,
        })
      }
    })

  tag
    .command('get')
    .description('Get tag details')
    .argument('<tag-gid>', 'Tag GID')
    .action(async (tagGid: string, options: any, command: Command) => {
      try {
        validateGid(tagGid, 'Tag GID')

        const client = getAsanaClient()
        const result = await client.tags.findById(tagGid, TAG_DETAIL_FIELDS)

        const format = getOutputFormat(command)
        const tagData = {
          gid: result.gid,
          name: result.name,
          color: result.color,
          notes: result.notes,
          workspace: result.workspace?.name,
          permalink_url: result.permalink_url,
        }
        const output = formatOutput({ tag: tagData }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Tag retrieval', { 'Tag GID': tagGid })
      }
    })

  tag
    .command('update')
    .description('Update tag properties')
    .argument('<tag-gid>', 'Tag GID')
    .option('-n, --name <name>', 'Update tag name')
    .option('-c, --color <color>', 'Update tag color (e.g., dark-red, light-blue)')
    .option('-d, --notes <notes>', 'Update tag description/notes')
    .action(async (tagGid: string, options: TagUpdateOptions, command: Command) => {
      try {
        validateGid(tagGid, 'Tag GID')

        const updateData: Record<string, any> = {}
        if (options.name !== undefined) {
          updateData.name = options.name
        }
        if (options.color !== undefined) {
          validateTagColor(options.color)
          updateData.color = options.color
        }
        if (options.notes !== undefined) {
          updateData.notes = options.notes
        }

        if (Object.keys(updateData).length === 0) {
          console.error(chalk.red('✗ At least one field must be specified for update'))
          console.error(chalk.gray('  Available options: --name, --color, --notes'))
          throw new ValidationError(
            ERROR_IDS.NO_UPDATE_FIELDS,
            'No update fields provided',
            { fields: updateData },
          )
        }

        const client = getAsanaClient()
        const result = await client.tags.update(tagGid, updateData)

        const format = getOutputFormat(command)
        const resultData = {
          status: 'success',
          gid: result.gid,
          name: result.name,
          color: result.color,
        }
        const output = formatOutput({ tag: resultData }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Tag update', { 'Tag GID': tagGid })
      }
    })

  tag
    .command('delete')
    .description('Delete a tag')
    .argument('<tag-gid>', 'Tag GID')
    .action(async (tagGid: string) => {
      try {
        validateGid(tagGid, 'Tag GID')

        const client = getAsanaClient()
        await client.tags.delete(tagGid)

        console.log(chalk.green(`✓ Tag ${tagGid} deleted`))
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Tag deletion', { 'Tag GID': tagGid })
      }
    })

  return tag
}
