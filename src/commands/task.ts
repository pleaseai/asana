import type { TaskListOptions, TaskMoveOptions, TaskOptions, TaskUpdateOptions } from '../types'
import type { OutputFormat } from '../utils/formatter'
import chalk from 'chalk'
import { Command } from 'commander'
import { getAsanaClient } from '../lib/asana-client'
import { loadConfig } from '../lib/config'
import { handleAsanaError } from '../lib/error-handler'
import { validateDateFormat, validateGid, validateUpdateFields, ValidationError } from '../lib/validators'
import { formatOutput } from '../utils/formatter'

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
        handleAsanaError(error, 'Task creation', {
          'Task name': options.name,
          'Workspace': workspace,
          'Project': options.project,
        })
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
        handleAsanaError(error, 'Task listing', {
          'Workspace': workspace,
          'Project': options.project,
          'Assignee': options.assignee,
        })
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
        handleAsanaError(error, 'Task retrieval', { 'Task GID': gid })
      }
    })

  task
    .command('update')
    .description('Update task properties')
    .argument('<gid>', 'Task GID')
    .option('-n, --name <name>', 'Update task name')
    .option('-d, --notes <notes>', 'Update task description/notes')
    .option('-a, --assignee <assignee>', 'Update assignee user GID')
    .option('--due-on <date>', 'Update due date (YYYY-MM-DD)')
    .option('--start-on <date>', 'Update start date (YYYY-MM-DD)')
    .option('-c, --completed <boolean>', 'Mark task as completed or incomplete (true/false)')
    .action(async (gid: string, options: TaskUpdateOptions, command: Command) => {
      try {
        validateGid(gid, 'Task GID')

        const client = getAsanaClient()

        const updateData: Partial<{
          name: string
          notes: string
          assignee: string
          due_on: string
          start_on: string
          completed: boolean
        }> = {}

        if (options.name !== undefined)
          updateData.name = options.name
        if (options.notes !== undefined)
          updateData.notes = options.notes
        if (options.assignee !== undefined)
          updateData.assignee = options.assignee
        if (options.dueOn !== undefined) {
          validateDateFormat(options.dueOn, '--due-on')
          updateData.due_on = options.dueOn
        }
        if (options.startOn !== undefined) {
          validateDateFormat(options.startOn, '--start-on')
          updateData.start_on = options.startOn
        }
        // Commander.js parses boolean flags as strings, so we need explicit conversion
        if (options.completed !== undefined)
          updateData.completed = options.completed === 'true' || options.completed === true

        validateUpdateFields(updateData)

        const result = await client.tasks.update(gid, updateData)

        const format = (command.parent?.parent?.opts()?.format || 'toon') as OutputFormat

        const resultData = {
          status: 'success',
          gid: result.gid,
          name: result.name,
          completed: result.completed,
          assignee: result.assignee?.name,
          due_on: result.due_on,
          start_on: result.start_on,
          permalink_url: result.permalink_url,
        }

        const output = formatOutput({ task: resultData }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Task update', { 'Task GID': gid })
      }
    })

  task
    .command('move')
    .description('Move task to a different project')
    .argument('<gid>', 'Task GID')
    .requiredOption('-p, --project <project>', 'Target project GID')
    .option('-s, --section <section>', 'Target section GID (optional)')
    .action(async (gid: string, options: TaskMoveOptions, command: Command) => {
      try {
        validateGid(gid, 'Task GID')
        validateGid(options.project, 'Project GID')
        if (options.section) {
          validateGid(options.section, 'Section GID')
        }

        const client = getAsanaClient()

        // Asana requires explicit removal from current projects before adding to new project
        const currentTask = await client.tasks.findById(gid)

        if (currentTask.projects && currentTask.projects.length > 0) {
          for (const project of currentTask.projects) {
            try {
              await client.tasks.removeProject(gid, { project: project.gid })
            }
            catch (removeError: any) {
              // Continue despite individual project removal failures to ensure partial migration succeeds
              console.warn(chalk.yellow(`⚠ Warning: Could not remove from project ${project.gid}`))
              if (removeError.message) {
                console.warn(chalk.gray(`  Reason: ${removeError.message}`))
              }
            }
          }
        }

        const addData: { project: string, section?: string } = {
          project: options.project,
        }
        if (options.section) {
          addData.section = options.section
        }

        await client.tasks.addProject(gid, addData)

        const updatedTask = await client.tasks.findById(gid)

        const format = (command.parent?.parent?.opts()?.format || 'toon') as OutputFormat

        const resultData = {
          status: 'success',
          gid: updatedTask.gid,
          name: updatedTask.name,
          project: options.project,
          section: options.section,
          permalink_url: updatedTask.permalink_url,
        }

        const output = formatOutput({ task: resultData }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Task move', {
          'Task GID': gid,
          'Target project': options.project,
          'Target section': options.section,
        })
      }
    })

  task
    .command('complete')
    .description('Mark a task as complete')
    .argument('<gid>', 'Task GID')
    .action(async (gid: string) => {
      try {
        validateGid(gid, 'Task GID')
        const client = getAsanaClient()
        await client.tasks.update(gid, { completed: true })

        console.log(chalk.green(`✓ Task ${gid} marked as complete`))
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Task completion', { 'Task GID': gid })
      }
    })

  task
    .command('delete')
    .description('Delete a task')
    .argument('<gid>', 'Task GID')
    .action(async (gid: string) => {
      try {
        validateGid(gid, 'Task GID')
        const client = getAsanaClient()
        await client.tasks.delete(gid)

        console.log(chalk.green(`✓ Task ${gid} deleted`))
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Task deletion', { 'Task GID': gid })
      }
    })

  return task
}
