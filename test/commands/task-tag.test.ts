import { describe, expect, test } from 'bun:test'
import { createTaskCommand } from '../../src/commands/task'
import { createTaskTagCommand } from '../../src/commands/task-tag'

describe('task tag command', () => {
  describe('command structure', () => {
    test('is registered under the task command', () => {
      const tag = createTaskCommand().commands.find(cmd => cmd.name() === 'tag')

      expect(tag).toBeDefined()
    })

    test('has add, remove, and list subcommands', () => {
      const names = createTaskTagCommand().commands.map(cmd => cmd.name())

      expect(names).toContain('add')
      expect(names).toContain('remove')
      expect(names).toContain('list')
    })
  })

  describe('add subcommand', () => {
    test('accepts task-gid and tag-gid arguments', () => {
      const add = createTaskTagCommand().commands.find(cmd => cmd.name() === 'add')!

      expect(add.registeredArguments).toHaveLength(2)
      expect(add.registeredArguments[0].name()).toBe('task-gid')
      expect(add.registeredArguments[1].name()).toBe('tag-gid')
      expect(add.registeredArguments[0].required).toBe(true)
      expect(add.registeredArguments[1].required).toBe(true)
    })
  })

  describe('remove subcommand', () => {
    test('accepts task-gid and tag-gid arguments', () => {
      const remove = createTaskTagCommand().commands.find(cmd => cmd.name() === 'remove')!

      expect(remove.registeredArguments).toHaveLength(2)
      expect(remove.registeredArguments[0].name()).toBe('task-gid')
      expect(remove.registeredArguments[1].name()).toBe('tag-gid')
    })
  })

  describe('list subcommand', () => {
    test('accepts a single task-gid argument', () => {
      const list = createTaskTagCommand().commands.find(cmd => cmd.name() === 'list')!

      expect(list.registeredArguments).toHaveLength(1)
      expect(list.registeredArguments[0].name()).toBe('task-gid')
    })
  })
})
