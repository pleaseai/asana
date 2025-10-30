import { describe, expect, test } from 'bun:test'
import { createSectionCommand } from '../../src/commands/section'

describe('section command', () => {
  describe('command structure', () => {
    test('creates command with correct name', () => {
      const sectionCommand = createSectionCommand()

      expect(sectionCommand.name()).toBe('section')
    })

    test('creates command with correct description', () => {
      const sectionCommand = createSectionCommand()

      expect(sectionCommand.description()).toBe('Manage Asana sections')
    })

    test('has all required subcommands', () => {
      const sectionCommand = createSectionCommand()
      const commandNames = sectionCommand.commands.map(cmd => cmd.name())

      expect(commandNames).toContain('list')
      expect(commandNames).toContain('create')
      expect(commandNames).toContain('update')
      expect(commandNames).toContain('delete')
    })
  })

  describe('list command', () => {
    test('has correct description', () => {
      const sectionCommand = createSectionCommand()
      const listCommand = sectionCommand.commands.find(cmd => cmd.name() === 'list')

      expect(listCommand?.description()).toBe('List sections in a project')
    })
  })

  describe('create command', () => {
    test('has correct description', () => {
      const sectionCommand = createSectionCommand()
      const createCommand = sectionCommand.commands.find(cmd => cmd.name() === 'create')

      expect(createCommand?.description()).toBe('Create a new section in a project')
    })

    test('has name option as required', () => {
      const sectionCommand = createSectionCommand()
      const createCommand = sectionCommand.commands.find(cmd => cmd.name() === 'create')
      const nameOption = createCommand?.options.find(opt => opt.long === '--name')

      expect(nameOption).toBeDefined()
      expect(nameOption?.required).toBe(true)
    })

    test('has optional insert-before option', () => {
      const sectionCommand = createSectionCommand()
      const createCommand = sectionCommand.commands.find(cmd => cmd.name() === 'create')
      const insertBeforeOption = createCommand?.options.find(opt => opt.long === '--insert-before')

      expect(insertBeforeOption).toBeDefined()
    })

    test('has optional insert-after option', () => {
      const sectionCommand = createSectionCommand()
      const createCommand = sectionCommand.commands.find(cmd => cmd.name() === 'create')
      const insertAfterOption = createCommand?.options.find(opt => opt.long === '--insert-after')

      expect(insertAfterOption).toBeDefined()
    })
  })

  describe('update command', () => {
    test('has correct description', () => {
      const sectionCommand = createSectionCommand()
      const updateCommand = sectionCommand.commands.find(cmd => cmd.name() === 'update')

      expect(updateCommand?.description()).toBe('Update section properties')
    })

    test('has optional name option', () => {
      const sectionCommand = createSectionCommand()
      const updateCommand = sectionCommand.commands.find(cmd => cmd.name() === 'update')
      const nameOption = updateCommand?.options.find(opt => opt.long === '--name')

      expect(nameOption).toBeDefined()
    })
  })

  describe('delete command', () => {
    test('has correct description', () => {
      const sectionCommand = createSectionCommand()
      const deleteCommand = sectionCommand.commands.find(cmd => cmd.name() === 'delete')

      expect(deleteCommand?.description()).toBe('Delete a section')
    })
  })
})
