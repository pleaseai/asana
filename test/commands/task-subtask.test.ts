import { describe, expect, test } from 'bun:test'
import { createTaskCommand } from '../../src/commands/task'
import { createSubtaskCommand } from '../../src/commands/task-subtask'

function getSubtaskCommand() {
  return createTaskCommand().commands.find(cmd => cmd.name() === 'subtask')!
}

describe('subtask command', () => {
  describe('command structure', () => {
    test('is registered under the task command', () => {
      const subtask = getSubtaskCommand()

      expect(subtask).toBeDefined()
      expect(subtask.name()).toBe('subtask')
    })

    test('has list, create, and add subcommands', () => {
      const subtask = createSubtaskCommand()
      const names = subtask.commands.map(cmd => cmd.name())

      expect(names).toContain('list')
      expect(names).toContain('create')
      expect(names).toContain('add')
    })

    test('has a descriptive description', () => {
      const subtask = createSubtaskCommand()

      expect(subtask.description()).toBe('Manage task subtasks')
    })
  })

  describe('list subcommand', () => {
    test('accepts a parent-gid argument', () => {
      const list = createSubtaskCommand().commands.find(cmd => cmd.name() === 'list')!

      expect(list.registeredArguments).toHaveLength(1)
      expect(list.registeredArguments[0].name()).toBe('parent-gid')
      expect(list.registeredArguments[0].required).toBe(true)
    })

    test('has a recursive option', () => {
      const list = createSubtaskCommand().commands.find(cmd => cmd.name() === 'list')!
      const options = list.options.map(opt => opt.long)

      expect(options).toContain('--recursive')
    })
  })

  describe('create subcommand', () => {
    test('accepts a parent-gid argument', () => {
      const create = createSubtaskCommand().commands.find(cmd => cmd.name() === 'create')!

      expect(create.registeredArguments[0].name()).toBe('parent-gid')
    })

    test('requires a name option', () => {
      const create = createSubtaskCommand().commands.find(cmd => cmd.name() === 'create')!
      const nameOption = create.options.find(opt => opt.long === '--name')

      expect(nameOption).toBeDefined()
      expect(nameOption?.required).toBe(true)
    })

    test('has notes, assignee, and due-on options', () => {
      const create = createSubtaskCommand().commands.find(cmd => cmd.name() === 'create')!
      const options = create.options.map(opt => opt.long)

      expect(options).toContain('--notes')
      expect(options).toContain('--assignee')
      expect(options).toContain('--due-on')
    })
  })

  describe('add subcommand', () => {
    test('accepts task-gid and parent-gid arguments', () => {
      const add = createSubtaskCommand().commands.find(cmd => cmd.name() === 'add')!

      expect(add.registeredArguments).toHaveLength(2)
      expect(add.registeredArguments[0].name()).toBe('task-gid')
      expect(add.registeredArguments[1].name()).toBe('parent-gid')
    })
  })
})
