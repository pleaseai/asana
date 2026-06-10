import { describe, expect, test } from 'bun:test'
import { createWorkspaceCommand } from '../../src/commands/workspace'

describe('workspace command', () => {
  describe('command structure', () => {
    test('creates command with correct name', () => {
      const workspaceCommand = createWorkspaceCommand()

      expect(workspaceCommand.name()).toBe('workspace')
    })

    test('creates command with correct description', () => {
      const workspaceCommand = createWorkspaceCommand()

      expect(workspaceCommand.description()).toBe('Manage Asana workspaces')
    })

    test('has all required subcommands', () => {
      const workspaceCommand = createWorkspaceCommand()
      const commandNames = workspaceCommand.commands.map(cmd => cmd.name())

      expect(commandNames).toContain('list')
      expect(commandNames).toContain('get')
      expect(commandNames).toContain('users')
      expect(commandNames).toContain('set-default')
    })
  })

  describe('list command', () => {
    test('has correct description', () => {
      const workspaceCommand = createWorkspaceCommand()
      const listCommand = workspaceCommand.commands.find(cmd => cmd.name() === 'list')

      expect(listCommand?.description()).toBe('List workspaces for the current user')
    })

    test('has no-cache flag to bypass cached data', () => {
      const workspaceCommand = createWorkspaceCommand()
      const listCommand = workspaceCommand.commands.find(cmd => cmd.name() === 'list')
      const cacheOption = listCommand?.options.find(opt => opt.long === '--no-cache')

      expect(cacheOption).toBeDefined()
    })
  })

  describe('get command', () => {
    test('has correct description', () => {
      const workspaceCommand = createWorkspaceCommand()
      const getCommand = workspaceCommand.commands.find(cmd => cmd.name() === 'get')

      expect(getCommand?.description()).toBe('Get workspace details')
    })

    test('requires workspace gid argument', () => {
      const workspaceCommand = createWorkspaceCommand()
      const getCommand = workspaceCommand.commands.find(cmd => cmd.name() === 'get')

      expect(getCommand?.registeredArguments[0]?.required).toBe(true)
    })
  })

  describe('users command', () => {
    test('has correct description', () => {
      const workspaceCommand = createWorkspaceCommand()
      const usersCommand = workspaceCommand.commands.find(cmd => cmd.name() === 'users')

      expect(usersCommand?.description()).toBe('List users in a workspace')
    })

    test('has optional workspace gid argument falling back to default', () => {
      const workspaceCommand = createWorkspaceCommand()
      const usersCommand = workspaceCommand.commands.find(cmd => cmd.name() === 'users')

      expect(usersCommand?.registeredArguments[0]?.required).toBe(false)
    })
  })

  describe('set-default command', () => {
    test('has correct description', () => {
      const workspaceCommand = createWorkspaceCommand()
      const setDefaultCommand = workspaceCommand.commands.find(cmd => cmd.name() === 'set-default')

      expect(setDefaultCommand?.description()).toBe('Set the default workspace in config')
    })

    test('requires workspace gid argument', () => {
      const workspaceCommand = createWorkspaceCommand()
      const setDefaultCommand = workspaceCommand.commands.find(cmd => cmd.name() === 'set-default')

      expect(setDefaultCommand?.registeredArguments[0]?.required).toBe(true)
    })
  })
})
