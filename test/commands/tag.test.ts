import { describe, expect, test } from 'bun:test'
import { createTagCommand } from '../../src/commands/tag'

describe('tag command', () => {
  describe('command structure', () => {
    test('has list, create, get, update, and delete subcommands', () => {
      const names = createTagCommand().commands.map(cmd => cmd.name())

      expect(names).toContain('list')
      expect(names).toContain('create')
      expect(names).toContain('get')
      expect(names).toContain('update')
      expect(names).toContain('delete')
    })
  })

  describe('list subcommand', () => {
    test('accepts a --workspace option', () => {
      const list = createTagCommand().commands.find(cmd => cmd.name() === 'list')!
      const workspaceOption = list.options.find(opt => opt.long === '--workspace')

      expect(workspaceOption).toBeDefined()
    })
  })

  describe('create subcommand', () => {
    test('requires a --name option', () => {
      const create = createTagCommand().commands.find(cmd => cmd.name() === 'create')!
      const nameOption = create.options.find(opt => opt.long === '--name')

      expect(nameOption).toBeDefined()
      expect(nameOption?.required).toBe(true)
    })

    test('accepts --workspace, --color, and --notes options', () => {
      const create = createTagCommand().commands.find(cmd => cmd.name() === 'create')!
      const longs = create.options.map(opt => opt.long)

      expect(longs).toContain('--workspace')
      expect(longs).toContain('--color')
      expect(longs).toContain('--notes')
    })
  })

  describe('get subcommand', () => {
    test('accepts a single tag-gid argument', () => {
      const get = createTagCommand().commands.find(cmd => cmd.name() === 'get')!

      expect(get.registeredArguments).toHaveLength(1)
      expect(get.registeredArguments[0].name()).toBe('tag-gid')
    })
  })

  describe('update subcommand', () => {
    test('accepts a tag-gid argument with --name, --color, and --notes options', () => {
      const update = createTagCommand().commands.find(cmd => cmd.name() === 'update')!
      const longs = update.options.map(opt => opt.long)

      expect(update.registeredArguments).toHaveLength(1)
      expect(update.registeredArguments[0].name()).toBe('tag-gid')
      expect(longs).toContain('--name')
      expect(longs).toContain('--color')
      expect(longs).toContain('--notes')
    })
  })

  describe('delete subcommand', () => {
    test('accepts a single tag-gid argument', () => {
      const del = createTagCommand().commands.find(cmd => cmd.name() === 'delete')!

      expect(del.registeredArguments).toHaveLength(1)
      expect(del.registeredArguments[0].name()).toBe('tag-gid')
    })
  })
})
