#!/usr/bin/env bun
import { Command } from 'commander'
import packageJson from '../package.json'
import { createAuthCommand } from './commands/auth'
import { createCustomFieldCommand } from './commands/custom-field'
import { createProjectCommand } from './commands/project'
import { createSearchCommand } from './commands/search'
import { createSectionCommand } from './commands/section'
import { createSelfUpdateCommand } from './commands/self-update'
import { createTagCommand } from './commands/tag'
import { createTaskCommand } from './commands/task'
import { createTeamCommand } from './commands/team'
import { createUserCommand } from './commands/user'
import { createWorkspaceCommand } from './commands/workspace'

const program = new Command()

program
  .name('asana')
  .description('Asana CLI - Manage your Asana tasks from the command line')
  .version(packageJson.version)
  .option(
    '-f, --format <type>',
    'Output format: toon (token-efficient for LLMs), json (for scripting), plain (traditional)',
    'toon',
  )

// Register commands
program.addCommand(createAuthCommand())
program.addCommand(createTaskCommand())
program.addCommand(createProjectCommand())
program.addCommand(createSectionCommand())
program.addCommand(createTagCommand())
program.addCommand(createCustomFieldCommand())
program.addCommand(createSearchCommand())
program.addCommand(createTeamCommand())
program.addCommand(createWorkspaceCommand())
program.addCommand(createUserCommand())
program.addCommand(createSelfUpdateCommand())

// Parse arguments
program.parse(process.argv)
