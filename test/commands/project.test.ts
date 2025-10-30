import { describe, expect, test } from 'bun:test'
import { createProjectCommand } from '../../src/commands/project'

describe('project command', () => {
  describe('command structure', () => {
    test('creates command with correct name', () => {
      const projectCommand = createProjectCommand()

      expect(projectCommand.name()).toBe('project')
    })

    test('creates command with correct description', () => {
      const projectCommand = createProjectCommand()

      expect(projectCommand.description()).toBe('Manage Asana projects')
    })

    test('has all required subcommands', () => {
      const projectCommand = createProjectCommand()
      const commandNames = projectCommand.commands.map(cmd => cmd.name())

      expect(commandNames).toContain('create')
      expect(commandNames).toContain('list')
      expect(commandNames).toContain('get')
      expect(commandNames).toContain('update')
      expect(commandNames).toContain('delete')
    })
  })

  describe('create command', () => {
    test('has correct description', () => {
      const projectCommand = createProjectCommand()
      const createCommand = projectCommand.commands.find(cmd => cmd.name() === 'create')

      expect(createCommand?.description()).toBe('Create a new project')
    })

    test('has name option as required', () => {
      const projectCommand = createProjectCommand()
      const createCommand = projectCommand.commands.find(cmd => cmd.name() === 'create')
      const nameOption = createCommand?.options.find(opt => opt.long === '--name')

      expect(nameOption).toBeDefined()
      expect(nameOption?.required).toBe(true)
    })

    test('has optional workspace option', () => {
      const projectCommand = createProjectCommand()
      const createCommand = projectCommand.commands.find(cmd => cmd.name() === 'create')
      const workspaceOption = createCommand?.options.find(opt => opt.long === '--workspace')

      expect(workspaceOption).toBeDefined()
    })

    test('has optional team option', () => {
      const projectCommand = createProjectCommand()
      const createCommand = projectCommand.commands.find(cmd => cmd.name() === 'create')
      const teamOption = createCommand?.options.find(opt => opt.long === '--team')

      expect(teamOption).toBeDefined()
    })

    test('has optional notes option', () => {
      const projectCommand = createProjectCommand()
      const createCommand = projectCommand.commands.find(cmd => cmd.name() === 'create')
      const notesOption = createCommand?.options.find(opt => opt.long === '--notes')

      expect(notesOption).toBeDefined()
    })

    test('has optional color option', () => {
      const projectCommand = createProjectCommand()
      const createCommand = projectCommand.commands.find(cmd => cmd.name() === 'create')
      const colorOption = createCommand?.options.find(opt => opt.long === '--color')

      expect(colorOption).toBeDefined()
    })

    test('has optional public flag', () => {
      const projectCommand = createProjectCommand()
      const createCommand = projectCommand.commands.find(cmd => cmd.name() === 'create')
      const publicOption = createCommand?.options.find(opt => opt.long === '--public')

      expect(publicOption).toBeDefined()
    })
  })

  describe('list command', () => {
    test('has correct description', () => {
      const projectCommand = createProjectCommand()
      const listCommand = projectCommand.commands.find(cmd => cmd.name() === 'list')

      expect(listCommand?.description()).toBe('List projects')
    })

    test('has optional workspace option', () => {
      const projectCommand = createProjectCommand()
      const listCommand = projectCommand.commands.find(cmd => cmd.name() === 'list')
      const workspaceOption = listCommand?.options.find(opt => opt.long === '--workspace')

      expect(workspaceOption).toBeDefined()
    })

    test('has optional team option', () => {
      const projectCommand = createProjectCommand()
      const listCommand = projectCommand.commands.find(cmd => cmd.name() === 'list')
      const teamOption = listCommand?.options.find(opt => opt.long === '--team')

      expect(teamOption).toBeDefined()
    })

    test('has optional archived flag', () => {
      const projectCommand = createProjectCommand()
      const listCommand = projectCommand.commands.find(cmd => cmd.name() === 'list')
      const archivedOption = listCommand?.options.find(opt => opt.long === '--archived')

      expect(archivedOption).toBeDefined()
    })
  })

  describe('get command', () => {
    test('has correct description', () => {
      const projectCommand = createProjectCommand()
      const getCommand = projectCommand.commands.find(cmd => cmd.name() === 'get')

      expect(getCommand?.description()).toBe('Get project details')
    })
  })

  describe('update command', () => {
    test('has correct description', () => {
      const projectCommand = createProjectCommand()
      const updateCommand = projectCommand.commands.find(cmd => cmd.name() === 'update')

      expect(updateCommand?.description()).toBe('Update project properties')
    })

    test('has optional name option', () => {
      const projectCommand = createProjectCommand()
      const updateCommand = projectCommand.commands.find(cmd => cmd.name() === 'update')
      const nameOption = updateCommand?.options.find(opt => opt.long === '--name')

      expect(nameOption).toBeDefined()
    })

    test('has optional notes option', () => {
      const projectCommand = createProjectCommand()
      const updateCommand = projectCommand.commands.find(cmd => cmd.name() === 'update')
      const notesOption = updateCommand?.options.find(opt => opt.long === '--notes')

      expect(notesOption).toBeDefined()
    })

    test('has optional color option', () => {
      const projectCommand = createProjectCommand()
      const updateCommand = projectCommand.commands.find(cmd => cmd.name() === 'update')
      const colorOption = updateCommand?.options.find(opt => opt.long === '--color')

      expect(colorOption).toBeDefined()
    })

    test('has optional archived option', () => {
      const projectCommand = createProjectCommand()
      const updateCommand = projectCommand.commands.find(cmd => cmd.name() === 'update')
      const archivedOption = updateCommand?.options.find(opt => opt.long === '--archived')

      expect(archivedOption).toBeDefined()
    })

    test('has optional public option', () => {
      const projectCommand = createProjectCommand()
      const updateCommand = projectCommand.commands.find(cmd => cmd.name() === 'update')
      const publicOption = updateCommand?.options.find(opt => opt.long === '--public')

      expect(publicOption).toBeDefined()
    })
  })

  describe('delete command', () => {
    test('has correct description', () => {
      const projectCommand = createProjectCommand()
      const deleteCommand = projectCommand.commands.find(cmd => cmd.name() === 'delete')

      expect(deleteCommand?.description()).toBe('Delete a project')
    })
  })
})
