import { describe, expect, test } from 'bun:test'
import { createUserCommand } from '../../src/commands/user'

describe('user command', () => {
  describe('command structure', () => {
    test('creates command with correct name', () => {
      const userCommand = createUserCommand()

      expect(userCommand.name()).toBe('user')
    })

    test('creates command with correct description', () => {
      const userCommand = createUserCommand()

      expect(userCommand.description()).toBe('Manage Asana users')
    })

    test('has all required subcommands', () => {
      const userCommand = createUserCommand()
      const commandNames = userCommand.commands.map(cmd => cmd.name())

      expect(commandNames).toContain('me')
      expect(commandNames).toContain('get')
      expect(commandNames).toContain('search')
      expect(commandNames).toContain('tasks')
    })
  })

  describe('me command', () => {
    test('has correct description', () => {
      const userCommand = createUserCommand()
      const meCommand = userCommand.commands.find(cmd => cmd.name() === 'me')

      expect(meCommand?.description()).toBe('Display the current authenticated user')
    })
  })

  describe('get command', () => {
    test('has correct description', () => {
      const userCommand = createUserCommand()
      const getCommand = userCommand.commands.find(cmd => cmd.name() === 'get')

      expect(getCommand?.description()).toBe('Get user details (GID, email, or "me")')
    })

    test('requires user identifier argument', () => {
      const userCommand = createUserCommand()
      const getCommand = userCommand.commands.find(cmd => cmd.name() === 'get')

      expect(getCommand?.registeredArguments[0]?.required).toBe(true)
    })
  })

  describe('search command', () => {
    test('has correct description', () => {
      const userCommand = createUserCommand()
      const searchCommand = userCommand.commands.find(cmd => cmd.name() === 'search')

      expect(searchCommand?.description()).toBe('Search workspace users by name or email (fuzzy)')
    })

    test('requires query argument', () => {
      const userCommand = createUserCommand()
      const searchCommand = userCommand.commands.find(cmd => cmd.name() === 'search')

      expect(searchCommand?.registeredArguments[0]?.required).toBe(true)
    })

    test('has optional workspace option', () => {
      const userCommand = createUserCommand()
      const searchCommand = userCommand.commands.find(cmd => cmd.name() === 'search')
      const workspaceOption = searchCommand?.options.find(opt => opt.long === '--workspace')

      expect(workspaceOption).toBeDefined()
      expect(workspaceOption?.mandatory).toBe(false)
    })
  })

  describe('tasks command', () => {
    test('has correct description', () => {
      const userCommand = createUserCommand()
      const tasksCommand = userCommand.commands.find(cmd => cmd.name() === 'tasks')

      expect(tasksCommand?.description()).toBe('List tasks assigned to a user')
    })

    test('requires user identifier argument', () => {
      const userCommand = createUserCommand()
      const tasksCommand = userCommand.commands.find(cmd => cmd.name() === 'tasks')

      expect(tasksCommand?.registeredArguments[0]?.required).toBe(true)
    })

    test('has optional workspace option', () => {
      const userCommand = createUserCommand()
      const tasksCommand = userCommand.commands.find(cmd => cmd.name() === 'tasks')
      const workspaceOption = tasksCommand?.options.find(opt => opt.long === '--workspace')

      expect(workspaceOption).toBeDefined()
    })

    test('has completed flag', () => {
      const userCommand = createUserCommand()
      const tasksCommand = userCommand.commands.find(cmd => cmd.name() === 'tasks')
      const completedOption = tasksCommand?.options.find(opt => opt.long === '--completed')

      expect(completedOption).toBeDefined()
    })
  })
})
