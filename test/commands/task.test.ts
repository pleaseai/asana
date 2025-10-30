import { describe, expect, test } from 'bun:test'
import { createTaskCommand } from '../../src/commands/task'

describe('task command', () => {
  describe('command structure', () => {
    test('creates command with correct name', () => {
      const taskCommand = createTaskCommand()

      expect(taskCommand.name()).toBe('task')
    })

    test('creates command with correct description', () => {
      const taskCommand = createTaskCommand()

      expect(taskCommand.description()).toBe('Manage Asana tasks')
    })

    test('has all required subcommands', () => {
      const taskCommand = createTaskCommand()
      const commandNames = taskCommand.commands.map(cmd => cmd.name())

      expect(commandNames).toContain('create')
      expect(commandNames).toContain('list')
      expect(commandNames).toContain('get')
      expect(commandNames).toContain('update')
      expect(commandNames).toContain('move')
      expect(commandNames).toContain('complete')
      expect(commandNames).toContain('delete')
    })
  })

  describe('create command', () => {
    test('has correct description', () => {
      const taskCommand = createTaskCommand()
      const createCommand = taskCommand.commands.find(cmd => cmd.name() === 'create')

      expect(createCommand?.description()).toBe('Create a new task')
    })

    test('has name option as required', () => {
      const taskCommand = createTaskCommand()
      const createCommand = taskCommand.commands.find(cmd => cmd.name() === 'create')
      const nameOption = createCommand?.options.find(opt => opt.long === '--name')

      expect(nameOption).toBeDefined()
      expect(nameOption?.required).toBe(true)
    })

    test('has optional notes option', () => {
      const taskCommand = createTaskCommand()
      const createCommand = taskCommand.commands.find(cmd => cmd.name() === 'create')
      const options = createCommand?.options.map(opt => opt.long)

      expect(options).toContain('--notes')
    })

    test('has optional assignee option', () => {
      const taskCommand = createTaskCommand()
      const createCommand = taskCommand.commands.find(cmd => cmd.name() === 'create')
      const options = createCommand?.options.map(opt => opt.long)

      expect(options).toContain('--assignee')
    })

    test('has optional due date option', () => {
      const taskCommand = createTaskCommand()
      const createCommand = taskCommand.commands.find(cmd => cmd.name() === 'create')
      const options = createCommand?.options.map(opt => opt.long)

      expect(options).toContain('--due')
    })

    test('has optional workspace option', () => {
      const taskCommand = createTaskCommand()
      const createCommand = taskCommand.commands.find(cmd => cmd.name() === 'create')
      const options = createCommand?.options.map(opt => opt.long)

      expect(options).toContain('--workspace')
    })

    test('has optional project option', () => {
      const taskCommand = createTaskCommand()
      const createCommand = taskCommand.commands.find(cmd => cmd.name() === 'create')
      const options = createCommand?.options.map(opt => opt.long)

      expect(options).toContain('--project')
    })
  })

  describe('list command', () => {
    test('has correct description', () => {
      const taskCommand = createTaskCommand()
      const listCommand = taskCommand.commands.find(cmd => cmd.name() === 'list')

      expect(listCommand?.description()).toBe('List tasks')
    })

    test('has assignee filter option', () => {
      const taskCommand = createTaskCommand()
      const listCommand = taskCommand.commands.find(cmd => cmd.name() === 'list')
      const options = listCommand?.options.map(opt => opt.long)

      expect(options).toContain('--assignee')
    })

    test('has workspace filter option', () => {
      const taskCommand = createTaskCommand()
      const listCommand = taskCommand.commands.find(cmd => cmd.name() === 'list')
      const options = listCommand?.options.map(opt => opt.long)

      expect(options).toContain('--workspace')
    })

    test('has project filter option', () => {
      const taskCommand = createTaskCommand()
      const listCommand = taskCommand.commands.find(cmd => cmd.name() === 'list')
      const options = listCommand?.options.map(opt => opt.long)

      expect(options).toContain('--project')
    })

    test('has completed filter option', () => {
      const taskCommand = createTaskCommand()
      const listCommand = taskCommand.commands.find(cmd => cmd.name() === 'list')
      const options = listCommand?.options.map(opt => opt.long)

      expect(options).toContain('--completed')
    })
  })

  describe('get command', () => {
    test('has correct description', () => {
      const taskCommand = createTaskCommand()
      const getCommand = taskCommand.commands.find(cmd => cmd.name() === 'get')

      expect(getCommand?.description()).toBe('Get task details')
    })

    test('accepts gid argument', () => {
      const taskCommand = createTaskCommand()
      const getCommand = taskCommand.commands.find(cmd => cmd.name() === 'get')

      expect(getCommand?.registeredArguments).toHaveLength(1)
      expect(getCommand?.registeredArguments[0].name()).toBe('gid')
    })
  })

  describe('update command', () => {
    test('has correct description', () => {
      const taskCommand = createTaskCommand()
      const updateCommand = taskCommand.commands.find(cmd => cmd.name() === 'update')

      expect(updateCommand?.description()).toBe('Update task properties')
    })

    test('accepts gid argument', () => {
      const taskCommand = createTaskCommand()
      const updateCommand = taskCommand.commands.find(cmd => cmd.name() === 'update')

      expect(updateCommand?.registeredArguments).toHaveLength(1)
      expect(updateCommand?.registeredArguments[0].name()).toBe('gid')
    })

    test('has optional name option', () => {
      const taskCommand = createTaskCommand()
      const updateCommand = taskCommand.commands.find(cmd => cmd.name() === 'update')
      const options = updateCommand?.options.map(opt => opt.long)

      expect(options).toContain('--name')
    })

    test('has optional notes option', () => {
      const taskCommand = createTaskCommand()
      const updateCommand = taskCommand.commands.find(cmd => cmd.name() === 'update')
      const options = updateCommand?.options.map(opt => opt.long)

      expect(options).toContain('--notes')
    })

    test('has optional assignee option', () => {
      const taskCommand = createTaskCommand()
      const updateCommand = taskCommand.commands.find(cmd => cmd.name() === 'update')
      const options = updateCommand?.options.map(opt => opt.long)

      expect(options).toContain('--assignee')
    })

    test('has optional due-on option', () => {
      const taskCommand = createTaskCommand()
      const updateCommand = taskCommand.commands.find(cmd => cmd.name() === 'update')
      const options = updateCommand?.options.map(opt => opt.long)

      expect(options).toContain('--due-on')
    })

    test('has optional start-on option', () => {
      const taskCommand = createTaskCommand()
      const updateCommand = taskCommand.commands.find(cmd => cmd.name() === 'update')
      const options = updateCommand?.options.map(opt => opt.long)

      expect(options).toContain('--start-on')
    })

    test('has optional completed option', () => {
      const taskCommand = createTaskCommand()
      const updateCommand = taskCommand.commands.find(cmd => cmd.name() === 'update')
      const options = updateCommand?.options.map(opt => opt.long)

      expect(options).toContain('--completed')
    })
  })

  describe('move command', () => {
    test('has correct description', () => {
      const taskCommand = createTaskCommand()
      const moveCommand = taskCommand.commands.find(cmd => cmd.name() === 'move')

      expect(moveCommand?.description()).toBe('Move task to a different project')
    })

    test('accepts gid argument', () => {
      const taskCommand = createTaskCommand()
      const moveCommand = taskCommand.commands.find(cmd => cmd.name() === 'move')

      expect(moveCommand?.registeredArguments).toHaveLength(1)
      expect(moveCommand?.registeredArguments[0].name()).toBe('gid')
    })

    test('has required project option', () => {
      const taskCommand = createTaskCommand()
      const moveCommand = taskCommand.commands.find(cmd => cmd.name() === 'move')
      const projectOption = moveCommand?.options.find(opt => opt.long === '--project')

      expect(projectOption).toBeDefined()
      expect(projectOption?.required).toBe(true)
    })

    test('has optional section option', () => {
      const taskCommand = createTaskCommand()
      const moveCommand = taskCommand.commands.find(cmd => cmd.name() === 'move')
      const options = moveCommand?.options.map(opt => opt.long)

      expect(options).toContain('--section')
    })
  })

  describe('complete command', () => {
    test('has correct description', () => {
      const taskCommand = createTaskCommand()
      const completeCommand = taskCommand.commands.find(cmd => cmd.name() === 'complete')

      expect(completeCommand?.description()).toBe('Mark a task as complete')
    })

    test('accepts gid argument', () => {
      const taskCommand = createTaskCommand()
      const completeCommand = taskCommand.commands.find(cmd => cmd.name() === 'complete')

      expect(completeCommand?.registeredArguments).toHaveLength(1)
      expect(completeCommand?.registeredArguments[0].name()).toBe('gid')
    })
  })

  describe('delete command', () => {
    test('has correct description', () => {
      const taskCommand = createTaskCommand()
      const deleteCommand = taskCommand.commands.find(cmd => cmd.name() === 'delete')

      expect(deleteCommand?.description()).toBe('Delete a task')
    })

    test('accepts gid argument', () => {
      const taskCommand = createTaskCommand()
      const deleteCommand = taskCommand.commands.find(cmd => cmd.name() === 'delete')

      expect(deleteCommand?.registeredArguments).toHaveLength(1)
      expect(deleteCommand?.registeredArguments[0].name()).toBe('gid')
    })
  })
})
