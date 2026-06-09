import { describe, expect, test } from 'bun:test'
import { createTaskCommand } from '../../src/commands/task'
import { createDependencyCommand, createDependentCommand } from '../../src/commands/task-dependency'

describe('dependency command', () => {
  describe('command structure', () => {
    test('is registered under the task command', () => {
      const dependency = createTaskCommand().commands.find(cmd => cmd.name() === 'dependency')

      expect(dependency).toBeDefined()
    })

    test('has add, remove, and list subcommands', () => {
      const names = createDependencyCommand().commands.map(cmd => cmd.name())

      expect(names).toContain('add')
      expect(names).toContain('remove')
      expect(names).toContain('list')
    })
  })

  describe('add subcommand', () => {
    test('accepts task-gid and depends-on-gid arguments', () => {
      const add = createDependencyCommand().commands.find(cmd => cmd.name() === 'add')!

      expect(add.registeredArguments).toHaveLength(2)
      expect(add.registeredArguments[0].name()).toBe('task-gid')
      expect(add.registeredArguments[1].name()).toBe('depends-on-gid')
      expect(add.registeredArguments[0].required).toBe(true)
      expect(add.registeredArguments[1].required).toBe(true)
    })
  })

  describe('remove subcommand', () => {
    test('accepts task-gid and depends-on-gid arguments', () => {
      const remove = createDependencyCommand().commands.find(cmd => cmd.name() === 'remove')!

      expect(remove.registeredArguments).toHaveLength(2)
      expect(remove.registeredArguments[0].name()).toBe('task-gid')
      expect(remove.registeredArguments[1].name()).toBe('depends-on-gid')
    })
  })

  describe('list subcommand', () => {
    test('accepts a single task-gid argument', () => {
      const list = createDependencyCommand().commands.find(cmd => cmd.name() === 'list')!

      expect(list.registeredArguments).toHaveLength(1)
      expect(list.registeredArguments[0].name()).toBe('task-gid')
    })
  })
})

describe('dependent command', () => {
  test('is registered under the task command', () => {
    const dependent = createTaskCommand().commands.find(cmd => cmd.name() === 'dependent')

    expect(dependent).toBeDefined()
  })

  test('has a list subcommand accepting a task-gid argument', () => {
    const list = createDependentCommand().commands.find(cmd => cmd.name() === 'list')!

    expect(list).toBeDefined()
    expect(list.registeredArguments).toHaveLength(1)
    expect(list.registeredArguments[0].name()).toBe('task-gid')
  })
})
