import { describe, expect, test } from 'bun:test'
import { createTaskCommand } from '../../src/commands/task'
import {
  createBatchCreateCommand,
  createBatchDeleteCommand,
  createBatchUpdateCommand,
} from '../../src/commands/task-batch'

describe('batch commands', () => {
  describe('command structure', () => {
    test('batch commands are registered under the task command', () => {
      const names = createTaskCommand().commands.map(cmd => cmd.name())

      expect(names).toContain('batch-update')
      expect(names).toContain('batch-create')
      expect(names).toContain('batch-delete')
    })
  })

  describe('batch-update', () => {
    test('requires a file option', () => {
      const fileOption = createBatchUpdateCommand().options.find(opt => opt.long === '--file')

      expect(fileOption).toBeDefined()
      expect(fileOption?.mandatory).toBe(true)
    })
  })

  describe('batch-create', () => {
    test('requires a file option and accepts a workspace option', () => {
      const command = createBatchCreateCommand()
      const fileOption = command.options.find(opt => opt.long === '--file')
      const options = command.options.map(opt => opt.long)

      expect(fileOption?.mandatory).toBe(true)
      expect(options).toContain('--workspace')
    })
  })

  describe('batch-delete', () => {
    test('requires a file option and supports --yes for non-interactive use', () => {
      const command = createBatchDeleteCommand()
      const fileOption = command.options.find(opt => opt.long === '--file')
      const options = command.options.map(opt => opt.long)

      expect(fileOption?.mandatory).toBe(true)
      expect(options).toContain('--yes')
    })
  })
})
