import type { OutputFormat } from '../utils/formatter'
import { Command } from 'commander'
import { getAsanaClient } from '../lib/asana-client'
import { toTaskView } from '../lib/asana-views'
import { handleAsanaError } from '../lib/error-handler'
import { formatOutput, getOutputFormat } from '../utils/formatter'

export function createTaskGetCommand(): Command {
  return new Command('get')
    .description('Get task details')
    .argument('<gid>', 'Task GID')
    .action(async (gid: string, _options: any, command: Command) => {
      try {
        const client = getAsanaClient()
        const taskDetail = await client.tasks.findById(gid)

        // Get format from parent command (root program)
        const format = (command.parent?.parent?.opts()?.format || 'toon') as OutputFormat

        // Format output based on selected format
        const output = formatOutput({ task: toTaskView(taskDetail) }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        handleAsanaError(error, 'Task retrieval', { 'Task GID': gid }, getOutputFormat(command))
      }
    })
}
