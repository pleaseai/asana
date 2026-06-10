import { describe, expect, test } from 'bun:test'
import { fuzzyScore, searchUsers } from '../../src/utils/fuzzy'

describe('fuzzyScore', () => {
  test('should give highest score to exact match', () => {
    expect(fuzzyScore('john', 'john')).toBeGreaterThan(fuzzyScore('john', 'johnny'))
  })

  test('should score substring match higher than subsequence match', () => {
    const substring = fuzzyScore('ohn', 'john doe')
    const subsequence = fuzzyScore('jde', 'john doe')

    expect(substring).toBeGreaterThan(subsequence)
  })

  test('should match case-insensitively', () => {
    expect(fuzzyScore('JOHN', 'john@example.com')).toBeGreaterThan(0)
  })

  test('should return 0 when characters are not a subsequence', () => {
    expect(fuzzyScore('xyz', 'john doe')).toBe(0)
  })

  test('should return 0 for empty query', () => {
    expect(fuzzyScore('', 'john')).toBe(0)
  })
})

describe('searchUsers', () => {
  const users = [
    { gid: '1', name: 'John Doe', email: 'john@example.com' },
    { gid: '2', name: 'Jane Smith', email: 'jane@example.com' },
    { gid: '3', name: 'Bob Johnson', email: 'bob@example.com' },
  ]

  test('should find user by exact email', () => {
    const results = searchUsers(users, 'john@example.com')

    expect(results[0]?.gid).toBe('1')
  })

  test('should find users by partial name', () => {
    const results = searchUsers(users, 'john')
    const gids = results.map(user => user.gid)

    expect(gids).toContain('1')
    expect(gids).toContain('3')
  })

  test('should rank exact name match above partial match', () => {
    const results = searchUsers(users, 'john doe')

    expect(results[0]?.gid).toBe('1')
  })

  test('should return empty array when nothing matches', () => {
    expect(searchUsers(users, 'zzzzz')).toEqual([])
  })

  test('should handle users without email', () => {
    const noEmail = [{ gid: '9', name: 'Solo Name' }]

    expect(searchUsers(noEmail, 'solo')[0]?.gid).toBe('9')
  })
})
