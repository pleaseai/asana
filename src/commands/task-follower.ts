import chalk from 'chalk'
import { Command } from 'commander'
import { getAsanaClient } from '../lib/asana-client'
import { handleAsanaError } from '../lib/error-handler'
import { validateGid, validateUserIdentifier, ValidationError } from '../lib/validators'
import { formatOutput, getOutputFormat } from '../utils/formatter'

// Asana has no standalone follower-list endpoint; fetch the task with the
// followers field expanded instead.
const FOLLOWER_FIELDS = { opt_fields: 'followers.name' }

export function createFollowerCommand(): Command {
  const follower = new Command('follower')
    .description('Manage task followers (collaborators receiving notifications)')

  follower
    .command('add')
    .description('Add a follower to a task')
    .argument('<task-gid>', 'Task GID')
    .argument('<user-gid>', 'User GID, email, or "me"')
    .action(async (taskGid: string, userGid: string, options: any, command: Command) => {
      try {
        validateGid(taskGid, 'Task GID')
        validateUserIdentifier(userGid, 'User')

        const client = getAsanaClient()
        await client.tasks.addFollowers(taskGid, [userGid])

        const format = getOutputFormat(command)
        const resultData = {
          status: 'success',
          gid: taskGid,
          added_follower: userGid,
        }
        const output = formatOutput({ follower: resultData }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Follower addition', {
          'Task GID': taskGid,
          'User': userGid,
        })
      }
    })

  follower
    .command('remove')
    .description('Remove a follower from a task')
    .argument('<task-gid>', 'Task GID')
    .argument('<user-gid>', 'User GID, email, or "me"')
    .action(async (taskGid: string, userGid: string, options: any, command: Command) => {
      try {
        validateGid(taskGid, 'Task GID')
        validateUserIdentifier(userGid, 'User')

        const client = getAsanaClient()
        await client.tasks.removeFollowers(taskGid, [userGid])

        const format = getOutputFormat(command)
        const resultData = {
          status: 'success',
          gid: taskGid,
          removed_follower: userGid,
        }
        const output = formatOutput({ follower: resultData }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Follower removal', {
          'Task GID': taskGid,
          'User': userGid,
        })
      }
    })

  follower
    .command('list')
    .description('List followers of a task')
    .argument('<task-gid>', 'Task GID')
    .action(async (taskGid: string, options: any, command: Command) => {
      try {
        validateGid(taskGid, 'Task GID')

        const client = getAsanaClient()
        const task = await client.tasks.findById(taskGid, FOLLOWER_FIELDS)
        const followers = (task.followers || []).map((user: any) => ({
          gid: user.gid,
          name: user.name,
        }))

        if (followers.length === 0) {
          console.log(chalk.yellow('No followers found'))
          return
        }

        const format = getOutputFormat(command)
        const output = formatOutput({ followers }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Follower listing', { 'Task GID': taskGid })
      }
    })

  return follower
}
