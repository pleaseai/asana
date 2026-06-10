import chalk from 'chalk'
import { Command } from 'commander'
import { getAsanaClient } from '../lib/asana-client'
import { handleAsanaError } from '../lib/error-handler'
import { validateGid, ValidationError } from '../lib/validators'
import { formatOutput, getOutputFormat } from '../utils/formatter'

const TAG_FIELDS = { opt_fields: 'name,color' }

export function createTaskTagCommand(): Command {
  const tag = new Command('tag')
    .description('Manage tags on a task')

  tag
    .command('add')
    .description('Add a tag to a task')
    .argument('<task-gid>', 'Task GID')
    .argument('<tag-gid>', 'Tag GID')
    .action(async (taskGid: string, tagGid: string, options: any, command: Command) => {
      try {
        validateGid(taskGid, 'Task GID')
        validateGid(tagGid, 'Tag GID')

        const client = getAsanaClient()
        await client.tasks.addTag(taskGid, tagGid)

        const format = getOutputFormat(command)
        const resultData = {
          status: 'success',
          gid: taskGid,
          added_tag: tagGid,
        }
        const output = formatOutput({ tag: resultData }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Tag assignment', {
          'Task GID': taskGid,
          'Tag GID': tagGid,
        })
      }
    })

  tag
    .command('remove')
    .description('Remove a tag from a task')
    .argument('<task-gid>', 'Task GID')
    .argument('<tag-gid>', 'Tag GID')
    .action(async (taskGid: string, tagGid: string, options: any, command: Command) => {
      try {
        validateGid(taskGid, 'Task GID')
        validateGid(tagGid, 'Tag GID')

        const client = getAsanaClient()
        await client.tasks.removeTag(taskGid, tagGid)

        const format = getOutputFormat(command)
        const resultData = {
          status: 'success',
          gid: taskGid,
          removed_tag: tagGid,
        }
        const output = formatOutput({ tag: resultData }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Tag removal', {
          'Task GID': taskGid,
          'Tag GID': tagGid,
        })
      }
    })

  tag
    .command('list')
    .description('List tags on a task')
    .argument('<task-gid>', 'Task GID')
    .action(async (taskGid: string, options: any, command: Command) => {
      try {
        validateGid(taskGid, 'Task GID')

        const client = getAsanaClient()
        const response = await client.tags.findByTask(taskGid, TAG_FIELDS)
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
        handleAsanaError(error, 'Task tag listing', { 'Task GID': taskGid })
      }
    })

  return tag
}
