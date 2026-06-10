import { describe, expect, test } from 'bun:test'
import { createSearchCommand } from '../../src/commands/search'

describe('search command', () => {
  describe('command structure', () => {
    test('has tasks and projects subcommands', () => {
      const names = createSearchCommand().commands.map(cmd => cmd.name())

      expect(names).toContain('tasks')
      expect(names).toContain('projects')
    })
  })

  describe('tasks subcommand', () => {
    test('accepts a query argument', () => {
      const tasks = createSearchCommand().commands.find(cmd => cmd.name() === 'tasks')!

      expect(tasks.registeredArguments).toHaveLength(1)
      expect(tasks.registeredArguments[0].name()).toBe('query')
      expect(tasks.registeredArguments[0].required).toBe(true)
    })

    test('has workspace, limit, completed, and assignee options', () => {
      const tasks = createSearchCommand().commands.find(cmd => cmd.name() === 'tasks')!
      const options = tasks.options.map(opt => opt.long)

      expect(options).toContain('--workspace')
      expect(options).toContain('--limit')
      expect(options).toContain('--completed')
      expect(options).toContain('--assignee')
    })

    test('defaults limit to 20', () => {
      const tasks = createSearchCommand().commands.find(cmd => cmd.name() === 'tasks')!
      const limitOption = tasks.options.find(opt => opt.long === '--limit')

      expect(limitOption?.defaultValue).toBe('20')
    })
  })

  describe('projects subcommand', () => {
    test('accepts a query argument with workspace and limit options', () => {
      const projects = createSearchCommand().commands.find(cmd => cmd.name() === 'projects')!
      const options = projects.options.map(opt => opt.long)

      expect(projects.registeredArguments[0].name()).toBe('query')
      expect(options).toContain('--workspace')
      expect(options).toContain('--limit')
    })
  })
})
