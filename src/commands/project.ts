import type { ProjectCreateOptions, ProjectListOptions, ProjectUpdateOptions } from '../types'
import type { OutputFormat } from '../utils/formatter'
import chalk from 'chalk'
import { Command } from 'commander'
import { getAsanaClient } from '../lib/asana-client'
import { loadConfig } from '../lib/config'
import { handleAsanaError } from '../lib/error-handler'
import { validateGid, validateUpdateFields, ValidationError } from '../lib/validators'
import { formatOutput } from '../utils/formatter'

export function createProjectCommand(): Command {
  const project = new Command('project')
    .description('Manage Asana projects')

  project
    .command('create')
    .description('Create a new project')
    .requiredOption('-n, --name <name>', 'Project name')
    .option('-w, --workspace <workspace>', 'Workspace GID')
    .option('-t, --team <team>', 'Team GID')
    .option('-d, --notes <notes>', 'Project notes/description')
    .option('--color <color>', 'Project color')
    .option('--public', 'Make project public to workspace')
    .action(async (options: ProjectCreateOptions, command: Command) => {
      try {
        const client = getAsanaClient()
        const config = loadConfig()
        const workspace = options.workspace || config?.workspace

        if (!workspace) {
          throw new Error('Workspace is required. Set default workspace or use -w option.')
        }

        const { name, team, notes, color } = options
        const projectData = {
          name,
          workspace,
          ...(team && { team }),
          ...(notes && { notes }),
          ...(color && { color }),
          ...(options.public !== undefined && { public: options.public }),
        }

        const result = await client.projects.create(projectData)

        const format = (command.parent?.parent?.opts()?.format || 'toon') as OutputFormat

        const resultData = {
          status: 'success',
          gid: result.gid,
          name: result.name,
          permalink_url: result.permalink_url,
        }

        const output = formatOutput({ project: resultData }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        handleAsanaError(error, 'Project creation', {
          'Project name': options.name,
          'Workspace': workspace,
          'Team': options.team,
        })
      }
    })

  project
    .command('list')
    .description('List projects')
    .option('-w, --workspace <workspace>', 'Workspace GID')
    .option('-t, --team <team>', 'Team GID')
    .option('-a, --archived', 'Include archived projects')
    .action(async (options: ProjectListOptions, command: Command) => {
      try {
        const client = getAsanaClient()
        const config = loadConfig()
        const workspace = options.workspace || config?.workspace

        if (!workspace && !options.team) {
          throw new Error('Workspace or team is required. Set default workspace or use -w/-t option.')
        }

        let projects: any

        if (options.team) {
          projects = await client.projects.findByTeam(options.team, {
            archived: options.archived || false,
          })
        }
        else {
          projects = await client.projects.findByWorkspace(workspace, {
            archived: options.archived || false,
          })
        }

        const projectList = projects.data || []

        if (projectList.length === 0) {
          console.log(chalk.yellow('No projects found'))
          return
        }

        const format = (command.parent?.parent?.opts()?.format || 'toon') as OutputFormat

        const output = formatOutput({ projects: projectList }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        handleAsanaError(error, 'Project listing', {
          Workspace: workspace,
          Team: options.team,
        })
      }
    })

  project
    .command('get')
    .description('Get project details')
    .argument('<gid>', 'Project GID')
    .action(async (gid: string, options: any, command: Command) => {
      try {
        validateGid(gid, 'Project GID')
        const client = getAsanaClient()
        const projectDetail = await client.projects.findById(gid)

        const format = (command.parent?.parent?.opts()?.format || 'toon') as OutputFormat

        const projectData = {
          gid: projectDetail.gid,
          name: projectDetail.name,
          archived: projectDetail.archived,
          color: projectDetail.color,
          notes: projectDetail.notes,
          public: projectDetail.public,
          permalink_url: projectDetail.permalink_url,
        }

        const output = formatOutput({ project: projectData }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Project retrieval', { 'Project GID': gid })
      }
    })

  project
    .command('update')
    .description('Update project properties')
    .argument('<gid>', 'Project GID')
    .option('-n, --name <name>', 'Update project name')
    .option('-d, --notes <notes>', 'Update project notes/description')
    .option('--color <color>', 'Update project color')
    .option('--archived <boolean>', 'Archive or unarchive project (true/false)')
    .option('--public <boolean>', 'Make project public or private (true/false)')
    .action(async (gid: string, options: ProjectUpdateOptions, command: Command) => {
      try {
        validateGid(gid, 'Project GID')

        const client = getAsanaClient()

        const updateData: Partial<{
          name: string
          notes: string
          color: string
          archived: boolean
          public: boolean
        }> = {}

        if (options.name !== undefined)
          updateData.name = options.name
        if (options.notes !== undefined)
          updateData.notes = options.notes
        if (options.color !== undefined)
          updateData.color = options.color
        // Commander.js parses boolean flags as strings, so we need explicit conversion
        if (options.archived !== undefined)
          updateData.archived = options.archived === 'true' || options.archived === true
        if (options.public !== undefined)
          updateData.public = options.public === 'true' || options.public === true

        validateUpdateFields(updateData)

        const result = await client.projects.update(gid, updateData)

        const format = (command.parent?.parent?.opts()?.format || 'toon') as OutputFormat

        const resultData = {
          status: 'success',
          gid: result.gid,
          name: result.name,
          archived: result.archived,
          color: result.color,
          public: result.public,
          permalink_url: result.permalink_url,
        }

        const output = formatOutput({ project: resultData }, { format, colors: process.stdout.isTTY })
        console.log(output)
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Project update', { 'Project GID': gid })
      }
    })

  project
    .command('delete')
    .description('Delete a project')
    .argument('<gid>', 'Project GID')
    .action(async (gid: string) => {
      try {
        validateGid(gid, 'Project GID')
        const client = getAsanaClient()
        await client.projects.delete(gid)

        console.log(chalk.green(`✓ Project ${gid} deleted`))
      }
      catch (error) {
        if (error instanceof ValidationError) {
          process.exit(1)
        }
        handleAsanaError(error, 'Project deletion', { 'Project GID': gid })
      }
    })

  return project
}
