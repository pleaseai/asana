import type { SubtaskCreateOptions, SubtaskListOptions } from '../types'
import chalk from 'chalk'
import { Command } from 'commander'
import { getAsanaClient } from '../lib/asana-client'
import { handleAsanaError } from '../lib/error-handler'
import { validateDateFormat, validateGid, ValidationError } from '../lib/validators'
import { formatOutput, getOutputFormat } from '../utils/formatter'

interface SubtaskEntry {
  gid: string
  name: string
  completed: boolean
  depth: number
}

/**
 * Recursively collect subtasks into a flat, depth-annotated list.
 *
 * Depth lets the caller render the hierarchy while keeping the output shape
 * compatible with the table-oriented formatter.
 */
async function collectSubtasks(
  client: ReturnType<typeof getAsanaClient>,
  parentGid: string,
  depth: number,
): Promise<SubtaskEntry[]> {
  const response = await client.tasks.getSubtasks(parentGid)
  const subtasks = response.data || []

  const entries: SubtaskEntry[] = []
  for (const subtask of subtasks) {
    entries.push({
      gid: subtask.gid,
      name: subtask.name,
      completed: subtask.completed ?? false,
      depth,
    })
    const nested = await collectSubtasks(client, subtask.gid, depth + 1)
    entries.push(...nested)
  }

  return entries
}

export function createSubtaskCommand(): Command {
  const subtask = new Command('subtask')
    .description('Manage task subtasks')

  subtask
    .command('list')
    .description('List subtasks of a parent task')
    .argument('<parent-gid>', 'Parent task GID')
    .option('-r, --recursive', 'List subtasks recursively (all nested levels)')
    .action(async (parentGid: string, options: SubtaskListOptions, command: Command) => {
      try {
        validateGid(parentGid, 'Parent task GID')
        const client = getAsanaClient()

        let subtaskList: SubtaskEntry[]
        if (options.recursive) {
          subtaskList = await collectSubtasks(client, parentGid, 0)
        }
        else {
          const response = await client.tasks.getSubtasks(parentGid)
          subtaskList = (response.data || []).map((item: any) => ({
            gid: item.gid,
            name: item.name,
            completed: item.completed ?? false,
            depth: 0,
          }))
        }

        if (subtaskList.length === 0) {
          console.log(chalk.yellow('No subtasks found'))
          return
        }

        const format = getOutputFormat(command)
        const output = formatOutput({ subtasks: subtaskList }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Subtask listing', { 'Parent task GID': parentGid })
      }
    })

  subtask
    .command('create')
    .description('Create a new subtask under a parent task')
    .argument('<parent-gid>', 'Parent task GID')
    .requiredOption('-n, --name <name>', 'Subtask name')
    .option('-d, --notes <notes>', 'Subtask description/notes')
    .option('-a, --assignee <assignee>', 'Assignee user GID')
    .option('--due-on <date>', 'Due date (YYYY-MM-DD)')
    .action(async (parentGid: string, options: SubtaskCreateOptions, command: Command) => {
      try {
        validateGid(parentGid, 'Parent task GID')
        if (options.dueOn) {
          validateDateFormat(options.dueOn, '--due-on')
        }

        const client = getAsanaClient()

        const taskData: Record<string, any> = { name: options.name }
        if (options.notes)
          taskData.notes = options.notes
        if (options.assignee)
          taskData.assignee = options.assignee
        if (options.dueOn)
          taskData.due_on = options.dueOn

        const result = await client.tasks.createSubtask(parentGid, taskData)

        const format = getOutputFormat(command)
        const resultData = {
          status: 'success',
          gid: result.gid,
          name: result.name,
          parent: parentGid,
          permalink_url: result.permalink_url,
        }

        const output = formatOutput({ subtask: resultData }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Subtask creation', {
          'Parent task GID': parentGid,
          'Subtask name': options.name,
        })
      }
    })

  subtask
    .command('add')
    .description('Convert an existing task into a subtask of a parent task')
    .argument('<task-gid>', 'Task GID to convert')
    .argument('<parent-gid>', 'Parent task GID')
    .action(async (taskGid: string, parentGid: string, options: any, command: Command) => {
      try {
        validateGid(taskGid, 'Task GID')
        validateGid(parentGid, 'Parent task GID')

        const client = getAsanaClient()
        await client.tasks.setParent(taskGid, parentGid)

        const format = getOutputFormat(command)
        const resultData = {
          status: 'success',
          gid: taskGid,
          parent: parentGid,
        }

        const output = formatOutput({ subtask: resultData }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Subtask assignment', {
          'Task GID': taskGid,
          'Parent task GID': parentGid,
        })
      }
    })

  return subtask
}
