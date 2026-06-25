import { describe, expect, test } from 'bun:test'

import { parseAsanaUrl } from '../../src/lib/asana-url'

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

  describe('host boundary', () => {
    test('rejects a look-alike host with app.asana.com as a prefix', () => {
      expect(parseAsanaUrl('https://app.asana.com.evil.com/0/123/456')).toBeNull()
    })

    test('rejects app.asana.com appearing in the path of another host', () => {
      expect(parseAsanaUrl('https://evil.com/app.asana.com/0/123/456')).toBeNull()
    })

    test('rejects app.asana.com embedded in a query string (proxy/redirect)', () => {
      expect(parseAsanaUrl('https://proxy.example.com/fetch?target=https://app.asana.com/0/123/456')).toBeNull()
    })

    test('rejects a different asana subdomain', () => {
      expect(parseAsanaUrl('https://myapp.asana.com/0/123/456')).toBeNull()
    })

    test('returns null for a non-URL string instead of throwing', () => {
      expect(parseAsanaUrl('not a url')).toBeNull()
    })

    test('ignores a URL fragment after a project id', () => {
      expect(parseAsanaUrl('https://app.asana.com/0/1206043162733419#section')).toEqual({
        type: 'project',
        projectId: '1206043162733419',
      })
    })
  })

  // Task/comment routes are matched by prefix on purpose: Asana appends view/focus
  // segments to real task URLs (e.g. the `/f` focus suffix), and those must still
  // resolve to the task. Project routes stay exact-anchored, and the comment route
  // is ordered before task so it is never shadowed. Locking this so a future
  // "tighten to exact match" change can't silently drop real focus URLs.
  describe('trailing view/focus segments (intentional leniency)', () => {
    test('treats a V0 focus URL (/f suffix) as its task', () => {
      expect(parseAsanaUrl('https://app.asana.com/0/1206043162733419/12058909747493732/f')).toEqual({
        type: 'task',
        projectId: '1206043162733419',
        taskId: '12058909747493732',
      })
    })

    test('treats a V1 focus URL (/f suffix) as its task', () => {
      expect(parseAsanaUrl('https://app.asana.com/1/15793206719/project/1206043162733419/task/12058909747493732/f')).toEqual({
        type: 'task',
        workspaceId: '15793206719',
        projectId: '1206043162733419',
        taskId: '12058909747493732',
      })
    })

    test('still prioritizes the comment route over task when both could match', () => {
      expect(parseAsanaUrl('https://app.asana.com/1/15793206719/task/12058909747493732/comment/9876543210')).toEqual({
        type: 'comment',
        workspaceId: '15793206719',
        projectId: undefined,
        taskId: '12058909747493732',
        commentId: '9876543210',
      })
    })
  })

  describe('project view suffixes', () => {
    test.each(['list', 'board', 'calendar', 'timeline', 'overview'])('resolves a V0 project %s view to the project', (view) => {
      expect(parseAsanaUrl(`https://app.asana.com/0/1206043162733419/${view}`)).toEqual({
        type: 'project',
        projectId: '1206043162733419',
      })
    })

    test.each(['list', 'board', 'calendar', 'timeline', 'overview'])('resolves a V1 project %s view to the project', (view) => {
      expect(parseAsanaUrl(`https://app.asana.com/1/15793206719/project/1206043162733419/${view}`)).toEqual({
        type: 'project',
        workspaceId: '15793206719',
        projectId: '1206043162733419',
      })
    })

    test('rejects an extra numeric segment on a V1 project (not a view)', () => {
      expect(parseAsanaUrl('https://app.asana.com/1/15793206719/project/1206043162733419/9999')).toBeNull()
    })

    test('rejects an unsupported alphabetic suffix on a V1 project', () => {
      expect(parseAsanaUrl('https://app.asana.com/1/15793206719/project/1206043162733419/foo')).toBeNull()
    })

    test('rejects an unsupported alphabetic suffix on a V0 project', () => {
      expect(parseAsanaUrl('https://app.asana.com/0/1206043162733419/foo')).toBeNull()
    })
  })

  describe('id segment boundaries', () => {
    test('rejects a task id with trailing non-boundary characters', () => {
      expect(parseAsanaUrl('https://app.asana.com/1/15793206719/task/12058909747493732abc')).toBeNull()
    })

    test('rejects a V0 task id with trailing non-boundary characters', () => {
      expect(parseAsanaUrl('https://app.asana.com/0/1206043162733419/12058909747493732abc')).toBeNull()
    })
  })
})
