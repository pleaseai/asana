import type { SectionCreateOptions, SectionUpdateOptions } from '../types'
import type { OutputFormat } from '../utils/formatter'
import chalk from 'chalk'
import { Command } from 'commander'
import { getAsanaClient } from '../lib/asana-client'
import { handleAsanaError } from '../lib/error-handler'
import { validateGid, validateUpdateFields, ValidationError } from '../lib/validators'
import { formatOutput } from '../utils/formatter'

export function createSectionCommand(): Command {
  const section = new Command('section')
    .description('Manage Asana sections')

  section
    .command('list')
    .description('List sections in a project')
    .argument('<project-gid>', 'Project GID')
    .action(async (projectGid: string, options: any, command: Command) => {
      try {
        validateGid(projectGid, 'Project GID')
        const client = getAsanaClient()

        const sections = await client.sections.findByProject(projectGid)
        const sectionList = sections.data || []

        if (sectionList.length === 0) {
          console.log(chalk.yellow('No sections found'))
          return
        }

        const format = (command.parent?.parent?.opts()?.format || 'toon') as OutputFormat

        const output = formatOutput({ sections: sectionList }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Section listing', { 'Project GID': projectGid })
      }
    })

  section
    .command('create')
    .description('Create a new section in a project')
    .argument('<project-gid>', 'Project GID')
    .requiredOption('-n, --name <name>', 'Section name')
    .option('--insert-before <section-gid>', 'Insert before this section')
    .option('--insert-after <section-gid>', 'Insert after this section')
    .action(async (projectGid: string, options: SectionCreateOptions, command: Command) => {
      try {
        validateGid(projectGid, 'Project GID')

        if (options.insertBefore) {
          validateGid(options.insertBefore, 'Insert-before section GID')
        }
        if (options.insertAfter) {
          validateGid(options.insertAfter, 'Insert-after section GID')
        }

        const client = getAsanaClient()

        const sectionData: any = {
          name: options.name,
        }

        if (options.insertBefore)
          sectionData.insert_before = options.insertBefore
        if (options.insertAfter)
          sectionData.insert_after = options.insertAfter

        const result = await client.sections.createInProject(projectGid, sectionData)

        const format = (command.parent?.parent?.opts()?.format || 'toon') as OutputFormat

        const resultData = {
          status: 'success',
          gid: result.gid,
          name: result.name,
          project: projectGid,
        }

        const output = formatOutput({ section: resultData }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Section creation', {
          'Project GID': projectGid,
          'Section name': options.name,
        })
      }
    })

  section
    .command('update')
    .description('Update section properties')
    .argument('<section-gid>', 'Section GID')
    .option('-n, --name <name>', 'Update section name')
    .action(async (sectionGid: string, options: SectionUpdateOptions, command: Command) => {
      try {
        validateGid(sectionGid, 'Section GID')

        const client = getAsanaClient()

        const updateData: Partial<{
          name: string
        }> = {}

        if (options.name !== undefined)
          updateData.name = options.name

        validateUpdateFields(updateData)

        const result = await client.sections.update(sectionGid, updateData)

        const format = (command.parent?.parent?.opts()?.format || 'toon') as OutputFormat

        const resultData = {
          status: 'success',
          gid: result.gid,
          name: result.name,
        }

        const output = formatOutput({ section: resultData }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Section update', { 'Section GID': sectionGid })
      }
    })

  section
    .command('delete')
    .description('Delete a section')
    .argument('<section-gid>', 'Section GID')
    .action(async (sectionGid: string) => {
      try {
        validateGid(sectionGid, 'Section GID')
        const client = getAsanaClient()
        await client.sections.delete(sectionGid)

        console.log(chalk.green(`✓ Section ${sectionGid} deleted`))
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Section deletion', { 'Section GID': sectionGid })
      }
    })

  return section
}
