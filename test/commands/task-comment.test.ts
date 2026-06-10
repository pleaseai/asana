import { describe, expect, test } from 'bun:test'
import { createTaskCommand } from '../../src/commands/task'
import { createCommentCommand } from '../../src/commands/task-comment'

describe('comment command', () => {
  describe('command structure', () => {
    test('is registered under the task command', () => {
      const comment = createTaskCommand().commands.find(cmd => cmd.name() === 'comment')

      expect(comment).toBeDefined()
    })

    test('has add and list subcommands', () => {
      const names = createCommentCommand().commands.map(cmd => cmd.name())

      expect(names).toContain('add')
      expect(names).toContain('list')
    })
  })

  describe('add subcommand', () => {
    test('accepts task-gid and text arguments', () => {
      const add = createCommentCommand().commands.find(cmd => cmd.name() === 'add')!

      expect(add.registeredArguments).toHaveLength(2)
      expect(add.registeredArguments[0].name()).toBe('task-gid')
      expect(add.registeredArguments[1].name()).toBe('text')
      expect(add.registeredArguments[0].required).toBe(true)
      expect(add.registeredArguments[1].required).toBe(true)
    })

    test('supports an --html flag for rich text comments', () => {
      const add = createCommentCommand().commands.find(cmd => cmd.name() === 'add')!
      const htmlOption = add.options.find(opt => opt.long === '--html')

      expect(htmlOption).toBeDefined()
      expect(htmlOption?.required).toBe(false)
    })
  })

  describe('list subcommand', () => {
    test('accepts a single task-gid argument', () => {
      const list = createCommentCommand().commands.find(cmd => cmd.name() === 'list')!

      expect(list.registeredArguments).toHaveLength(1)
      expect(list.registeredArguments[0].name()).toBe('task-gid')
    })
  })
})
