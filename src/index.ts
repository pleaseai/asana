#!/usr/bin/env bun
import { Command } from 'commander'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createAuthCommand } from './commands/auth'
import { createTaskCommand } from './commands/task'

// Read version from package.json
const packageJson = JSON.parse(
  readFileSync(join(import.meta.dir, '../package.json'), 'utf-8'),
)

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
