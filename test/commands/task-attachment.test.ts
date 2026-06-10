import { describe, expect, test } from 'bun:test'
import { createTaskCommand } from '../../src/commands/task'
import { createAttachCommand, createAttachmentCommand, safeDefaultFileName } from '../../src/commands/task-attachment'

describe('attachment commands', () => {
  describe('command structure', () => {
    test('attach and attachment are registered under the task command', () => {
      const names = createTaskCommand().commands.map(cmd => cmd.name())

      expect(names).toContain('attach')
      expect(names).toContain('attachment')
    })

    test('attachment has list and download subcommands', () => {
      const names = createAttachmentCommand().commands.map(cmd => cmd.name())

      expect(names).toContain('list')
      expect(names).toContain('download')
    })
  })

  describe('attach subcommand', () => {
    test('accepts task-gid and file arguments', () => {
      const attach = createAttachCommand()

      expect(attach.registeredArguments).toHaveLength(2)
      expect(attach.registeredArguments[0].name()).toBe('task-gid')
      expect(attach.registeredArguments[1].name()).toBe('file')
      expect(attach.registeredArguments.every(arg => arg.required)).toBe(true)
    })
  })

  describe('list subcommand', () => {
    test('accepts a task-gid argument', () => {
      const list = createAttachmentCommand().commands.find(cmd => cmd.name() === 'list')!

      expect(list.registeredArguments).toHaveLength(1)
      expect(list.registeredArguments[0].name()).toBe('task-gid')
    })
  })

  describe('download subcommand', () => {
    test('accepts an attachment-gid argument', () => {
      const download = createAttachmentCommand().commands.find(cmd => cmd.name() === 'download')!

      expect(download.registeredArguments).toHaveLength(1)
      expect(download.registeredArguments[0].name()).toBe('attachment-gid')
    })

    test('has output and force options', () => {
      const download = createAttachmentCommand().commands.find(cmd => cmd.name() === 'download')!
      const options = download.options.map(opt => opt.long)

      expect(options).toContain('--output')
      expect(options).toContain('--force')
    })
  })

  describe('safeDefaultFileName', () => {
    test('keeps plain file names unchanged', () => {
      expect(safeDefaultFileName('report.pdf', '123')).toBe('report.pdf')
    })

    test('strips path traversal segments from API-provided names', () => {
      expect(safeDefaultFileName('../../.ssh/authorized_keys', '123')).toBe('authorized_keys')
      expect(safeDefaultFileName('/etc/passwd', '123')).toBe('passwd')
      expect(safeDefaultFileName('..\\..\\evil.exe', '123')).toBe('evil.exe')
    })

    test('falls back to a GID-based name for empty or dot-only names', () => {
      expect(safeDefaultFileName(undefined, '123')).toBe('attachment-123')
      expect(safeDefaultFileName('..', '123')).toBe('attachment-123')
      expect(safeDefaultFileName('  ', '123')).toBe('attachment-123')
    })
  })
})
