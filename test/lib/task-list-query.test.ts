import { describe, expect, test } from 'bun:test'
import {
  applyAssigneeFilter,
  applyCompletionFilter,
  buildOptFields,
  effectiveColumns,
  needsClientAssigneeFilter,
  parseTaskListQuery,
  summarizeTasks,
  toTaskRows,
} from '../../src/lib/task-list-query'
import { ValidationError } from '../../src/lib/validators'

const TASKS = [
  { gid: '1', name: 'A', completed: false, assignee: { gid: '10', name: 'Alice' }, due_on: '2026-07-01' },
  { gid: '2', name: 'B', completed: true, assignee: { gid: '10', name: 'Alice' }, due_on: null },
  { gid: '3', name: 'C', completed: false, assignee: null, due_on: null },
  { gid: '4', name: 'D', completed: false, assignee: { gid: '20', name: 'Bob' }, due_on: null },
]

describe('parseTaskListQuery', () => {
  test('parses comma-separated fields, trimming whitespace', () => {
    const query = parseTaskListQuery({ fields: ' completed, assignee ,due_on' })
    expect(query.fields).toEqual(['completed', 'assignee', 'due_on'])
  })

  test('rejects field names with unsafe characters', () => {
    expect(() => parseTaskListQuery({ fields: 'name,foo&bar' })).toThrow(ValidationError)
  })

  test('rejects --fields with no usable field names', () => {
    expect(() => parseTaskListQuery({ fields: ' , ' })).toThrow(ValidationError)
  })

  test('rejects --completed-only combined with --incomplete-only', () => {
    expect(() => parseTaskListQuery({ completedOnly: true, incompleteOnly: true })).toThrow(ValidationError)
  })

  test('rejects --completed-only combined with deprecated --completed', () => {
    expect(() => parseTaskListQuery({ completedOnly: true, completed: true })).toThrow(ValidationError)
  })

  test('rejects unknown --group-by field', () => {
    expect(() => parseTaskListQuery({ groupBy: 'due_on' })).toThrow(ValidationError)
  })

  test('accepts group-by assignee and completed', () => {
    expect(parseTaskListQuery({ groupBy: 'assignee' }).groupBy).toBe('assignee')
    expect(parseTaskListQuery({ groupBy: 'completed' }).groupBy).toBe('completed')
  })
})

describe('needsClientAssigneeFilter', () => {
  test('project listing always filters assignee client-side', () => {
    const query = parseTaskListQuery({ assignee: 'me' })
    expect(needsClientAssigneeFilter(query, true)).toBe(true)
  })

  test('assignee "none" filters client-side even without project', () => {
    const query = parseTaskListQuery({ assignee: 'none' })
    expect(needsClientAssigneeFilter(query, false)).toBe(true)
  })

  test('workspace listing with a concrete assignee stays server-side', () => {
    const query = parseTaskListQuery({ assignee: 'me' })
    expect(needsClientAssigneeFilter(query, false)).toBe(false)
  })
})

describe('buildOptFields', () => {
  test('returns undefined when no scan options are used (legacy output)', () => {
    const query = parseTaskListQuery({ assignee: 'me' })
    expect(buildOptFields(query, false)).toBeUndefined()
  })

  test('maps requested fields to opt_fields, expanding assignee', () => {
    const query = parseTaskListQuery({ fields: 'completed,assignee,due_on' })
    const optFields = buildOptFields(query, false)!.split(',')
    expect(optFields).toContain('name')
    expect(optFields).toContain('completed')
    expect(optFields).toContain('due_on')
    expect(optFields).toContain('assignee.name')
    expect(optFields).toContain('assignee.gid')
  })

  test('adds completed for completion filters and group-by', () => {
    expect(buildOptFields(parseTaskListQuery({ incompleteOnly: true }), false)).toContain('completed')
    expect(buildOptFields(parseTaskListQuery({ completedOnly: true }), false)).toContain('completed')
    expect(buildOptFields(parseTaskListQuery({ groupBy: 'completed' }), false)).toContain('completed')
  })

  test('adds assignee fields for client-side assignee filter and group-by', () => {
    expect(buildOptFields(parseTaskListQuery({ assignee: 'none' }), true)).toContain('assignee.gid')
    expect(buildOptFields(parseTaskListQuery({ groupBy: 'assignee' }), false)).toContain('assignee.name')
  })
})

describe('applyCompletionFilter', () => {
  test('keeps only incomplete tasks with --incomplete-only', () => {
    const query = parseTaskListQuery({ incompleteOnly: true })
    expect(applyCompletionFilter(TASKS, query).map(t => t.gid)).toEqual(['1', '3', '4'])
  })

  test('keeps only completed tasks with --completed-only', () => {
    const query = parseTaskListQuery({ completedOnly: true })
    expect(applyCompletionFilter(TASKS, query).map(t => t.gid)).toEqual(['2'])
  })

  test('passes through when no completion filter is set', () => {
    const query = parseTaskListQuery({})
    expect(applyCompletionFilter(TASKS, query)).toHaveLength(4)
  })
})

describe('applyAssigneeFilter', () => {
  test('"none" keeps only unassigned tasks', () => {
    expect(applyAssigneeFilter(TASKS, 'none').map(t => t.gid)).toEqual(['3'])
  })

  test('a user GID keeps only that assignee', () => {
    expect(applyAssigneeFilter(TASKS, '10').map(t => t.gid)).toEqual(['1', '2'])
  })
})

describe('effectiveColumns / toTaskRows', () => {
  test('uses requested fields as columns', () => {
    const query = parseTaskListQuery({ fields: 'completed,due_on' })
    expect(effectiveColumns(query, false)).toEqual(['completed', 'due_on'])
  })

  test('derives columns from active filters when --fields is absent', () => {
    const query = parseTaskListQuery({ incompleteOnly: true, assignee: 'none' })
    expect(effectiveColumns(query, true)).toEqual(['completed', 'assignee'])
  })

  test('flattens assignee to a name and fills missing values with null', () => {
    const rows = toTaskRows(TASKS.slice(0, 3), ['completed', 'assignee', 'due_on'])
    expect(rows[0]).toEqual({ gid: '1', name: 'A', completed: false, assignee: 'Alice', due_on: '2026-07-01' })
    expect(rows[2]).toEqual({ gid: '3', name: 'C', completed: false, assignee: null, due_on: null })
  })

  test('resolves dotted field paths against nested objects', () => {
    const rows = toTaskRows(TASKS.slice(0, 3), ['assignee.name', 'assignee.gid'])
    expect(rows[0]).toEqual({ 'gid': '1', 'name': 'A', 'assignee.name': 'Alice', 'assignee.gid': '10' })
    expect(rows[2]).toEqual({ 'gid': '3', 'name': 'C', 'assignee.name': null, 'assignee.gid': null })
  })
})

describe('summarizeTasks', () => {
  test('returns only the total without group-by', () => {
    expect(summarizeTasks(TASKS)).toEqual({ total: 4 })
  })

  test('groups by assignee with unassigned bucket, sorted by count', () => {
    expect(summarizeTasks(TASKS, 'assignee')).toEqual({
      total: 4,
      groups: [
        { assignee: 'Alice', count: 2 },
        { assignee: 'Bob', count: 1 },
        { assignee: 'unassigned', count: 1 },
      ],
    })
  })

  test('groups by completion state', () => {
    expect(summarizeTasks(TASKS, 'completed')).toEqual({
      total: 4,
      groups: [
        { completed: 'incomplete', count: 3 },
        { completed: 'completed', count: 1 },
      ],
    })
  })
})
