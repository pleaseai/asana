#!/usr/bin/env bun
import chalk from 'chalk'
import { Command } from 'commander'
import packageJson from '../package.json'
import { createApiCommand } from './commands/api'
import { createAuthCommand } from './commands/auth'
import { createCustomFieldCommand } from './commands/custom-field'
import { createFetchCommand } from './commands/fetch'
import { createProjectCommand } from './commands/project'
import { createSearchCommand } from './commands/search'
import { createSectionCommand } from './commands/section'
import { createSelfUpdateCommand } from './commands/self-update'
import { createTagCommand } from './commands/tag'
import { createTaskCommand } from './commands/task'
import { createTeamCommand } from './commands/team'
import { createUserCommand } from './commands/user'
import { createWorkspaceCommand } from './commands/workspace'
import { refreshTokenIfNeeded, shouldRefreshAuthForCommand } from './lib/asana-client'

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
program.addCommand(createApiCommand())
program.addCommand(createFetchCommand())
program.addCommand(createProjectCommand())
program.addCommand(createSectionCommand())
program.addCommand(createTagCommand())
program.addCommand(createCustomFieldCommand())
program.addCommand(createSearchCommand())
program.addCommand(createTeamCommand())
program.addCommand(createWorkspaceCommand())
program.addCommand(createUserCommand())
program.addCommand(createSelfUpdateCommand())

// Refresh an expiring OAuth token before any authenticated command runs, so a
// stored refresh token is actually used instead of failing the call.
program.hook('preAction', async (_thisCommand, actionCommand) => {
  // Build the invoked command path, e.g. "auth whoami" or "task list".
  const segments: string[] = []
  let cmd: Command | null = actionCommand
  while (cmd && cmd !== program) {
    segments.unshift(cmd.name())
    cmd = cmd.parent
  }
  const commandPath = segments.join(' ')

  if (!shouldRefreshAuthForCommand(commandPath)) {
    return
  }

  try {
    await refreshTokenIfNeeded()
  }
  catch (error) {
    console.error(chalk.red(`✗ ${error instanceof Error ? error.message : 'OAuth token refresh failed'}`))
    process.exit(1)
  }
})

// Parse arguments. Surface any rejection from async action handlers as a clean
// error exit instead of an unhandled-rejection warning. (Top-level await is
// disallowed by the project lint config, so handle the promise explicitly.)
program.parseAsync(process.argv).catch((error) => {
  console.error(chalk.red(`✗ ${error instanceof Error ? error.message : 'Command failed'}`))
  process.exit(1)
})
