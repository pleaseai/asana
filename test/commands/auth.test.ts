import { describe, expect, test } from 'bun:test'
import { createAuthCommand } from '../../src/commands/auth'

describe('auth command', () => {
  describe('command structure', () => {
    test('creates command with correct name', () => {
      const authCommand = createAuthCommand()

      expect(authCommand.name()).toBe('auth')
    })

    test('creates command with correct description', () => {
      const authCommand = createAuthCommand()

      expect(authCommand.description()).toBe('Manage Asana authentication')
    })

    test('has login subcommand', () => {
      const authCommand = createAuthCommand()
      const commandNames = authCommand.commands.map(cmd => cmd.name())

      expect(commandNames).toContain('login')
    })

    test('has logout subcommand', () => {
      const authCommand = createAuthCommand()
      const commandNames = authCommand.commands.map(cmd => cmd.name())

      expect(commandNames).toContain('logout')
    })

    test('has whoami subcommand', () => {
      const authCommand = createAuthCommand()
      const commandNames = authCommand.commands.map(cmd => cmd.name())

      expect(commandNames).toContain('whoami')
    })
  })

  describe('login command', () => {
    test('has correct description', () => {
      const authCommand = createAuthCommand()
      const loginCommand = authCommand.commands.find(cmd => cmd.name() === 'login')

      expect(loginCommand?.description()).toBe('Login to Asana (OAuth or PAT)')
    })

    test('has token option', () => {
      const authCommand = createAuthCommand()
      const loginCommand = authCommand.commands.find(cmd => cmd.name() === 'login')
      const options = loginCommand?.options.map(opt => opt.long)

      expect(options).toContain('--token')
    })

    test('has workspace option', () => {
      const authCommand = createAuthCommand()
      const loginCommand = authCommand.commands.find(cmd => cmd.name() === 'login')
      const options = loginCommand?.options.map(opt => opt.long)

      expect(options).toContain('--workspace')
    })
  })

  describe('logout command', () => {
    test('has correct description', () => {
      const authCommand = createAuthCommand()
      const logoutCommand = authCommand.commands.find(cmd => cmd.name() === 'logout')

      expect(logoutCommand?.description()).toBe('Remove stored credentials')
    })
  })

  describe('whoami command', () => {
    test('has correct description', () => {
      const authCommand = createAuthCommand()
      const whoamiCommand = authCommand.commands.find(cmd => cmd.name() === 'whoami')

      expect(whoamiCommand?.description()).toBe('Display current authenticated user')
    })
  })
})
