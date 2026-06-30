import type { CustomFieldListOptions } from '../types'
import chalk from 'chalk'
import { Command } from 'commander'
import { getAsanaClient } from '../lib/asana-client'
import { loadConfig } from '../lib/config'
import { coerceCustomFieldValue, mapTaskCustomField } from '../lib/custom-fields'
import { handleAsanaError } from '../lib/error-handler'
import { validateGid, ValidationError } from '../lib/validators'
import { formatOutput, getOutputFormat } from '../utils/formatter'

const TASK_CUSTOM_FIELD_FIELDS = {
  opt_fields: [
    'custom_fields.name',
    'custom_fields.resource_subtype',
    'custom_fields.display_value',
    'custom_fields.people_value.gid',
    'custom_fields.people_value.name',
    'custom_fields.enum_value.gid',
    'custom_fields.enum_value.name',
    'custom_fields.multi_enum_values.gid',
    'custom_fields.multi_enum_values.name',
    'custom_fields.date_value.date',
    'custom_fields.date_value.date_time',
  ].join(','),
}
const FIELD_DEFINITION_FIELDS = {
  opt_fields: 'name,resource_subtype,enum_options.name,enum_options.enabled',
}
const WORKSPACE_FIELD_FIELDS = {
  opt_fields: 'name,resource_subtype,description',
}

/**
 * `asana task custom-field <set|list>` — custom field values on a task.
 */
export function createTaskCustomFieldCommand(): Command {
  const customField = new Command('custom-field')
    .description('Manage custom field values on a task')

  customField
    .command('set')
    .description('Set a custom field value on a task')
    .argument('<task-gid>', 'Task GID')
    .argument('<field-gid>', 'Custom field GID')
    .argument('<value>', 'Value to set (text, number, or enum option name/GID)')
    .action(async (taskGid: string, fieldGid: string, value: string, options: unknown, command: Command) => {
      try {
        validateGid(taskGid, 'Task GID')
        validateGid(fieldGid, 'Custom field GID')

        const client = getAsanaClient()
        // Fetch the field definition to coerce the raw string into the
        // type the API expects (number, enum option GID, etc.)
        const field = await client.customFields.findById(fieldGid, FIELD_DEFINITION_FIELDS)
        const coerced = coerceCustomFieldValue(field, value)

        await client.tasks.update(taskGid, { custom_fields: { [fieldGid]: coerced } })

        const format = getOutputFormat(command)
        const resultData = {
          status: 'success',
          task: taskGid,
          field: field.name ?? fieldGid,
          value: String(coerced),
        }
        console.log(formatOutput({ custom_field: resultData }, { format, colors: process.stdout.isTTY }))
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Custom field update', {
          'Task GID': taskGid,
          'Field GID': fieldGid,
          'Value': value,
        })
      }
    })

  customField
    .command('list')
    .description('List custom field values on a task')
    .argument('<task-gid>', 'Task GID')
    .action(async (taskGid: string, options: unknown, command: Command) => {
      try {
        validateGid(taskGid, 'Task GID')
        const client = getAsanaClient()
        const task = await client.tasks.findById(taskGid, TASK_CUSTOM_FIELD_FIELDS)
        const fields = (task.custom_fields || []).map(mapTaskCustomField)

        if (fields.length === 0) {
          console.log(chalk.yellow('No custom fields found'))
          return
        }

        const format = getOutputFormat(command)
        console.log(formatOutput({ custom_fields: fields }, { format, colors: process.stdout.isTTY }))
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Custom field listing', { 'Task GID': taskGid })
      }
    })

  return customField
}

/**
 * `asana custom-field list --workspace <gid>` — workspace field definitions.
 */
export function createCustomFieldCommand(): Command {
  const customField = new Command('custom-field')
    .description('Manage workspace custom field definitions')

  customField
    .command('list')
    .description('List custom fields available in a workspace')
    .option('-w, --workspace <workspace>', 'Workspace GID (defaults to configured workspace)')
    .action(async (options: CustomFieldListOptions, command: Command) => {
      const config = loadConfig()
      const workspace = options.workspace || config?.workspace

      try {
        if (!workspace) {
          throw new Error('Workspace is required. Set default workspace or use -w option.')
        }
        validateGid(workspace, 'Workspace GID')

        const client = getAsanaClient()
        const response = await client.customFields.findByWorkspace(workspace, WORKSPACE_FIELD_FIELDS)
        const fields = (response.data || []).map((field: any) => ({
          gid: field.gid,
          name: field.name,
          type: field.resource_subtype ?? 'unknown',
          description: field.description ?? '',
        }))

        if (fields.length === 0) {
          console.log(chalk.yellow('No custom fields found'))
          return
        }

        const format = getOutputFormat(command)
        console.log(formatOutput({ custom_fields: fields }, { format, colors: process.stdout.isTTY }))
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Custom field listing', { 'Workspace GID': workspace })
      }
    })

  return customField
}
