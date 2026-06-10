import { describe, expect, test } from 'bun:test'
import { createTaskCommand } from '../../src/commands/task'
import { createFollowerCommand } from '../../src/commands/task-follower'

describe('follower command', () => {
  describe('command structure', () => {
    test('is registered under the task command', () => {
      const follower = createTaskCommand().commands.find(cmd => cmd.name() === 'follower')

      expect(follower).toBeDefined()
    })

    test('has add, remove, and list subcommands', () => {
      const names = createFollowerCommand().commands.map(cmd => cmd.name())

      expect(names).toContain('add')
      expect(names).toContain('remove')
      expect(names).toContain('list')
    })
  })

  describe('add subcommand', () => {
    test('accepts task-gid and user-gid arguments', () => {
      const add = createFollowerCommand().commands.find(cmd => cmd.name() === 'add')!

      expect(add.registeredArguments).toHaveLength(2)
      expect(add.registeredArguments[0].name()).toBe('task-gid')
      expect(add.registeredArguments[1].name()).toBe('user-gid')
      expect(add.registeredArguments[0].required).toBe(true)
      expect(add.registeredArguments[1].required).toBe(true)
    })
  })

  describe('remove subcommand', () => {
    test('accepts task-gid and user-gid arguments', () => {
      const remove = createFollowerCommand().commands.find(cmd => cmd.name() === 'remove')!

      expect(remove.registeredArguments).toHaveLength(2)
      expect(remove.registeredArguments[0].name()).toBe('task-gid')
      expect(remove.registeredArguments[1].name()).toBe('user-gid')
    })
  })

  describe('list subcommand', () => {
    test('accepts a single task-gid argument', () => {
      const list = createFollowerCommand().commands.find(cmd => cmd.name() === 'list')!

      expect(list.registeredArguments).toHaveLength(1)
      expect(list.registeredArguments[0].name()).toBe('task-gid')
    })
  })
})
