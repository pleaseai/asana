import chalk from 'chalk'
import { Command } from 'commander'
import { getAsanaClient } from '../lib/asana-client'
import { handleAsanaError } from '../lib/error-handler'
import {
  validateDependencyLimit,
  validateGid,
  validateNoSelfDependency,
  ValidationError,
} from '../lib/validators'
import { formatOutput, getOutputFormat } from '../utils/formatter'

const RELATIONSHIP_FIELDS = { opt_fields: 'name,completed' }

interface RelatedTask {
  gid: string
  name?: string
  completed?: boolean
}

function toRelatedList(response: { data?: RelatedTask[] }): RelatedTask[] {
  return (response.data || []).map(item => ({
    gid: item.gid,
    name: item.name,
    completed: item.completed,
  }))
}

export function createDependencyCommand(): Command {
  const dependency = new Command('dependency')
    .description('Manage task dependencies (tasks that block this task)')

  dependency
    .command('add')
    .description('Add a dependency (this task is blocked by depends-on task)')
    .argument('<task-gid>', 'Task GID that will be blocked')
    .argument('<depends-on-gid>', 'Task GID that must be completed first')
    .action(async (taskGid: string, dependsOnGid: string, options: any, command: Command) => {
      try {
        validateGid(taskGid, 'Task GID')
        validateGid(dependsOnGid, 'Depends-on task GID')
        validateNoSelfDependency(taskGid, dependsOnGid)

        const client = getAsanaClient()

        // Asana enforces a combined limit on dependencies + dependents.
        const [dependencies, dependents] = await Promise.all([
          client.tasks.getDependencies(taskGid, RELATIONSHIP_FIELDS),
          client.tasks.getDependents(taskGid, RELATIONSHIP_FIELDS),
        ])
        const combined = (dependencies.data?.length || 0) + (dependents.data?.length || 0)
        validateDependencyLimit(combined, 1)

        await client.tasks.addDependencies(taskGid, [dependsOnGid])

        const format = getOutputFormat(command)
        const resultData = {
          status: 'success',
          gid: taskGid,
          depends_on: dependsOnGid,
        }
        const output = formatOutput({ dependency: resultData }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Dependency addition', {
          'Task GID': taskGid,
          'Depends-on task GID': dependsOnGid,
        })
      }
    })

  dependency
    .command('remove')
    .description('Remove a dependency from a task')
    .argument('<task-gid>', 'Task GID')
    .argument('<depends-on-gid>', 'Dependency task GID to remove')
    .action(async (taskGid: string, dependsOnGid: string, options: any, command: Command) => {
      try {
        validateGid(taskGid, 'Task GID')
        validateGid(dependsOnGid, 'Depends-on task GID')

        const client = getAsanaClient()
        await client.tasks.removeDependencies(taskGid, [dependsOnGid])

        const format = getOutputFormat(command)
        const resultData = {
          status: 'success',
          gid: taskGid,
          removed_dependency: dependsOnGid,
        }
        const output = formatOutput({ dependency: resultData }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Dependency removal', {
          'Task GID': taskGid,
          'Depends-on task GID': dependsOnGid,
        })
      }
    })

  dependency
    .command('list')
    .description('List dependencies of a task (tasks that block it)')
    .argument('<task-gid>', 'Task GID')
    .action(async (taskGid: string, options: any, command: Command) => {
      try {
        validateGid(taskGid, 'Task GID')

        const client = getAsanaClient()
        const response = await client.tasks.getDependencies(taskGid, RELATIONSHIP_FIELDS)
        const dependencies = toRelatedList(response)

        if (dependencies.length === 0) {
          console.log(chalk.yellow('No dependencies found'))
          return
        }

        const format = getOutputFormat(command)
        const output = formatOutput({ dependencies }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Dependency listing', { 'Task GID': taskGid })
      }
    })

  return dependency
}

export function createDependentCommand(): Command {
  const dependent = new Command('dependent')
    .description('Inspect task dependents (tasks blocked by this task)')

  dependent
    .command('list')
    .description('List tasks that depend on this task')
    .argument('<task-gid>', 'Task GID')
    .action(async (taskGid: string, options: any, command: Command) => {
      try {
        validateGid(taskGid, 'Task GID')

        const client = getAsanaClient()
        const response = await client.tasks.getDependents(taskGid, RELATIONSHIP_FIELDS)
        const dependents = toRelatedList(response)

        if (dependents.length === 0) {
          console.log(chalk.yellow('No dependents found'))
          return
        }

        const format = getOutputFormat(command)
        const output = formatOutput({ dependents }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Dependent listing', { 'Task GID': taskGid })
      }
    })

  return dependent
}
