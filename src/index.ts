#!/usr/bin/env bun
import { Command } from 'commander'
import packageJson from '../package.json'
import { createAuthCommand } from './commands/auth'
import { createSelfUpdateCommand } from './commands/self-update'
import { createTaskCommand } from './commands/task'

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
program.addCommand(createSelfUpdateCommand())

// Parse arguments
program.parse(process.argv)
