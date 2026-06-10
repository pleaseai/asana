import { describe, expect, test } from 'bun:test'
import { createCustomFieldCommand, createTaskCustomFieldCommand } from '../../src/commands/custom-field'
import { createTaskCommand } from '../../src/commands/task'

describe('custom-field commands', () => {
  describe('task custom-field command', () => {
    test('is registered under the task command', () => {
      const names = createTaskCommand().commands.map(cmd => cmd.name())

      expect(names).toContain('custom-field')
    })

    test('has set and list subcommands', () => {
      const names = createTaskCustomFieldCommand().commands.map(cmd => cmd.name())

      expect(names).toContain('set')
      expect(names).toContain('list')
    })

    test('set accepts task-gid, field-gid, and value arguments', () => {
      const set = createTaskCustomFieldCommand().commands.find(cmd => cmd.name() === 'set')!

      expect(set.registeredArguments).toHaveLength(3)
      expect(set.registeredArguments[0].name()).toBe('task-gid')
      expect(set.registeredArguments[1].name()).toBe('field-gid')
      expect(set.registeredArguments[2].name()).toBe('value')
    })

    test('list accepts a task-gid argument', () => {
      const list = createTaskCustomFieldCommand().commands.find(cmd => cmd.name() === 'list')!

      expect(list.registeredArguments).toHaveLength(1)
      expect(list.registeredArguments[0].name()).toBe('task-gid')
    })
  })

  describe('workspace custom-field command', () => {
    test('has a list subcommand with a workspace option', () => {
      const list = createCustomFieldCommand().commands.find(cmd => cmd.name() === 'list')!
      const options = list.options.map(opt => opt.long)

      expect(options).toContain('--workspace')
    })
  })
})
