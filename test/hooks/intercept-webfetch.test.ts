import { describe, expect, test } from 'bun:test'

import { buildCliGuidance, parseAsanaUrl } from '../../hooks/intercept-webfetch'

describe('parseAsanaUrl', () => {
  describe('V0 (legacy) format', () => {
    test('parses task URL', () => {
      const url = 'https://app.asana.com/0/1206043162733419/12058909747493732'
      expect(parseAsanaUrl(url)).toEqual({
        type: 'task',
        projectId: '1206043162733419',
        taskId: '12058909747493732',
      })
    })

    test('parses project URL', () => {
      const url = 'https://app.asana.com/0/1206043162733419'
      expect(parseAsanaUrl(url)).toEqual({
        type: 'project',
        projectId: '1206043162733419',
      })
    })

    test('parses project URL with query params', () => {
      const url = 'https://app.asana.com/0/1206043162733419?tab=overview'
      expect(parseAsanaUrl(url)).toEqual({
        type: 'project',
        projectId: '1206043162733419',
      })
    })
  })

  describe('V1 (new) format', () => {
    test('parses task in project URL', () => {
      const url = 'https://app.asana.com/1/15793206719/project/1206043162733419/task/12058909747493732'
      expect(parseAsanaUrl(url)).toEqual({
        type: 'task',
        workspaceId: '15793206719',
        projectId: '1206043162733419',
        taskId: '12058909747493732',
      })
    })

    test('parses task without project URL', () => {
      const url = 'https://app.asana.com/1/15793206719/task/12058909747493732'
      expect(parseAsanaUrl(url)).toEqual({
        type: 'task',
        workspaceId: '15793206719',
        taskId: '12058909747493732',
      })
    })

    test('parses project URL', () => {
      const url = 'https://app.asana.com/1/15793206719/project/1206043162733419'
      expect(parseAsanaUrl(url)).toEqual({
        type: 'project',
        workspaceId: '15793206719',
        projectId: '1206043162733419',
      })
    })

    test('parses comment URL with project', () => {
      const url = 'https://app.asana.com/1/15793206719/project/1206043162733419/task/12058909747493732/comment/9876543210'
      expect(parseAsanaUrl(url)).toEqual({
        type: 'comment',
        workspaceId: '15793206719',
        projectId: '1206043162733419',
        taskId: '12058909747493732',
        commentId: '9876543210',
      })
    })

    test('parses comment URL without project', () => {
      const url = 'https://app.asana.com/1/15793206719/task/12058909747493732/comment/9876543210'
      expect(parseAsanaUrl(url)).toEqual({
        type: 'comment',
        workspaceId: '15793206719',
        projectId: undefined,
        taskId: '12058909747493732',
        commentId: '9876543210',
      })
    })
  })

  describe('invalid URLs', () => {
    test('returns null for non-Asana URL', () => {
      expect(parseAsanaUrl('https://github.com/owner/repo')).toBeNull()
    })

    test('returns null for Asana home URL', () => {
      expect(parseAsanaUrl('https://app.asana.com/')).toBeNull()
    })
  })
})

describe('buildCliGuidance', () => {
  test('routes a task to `asana task get`', () => {
    const guidance = buildCliGuidance({ type: 'task', taskId: '12058909747493732' })
    expect(guidance).toContain('asana task get 12058909747493732 --format toon')
  })

  test('routes a project to `asana project get`', () => {
    const guidance = buildCliGuidance({ type: 'project', projectId: '1206043162733419' })
    expect(guidance).toContain('asana project get 1206043162733419 --format toon')
  })

  test('routes a comment to `asana task comment list`', () => {
    const guidance = buildCliGuidance({
      type: 'comment',
      taskId: '12058909747493732',
      commentId: '9876543210',
    })
    expect(guidance).toContain('asana task comment list 12058909747493732 --format toon')
  })

  test('falls back to `asana --help` for an unknown shape', () => {
    const guidance = buildCliGuidance({ type: 'unknown' })
    expect(guidance).toContain('asana --help')
  })
})
