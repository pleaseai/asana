import { describe, expect, test } from 'bun:test'
import { createTeamCommand } from '../../src/commands/team'

describe('team command', () => {
  describe('command structure', () => {
    test('creates command with correct name', () => {
      const teamCommand = createTeamCommand()

      expect(teamCommand.name()).toBe('team')
    })

    test('creates command with correct description', () => {
      const teamCommand = createTeamCommand()

      expect(teamCommand.description()).toBe('Manage Asana teams')
    })

    test('has all required subcommands', () => {
      const teamCommand = createTeamCommand()
      const commandNames = teamCommand.commands.map(cmd => cmd.name())

      expect(commandNames).toContain('list')
      expect(commandNames).toContain('get')
      expect(commandNames).toContain('members')
    })
  })

  describe('list command', () => {
    test('has correct description', () => {
      const teamCommand = createTeamCommand()
      const listCommand = teamCommand.commands.find(cmd => cmd.name() === 'list')

      expect(listCommand?.description()).toBe('List teams in a workspace')
    })

    test('has optional workspace option', () => {
      const teamCommand = createTeamCommand()
      const listCommand = teamCommand.commands.find(cmd => cmd.name() === 'list')
      const workspaceOption = listCommand?.options.find(opt => opt.long === '--workspace')

      expect(workspaceOption).toBeDefined()
      expect(workspaceOption?.mandatory).toBe(false)
    })

    test('has no-cache flag to bypass cached data', () => {
      const teamCommand = createTeamCommand()
      const listCommand = teamCommand.commands.find(cmd => cmd.name() === 'list')
      const cacheOption = listCommand?.options.find(opt => opt.long === '--no-cache')

      expect(cacheOption).toBeDefined()
    })
  })

  describe('get command', () => {
    test('has correct description', () => {
      const teamCommand = createTeamCommand()
      const getCommand = teamCommand.commands.find(cmd => cmd.name() === 'get')

      expect(getCommand?.description()).toBe('Get team details')
    })

    test('requires team gid argument', () => {
      const teamCommand = createTeamCommand()
      const getCommand = teamCommand.commands.find(cmd => cmd.name() === 'get')

      expect(getCommand?.registeredArguments[0]?.required).toBe(true)
    })
  })

  describe('members command', () => {
    test('has correct description', () => {
      const teamCommand = createTeamCommand()
      const membersCommand = teamCommand.commands.find(cmd => cmd.name() === 'members')

      expect(membersCommand?.description()).toBe('List members of a team')
    })

    test('requires team gid argument', () => {
      const teamCommand = createTeamCommand()
      const membersCommand = teamCommand.commands.find(cmd => cmd.name() === 'members')

      expect(membersCommand?.registeredArguments[0]?.required).toBe(true)
    })
  })
})
