#!/usr/bin/env bun
import { Command } from 'commander'
import { createAuthCommand } from './commands/auth'
import { createTaskCommand } from './commands/task'
import packageJson from '../package.json'

const program = new Command()

program
  .name('asana')
  .description('Asana CLI - Manage your Asana tasks from the command line')
  .version(packageJson.version)

// Register commands
program.addCommand(createAuthCommand())
program.addCommand(createTaskCommand())

// Parse arguments
program.parse(process.argv)
