import { describe, expect, test } from 'bun:test'
import { formatOutput, type OutputFormat } from '../../src/utils/formatter'

describe('formatOutput', () => {
  describe('TOON format', () => {
    test('should format simple object as TOON', () => {
      const data = { name: 'John', age: 30 }
      const result = formatOutput(data, { format: 'toon' })

      expect(result).toContain('name')
      expect(result).toContain('John')
      expect(result).toContain('age')
      expect(result).toContain('30')
    })

    test('should use tab delimiter for maximum token efficiency', () => {
      const data = {
        tasks: [
          { gid: '123', name: 'Task 1' },
          { gid: '456', name: 'Task 2' },
        ],
      }
      const result = formatOutput(data, { format: 'toon' })

      // cli-toolkit uses tab delimiter (not comma) for 58.9% token savings
      expect(result).toContain('\t')
      // Should have tabular structure with field names separated by tabs
      expect(result).toMatch(/\{[^\}]*\t[^\}]*\}/)
    })

    test('should format array of objects as TOON with tabular structure', () => {
      const data = {
        tasks: [
          { gid: '123', name: 'Task 1', completed: true },
          { gid: '456', name: 'Task 2', completed: false },
        ],
      }
      const result = formatOutput(data, { format: 'toon' })

      // TOON should show array length marker with tab delimiter
      expect(result).toMatch(/\[2\t?\]/)
      // Should contain field names
      expect(result).toContain('gid')
      expect(result).toContain('name')
      expect(result).toContain('completed')
      // Should contain values
      expect(result).toContain('123')
      expect(result).toContain('Task 1')
    })

    test('should format empty array as TOON', () => {
      const data = { tasks: [] }
      const result = formatOutput(data, { format: 'toon' })

      // Empty array with tab delimiter
      expect(result).toMatch(/\[0\t?\]/)
    })

    test('should format nested objects as TOON', () => {
      const data = {
        user: {
          name: 'John',
          profile: {
            email: 'john@example.com',
          },
        },
      }
      const result = formatOutput(data, { format: 'toon' })

      expect(result).toContain('user')
      expect(result).toContain('John')
      expect(result).toContain('email')
      expect(result).toContain('john@example.com')
    })
  })

  describe('JSON format', () => {
    test('should format simple object as JSON', () => {
      const data = { name: 'John', age: 30 }
      const result = formatOutput(data, { format: 'json' })

      expect(result).toBe(JSON.stringify(data, null, 2))
    })

    test('should format array as JSON', () => {
      const data = {
        tasks: [
          { gid: '123', name: 'Task 1' },
          { gid: '456', name: 'Task 2' },
        ],
      }
      const result = formatOutput(data, { format: 'json' })

      expect(result).toBe(JSON.stringify(data, null, 2))
      expect(JSON.parse(result)).toEqual(data)
    })

    test('should format null values as JSON', () => {
      const data = { name: 'John', assignee: null }
      const result = formatOutput(data, { format: 'json' })

      expect(result).toContain('null')
      expect(JSON.parse(result)).toEqual(data)
    })

    test('should format nested objects as JSON', () => {
      const data = {
        user: {
          name: 'John',
          profile: {
            email: 'john@example.com',
          },
        },
      }
      const result = formatOutput(data, { format: 'json' })

      expect(JSON.parse(result)).toEqual(data)
    })
  })

  describe('Plain format', () => {
    test('should format simple object as plain text', () => {
      const data = { name: 'John', age: 30 }
      const result = formatOutput(data, { format: 'plain', colors: false })

      expect(result).toContain('name:')
      expect(result).toContain('John')
      expect(result).toContain('age:')
      expect(result).toContain('30')
    })

    test('should format boolean values in plain text', () => {
      const data = { completed: true, active: false }
      const result = formatOutput(data, { format: 'plain', colors: false })

      expect(result).toContain('completed:')
      expect(result).toContain('true')
      expect(result).toContain('active:')
      expect(result).toContain('false')
    })

    test('should format array of objects as plain text', () => {
      const data = [
        { gid: '123', name: 'Task 1' },
        { gid: '456', name: 'Task 2' },
      ]
      const result = formatOutput(data, { format: 'plain', colors: false })

      expect(result).toContain('123')
      expect(result).toContain('Task 1')
      expect(result).toContain('456')
      expect(result).toContain('Task 2')
    })

    test('should format nested objects as plain text', () => {
      const data = {
        user: {
          name: 'John',
          email: 'john@example.com',
        },
      }
      const result = formatOutput(data, { format: 'plain', colors: false })

      expect(result).toContain('user:')
      expect(result).toContain('name:')
      expect(result).toContain('John')
      expect(result).toContain('email:')
      expect(result).toContain('john@example.com')
    })

    test('should not throw error with colors enabled in plain format', () => {
      const data = { name: 'John', completed: true }

      // Just verify it doesn't throw an error
      expect(() => {
        formatOutput(data, { format: 'plain', colors: true })
      }).not.toThrow()

      // Verify basic content is present
      const result = formatOutput(data, { format: 'plain', colors: true })
      expect(result).toContain('name')
      expect(result).toContain('John')
      expect(result).toContain('completed')
    })
  })

  describe('Edge cases', () => {
    test('should handle empty object', () => {
      const data = {}

      const toonResult = formatOutput(data, { format: 'toon' })
      expect(toonResult).toBeDefined()

      const jsonResult = formatOutput(data, { format: 'json' })
      expect(jsonResult).toBe('{}')

      const plainResult = formatOutput(data, { format: 'plain' })
      expect(plainResult).toBeDefined()
    })

    test('should handle null values', () => {
      const data = { name: 'John', assignee: null }

      const toonResult = formatOutput(data, { format: 'toon' })
      expect(toonResult).toBeDefined()

      const jsonResult = formatOutput(data, { format: 'json' })
      expect(jsonResult).toContain('null')

      const plainResult = formatOutput(data, { format: 'plain' })
      expect(plainResult).toBeDefined()
    })

    test('should handle undefined values', () => {
      const data = { name: 'John', assignee: undefined }

      const jsonResult = formatOutput(data, { format: 'json' })
      // JSON.stringify removes undefined values
      expect(JSON.parse(jsonResult)).toEqual({ name: 'John' })
    })

    test('should throw error for unsupported format', () => {
      const data = { name: 'John' }

      expect(() => {
        formatOutput(data, { format: 'invalid' as OutputFormat })
      }).toThrow('Unsupported format')
    })
  })

  describe('Token efficiency comparison', () => {
    test('TOON should use fewer characters than JSON for arrays', () => {
      const data = {
        tasks: [
          { gid: '1234567890', name: 'Setup authentication', completed: true },
          { gid: '1234567891', name: 'Add task commands', completed: false },
          { gid: '1234567892', name: 'Write documentation', completed: false },
        ],
      }

      const toonResult = formatOutput(data, { format: 'toon' })
      const jsonResult = formatOutput(data, { format: 'json' })

      // TOON should be more compact (30-60% reduction)
      expect(toonResult.length).toBeLessThan(jsonResult.length)

      // Calculate approximate token reduction
      const reduction = ((jsonResult.length - toonResult.length) / jsonResult.length) * 100
      expect(reduction).toBeGreaterThan(20) // At least 20% reduction
    })
  })
})
