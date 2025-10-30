import type { TaskListOptions, TaskOptions } from '../types'
import chalk from 'chalk'
import { Command } from 'commander'
import { getAsanaClient } from '../lib/asana-client'
import { loadConfig } from '../lib/config'
import { formatOutput, type OutputFormat } from '../utils/formatter'

export function createTaskCommand(): Command {
  const task = new Command('task')
    .description('Manage Asana tasks')

  task
    .command('create')
    .description('Create a new task')
    .requiredOption('-n, --name <name>', 'Task name')
    .option('-d, --notes <notes>', 'Task description/notes')
    .option('-a, --assignee <assignee>', 'Assignee user GID')
    .option('--due <date>', 'Due date (YYYY-MM-DD)')
    .option('-w, --workspace <workspace>', 'Workspace GID')
    .option('-p, --project <project>', 'Project GID')
    .action(async (options: TaskOptions, command: Command) => {
      try {
        const client = getAsanaClient()
        const config = loadConfig()
        const workspace = options.workspace || config?.workspace

        if (!workspace) {
          throw new Error('Workspace is required. Set default workspace or use -w option.')
        }

        const taskData: any = {
          name: options.name,
          workspace,
        }

        if (options.notes)
          taskData.notes = options.notes
        if (options.assignee)
          taskData.assignee = options.assignee
        if (options.dueOn)
          taskData.due_on = options.dueOn
        if (options.project)
          taskData.projects = [options.project]

        const result = await client.tasks.create(taskData)

        // Get format from parent command (root program)
        const format = (command.parent?.parent?.opts()?.format || 'toon') as OutputFormat

        // Prepare result data for output
        const resultData = {
          status: 'success',
          gid: result.gid,
          name: result.name,
          permalink_url: result.permalink_url,
        }

        // Format output based on selected format
        const output = formatOutput({ task: resultData }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        console.error(chalk.red('✗ Failed to create task:'), error)
        process.exit(1)
      }
    })

  task
    .command('list')
    .description('List tasks')
    .option('-a, --assignee <assignee>', 'Filter by assignee (use "me" for current user)')
    .option('-w, --workspace <workspace>', 'Workspace GID')
    .option('-p, --project <project>', 'Project GID')
    .option('-c, --completed', 'Include completed tasks')
    .action(async (options: TaskListOptions, command: Command) => {
      try {
        const client = getAsanaClient()
        const config = loadConfig()
        const workspace = options.workspace || config?.workspace

        let tasks: any

        if (options.project) {
          tasks = await client.tasks.findByProject(options.project, {
            completed_since: options.completed ? 'now' : undefined,
          })
        }
        else if (options.assignee) {
          const assignee = options.assignee === 'me' ? 'me' : options.assignee
          tasks = await client.tasks.findAll({
            assignee,
            workspace,
            completed_since: options.completed ? 'now' : undefined,
          })
        }
        else if (workspace) {
          tasks = await client.tasks.findAll({
            workspace,
            completed_since: options.completed ? 'now' : undefined,
          })
        }
        else {
          throw new Error('Specify workspace, project, or assignee to list tasks')
        }

        const taskList = tasks.data || []

        if (taskList.length === 0) {
          console.log(chalk.yellow('No tasks found'))
          return
        }

        // Get format from parent command (root program)
        const format = (command.parent?.opts()?.format || 'toon') as OutputFormat

        // Format output based on selected format
        const output = formatOutput({ tasks: taskList }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        console.error(chalk.red('✗ Failed to list tasks:'), error)
        process.exit(1)
      }
    })

  task
    .command('get')
    .description('Get task details')
    .argument('<gid>', 'Task GID')
    .action(async (gid: string, options: any, command: Command) => {
      try {
        const client = getAsanaClient()
        const taskDetail = await client.tasks.findById(gid)

        // Get format from parent command (root program)
        const format = (command.parent?.parent?.opts()?.format || 'toon') as OutputFormat

        // Prepare task data for output
        const taskData = {
          gid: taskDetail.gid,
          name: taskDetail.name,
          completed: taskDetail.completed,
          assignee: taskDetail.assignee?.name,
          due_on: taskDetail.due_on,
          notes: taskDetail.notes,
          permalink_url: taskDetail.permalink_url,
        }

        // Format output based on selected format
        const output = formatOutput({ task: taskData }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        console.error(chalk.red('✗ Failed to get task:'), error)
        process.exit(1)
      }
    })

  task
    .command('complete')
    .description('Mark a task as complete')
    .argument('<gid>', 'Task GID')
    .action(async (gid: string) => {
      try {
        const client = getAsanaClient()
        await client.tasks.update(gid, { completed: true })

        console.log(chalk.green(`✓ Task ${gid} marked as complete`))
      }
      catch (error) {
        console.error(chalk.red('✗ Failed to complete task:'), error)
        process.exit(1)
      }
    })

  task
    .command('delete')
    .description('Delete a task')
    .argument('<gid>', 'Task GID')
    .action(async (gid: string) => {
      try {
        const client = getAsanaClient()
        await client.tasks.delete(gid)

        console.log(chalk.green(`✓ Task ${gid} deleted`))
      }
      catch (error) {
        console.error(chalk.red('✗ Failed to delete task:'), error)
        process.exit(1)
      }
    })

  return task
}
