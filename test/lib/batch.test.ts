import { describe, expect, test } from 'bun:test'
import {
  parseCsvRecords,
  parseGidLines,
  parseJsonRecords,
  runBatch,
} from '../../src/lib/batch'
import { ValidationError } from '../../src/lib/validators'

describe('batch parsing', () => {
  describe('parseJsonRecords', () => {
    test('parses a top-level array of objects', () => {
      const records = parseJsonRecords('[{"gid": "1", "name": "A"}, {"gid": "2"}]')

      expect(records).toHaveLength(2)
      expect(records[0]).toEqual({ gid: '1', name: 'A' })
    })

    test('parses an object with a tasks array', () => {
      const records = parseJsonRecords('{"tasks": [{"name": "A"}]}')

      expect(records).toEqual([{ name: 'A' }])
    })

    test('throws ValidationError on malformed JSON', () => {
      expect(() => parseJsonRecords('not json')).toThrow(ValidationError)
    })

    test('throws ValidationError when top level is not an array or {tasks}', () => {
      expect(() => parseJsonRecords('{"foo": 1}')).toThrow(ValidationError)
    })

    test('throws ValidationError when an entry is not an object', () => {
      expect(() => parseJsonRecords('[{"gid": "1"}, "oops"]')).toThrow(ValidationError)
    })
  })

  describe('parseCsvRecords', () => {
    test('parses rows into records keyed by header', () => {
      const records = parseCsvRecords('name,notes\nTask A,First\nTask B,Second\n')

      expect(records).toEqual([
        { name: 'Task A', notes: 'First' },
        { name: 'Task B', notes: 'Second' },
      ])
    })

    test('handles quoted values with commas and escaped quotes', () => {
      const records = parseCsvRecords('name,notes\n"Plan, review","He said ""go"""\n')

      expect(records).toEqual([
        { name: 'Plan, review', notes: 'He said "go"' },
      ])
    })

    test('omits empty cells from records', () => {
      const records = parseCsvRecords('name,notes,assignee\nTask A,,\n')

      expect(records).toEqual([{ name: 'Task A' }])
    })

    test('skips blank lines', () => {
      const records = parseCsvRecords('name\nTask A\n\nTask B\n')

      expect(records).toHaveLength(2)
    })

    test('throws ValidationError on empty file', () => {
      expect(() => parseCsvRecords('')).toThrow(ValidationError)
    })

    test('throws ValidationError when a row has more columns than the header', () => {
      expect(() => parseCsvRecords('name\nTask A,extra\n')).toThrow(ValidationError)
    })

    test('throws ValidationError on duplicate header names', () => {
      expect(() => parseCsvRecords('name,notes,name\nTask A,Note,Task B\n')).toThrow(ValidationError)
    })
  })

  describe('parseGidLines', () => {
    test('parses one GID per line, ignoring blanks and comments', () => {
      const gids = parseGidLines('# tasks to delete\n123\n\n456\n')

      expect(gids).toEqual(['123', '456'])
    })

    test('throws ValidationError on non-numeric lines', () => {
      expect(() => parseGidLines('123\nabc\n')).toThrow(ValidationError)
    })
  })
})

describe('runBatch', () => {
  test('runs all operations and reports success counts', async () => {
    const processed: string[] = []
    const result = await runBatch(
      ['1', '2', '3'],
      async (gid) => {
        processed.push(gid)
        return gid
      },
      { describe: gid => gid, onProgress: () => {} },
    )

    expect(result.total).toBe(3)
    expect(result.succeeded).toBe(3)
    expect(result.failed).toBe(0)
    expect(processed.sort()).toEqual(['1', '2', '3'])
  })

  test('collects failures without aborting the batch', async () => {
    const result = await runBatch(
      ['1', '2', '3'],
      async (gid) => {
        if (gid === '2') {
          throw new Error('boom')
        }
        return gid
      },
      { describe: gid => gid, onProgress: () => {} },
    )

    expect(result.succeeded).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.failures).toEqual([{ item: '2', error: 'boom' }])
  })

  test('extracts Asana API error messages from failures', async () => {
    const asanaError = Object.assign(new Error('wrapped'), {
      value: { errors: [{ message: 'task: Not a recognized ID' }] },
    })
    const result = await runBatch(
      ['1'],
      async () => {
        throw asanaError
      },
      { describe: gid => gid, onProgress: () => {} },
    )

    expect(result.failures[0].error).toBe('task: Not a recognized ID')
  })

  test('respects the concurrency limit', async () => {
    let inFlight = 0
    let maxInFlight = 0
    await runBatch(
      Array.from({ length: 10 }, (_, i) => String(i)),
      async () => {
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise(resolve => setTimeout(resolve, 5))
        inFlight--
      },
      { describe: gid => gid, concurrency: 2, onProgress: () => {} },
    )

    expect(maxInFlight).toBeLessThanOrEqual(2)
  })

  test('reports progress after each completed item', async () => {
    const ticks: Array<[number, number]> = []
    await runBatch(
      ['1', '2'],
      async gid => gid,
      { describe: gid => gid, onProgress: (done, total) => ticks.push([done, total]) },
    )

    expect(ticks).toEqual([[1, 2], [2, 2]])
  })

  test('handles an empty item list', async () => {
    const result = await runBatch(
      [] as string[],
      async gid => gid,
      { describe: gid => gid, onProgress: () => {} },
    )

    expect(result.total).toBe(0)
    expect(result.succeeded).toBe(0)
  })
})
