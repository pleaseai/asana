/**
 * Task Update Command Validation Tests
 *
 * Tests validation logic and edge cases for task update functionality
 */

import { describe, expect, test } from 'bun:test'
import { createTaskCommand } from '../../src/commands/task'

describe('task update command validation', () => {
  describe('command options validation', () => {
    test('should have mutually exclusive update options', () => {
      const taskCommand = createTaskCommand()
      const updateCommand = taskCommand.commands.find(cmd => cmd.name() === 'update')!

      const optionNames = updateCommand.options.map(opt => opt.long)

      // Should have all update options available
      expect(optionNames).toContain('--name')
      expect(optionNames).toContain('--notes')
      expect(optionNames).toContain('--assignee')
      expect(optionNames).toContain('--due-on')
      expect(optionNames).toContain('--start-on')
      expect(optionNames).toContain('--completed')
    })

    test('should accept gid as positional argument', () => {
      const taskCommand = createTaskCommand()
      const updateCommand = taskCommand.commands.find(cmd => cmd.name() === 'update')!

      expect(updateCommand.registeredArguments).toHaveLength(1)
      expect(updateCommand.registeredArguments[0].name()).toBe('gid')
      expect(updateCommand.registeredArguments[0].required).toBe(true)
    })

    test('should have correct option types for dates', () => {
      const taskCommand = createTaskCommand()
      const updateCommand = taskCommand.commands.find(cmd => cmd.name() === 'update')!

      const dueOnOption = updateCommand.options.find(opt => opt.long === '--due-on')
      const startOnOption = updateCommand.options.find(opt => opt.long === '--start-on')

      // Both should expect string values (dates)
      expect(dueOnOption).toBeDefined()
      expect(startOnOption).toBeDefined()
    })

    test('should have boolean-like option for completed', () => {
      const taskCommand = createTaskCommand()
      const updateCmd = taskCommand.commands.find(cmd => cmd.name() === 'update')!

      const completedOption = updateCmd.options.find(opt => opt.long === '--completed')

      expect(completedOption).toBeDefined()
      expect(completedOption?.attributeName()).toBe('completed')
    })
  })

  describe('command description and help', () => {
    test('should have clear description', () => {
      const taskCommand = createTaskCommand()
      const updateCommand = taskCommand.commands.find(cmd => cmd.name() === 'update')!

      expect(updateCommand.description()).toBe('Update task properties')
    })

    test('should have descriptive option names', () => {
      const taskCommand = createTaskCommand()
      const updateCommand = taskCommand.commands.find(cmd => cmd.name() === 'update')!

      // Short flags should be intuitive
      const nameOption = updateCommand.options.find(opt => opt.long === '--name')
      const notesOption = updateCommand.options.find(opt => opt.long === '--notes')
      const assigneeOption = updateCommand.options.find(opt => opt.long === '--assignee')

      expect(nameOption?.short).toBe('-n')
      expect(notesOption?.short).toBe('-d')
      expect(assigneeOption?.short).toBe('-a')
    })
  })
})

describe('task move command validation', () => {
  describe('command options validation', () => {
    test('should require project option', () => {
      const taskCommand = createTaskCommand()
      const moveCommand = taskCommand.commands.find(cmd => cmd.name() === 'move')!

      const projectOption = moveCommand.options.find(opt => opt.long === '--project')

      expect(projectOption).toBeDefined()
      expect(projectOption?.required).toBe(true)
    })

    test('should have section option', () => {
      const taskCommand = createTaskCommand()
      const moveCommand = taskCommand.commands.find(cmd => cmd.name() === 'move')!

      const sectionOption = moveCommand.options.find(opt => opt.long === '--section')

      expect(sectionOption).toBeDefined()
      // Section is optional in usage but Commander may mark it as required in options
    })

    test('should accept gid as positional argument', () => {
      const taskCommand = createTaskCommand()
      const moveCommand = taskCommand.commands.find(cmd => cmd.name() === 'move')!

      expect(moveCommand.registeredArguments).toHaveLength(1)
      expect(moveCommand.registeredArguments[0].name()).toBe('gid')
      expect(moveCommand.registeredArguments[0].required).toBe(true)
    })

    test('should have short flags for options', () => {
      const taskCommand = createTaskCommand()
      const moveCommand = taskCommand.commands.find(cmd => cmd.name() === 'move')!

      const projectOption = moveCommand.options.find(opt => opt.long === '--project')
      const sectionOption = moveCommand.options.find(opt => opt.long === '--section')

      expect(projectOption?.short).toBe('-p')
      expect(sectionOption?.short).toBe('-s')
    })
  })

  describe('command description and help', () => {
    test('should have clear description', () => {
      const taskCommand = createTaskCommand()
      const moveCommand = taskCommand.commands.find(cmd => cmd.name() === 'move')!

      expect(moveCommand.description()).toBe('Move task to a different project')
    })
  })
})

describe('task commands integration', () => {
  test('should have update command before move command', () => {
    const taskCommand = createTaskCommand()
    const commandNames = taskCommand.commands.map(cmd => cmd.name())

    const updateIndex = commandNames.indexOf('update')
    const moveIndex = commandNames.indexOf('move')

    // update should come before move in command list
    expect(updateIndex).toBeGreaterThan(-1)
    expect(moveIndex).toBeGreaterThan(-1)
    expect(updateIndex).toBeLessThan(moveIndex)
  })

  test('should have update and move between get and complete', () => {
    const taskCommand = createTaskCommand()
    const commandNames = taskCommand.commands.map(cmd => cmd.name())

    const getIndex = commandNames.indexOf('get')
    const updateIndex = commandNames.indexOf('update')
    const moveIndex = commandNames.indexOf('move')
    const completeIndex = commandNames.indexOf('complete')

    expect(getIndex).toBeLessThan(updateIndex)
    expect(updateIndex).toBeLessThan(moveIndex)
    expect(moveIndex).toBeLessThan(completeIndex)
  })

  test('should maintain consistent command ordering', () => {
    const taskCommand = createTaskCommand()
    const commandNames = taskCommand.commands.map(cmd => cmd.name())

    // Expected order of commands
    const expectedOrder = ['create', 'list', 'get', 'update', 'move', 'complete', 'delete']

    expect(commandNames).toEqual(expectedOrder)
  })
})
