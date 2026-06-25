import { describe, expect, test } from 'bun:test'

import { buildCliGuidance, decideForToolCall, parseAsanaUrl } from '../../hooks/intercept-webfetch'

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

describe('parseAsanaUrl host boundary', () => {
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
// redirect to the task. Project routes stay exact-anchored, and the comment
// route is ordered before task so it is never shadowed. Locking this so a future
// "tighten to exact match" change can't silently drop real focus URLs.
describe('parseAsanaUrl trailing view/focus segments (intentional leniency)', () => {
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

describe('decideForToolCall', () => {
  const taskUrl = 'https://app.asana.com/1/15793206719/task/12058909747493732'

  test('denies a WebFetch of an Asana task URL with CLI guidance', () => {
    const out = decideForToolCall({ tool_name: 'WebFetch', tool_input: { url: taskUrl } })
    expect(out.hookSpecificOutput?.permissionDecision).toBe('deny')
    expect(out.systemMessage).toContain('asana task get 12058909747493732 --format toon')
  })

  test('denies the Fetch tool path the same way as WebFetch', () => {
    const out = decideForToolCall({ tool_name: 'Fetch', tool_input: { url: taskUrl } })
    expect(out.hookSpecificOutput?.permissionDecision).toBe('deny')
    expect(out.systemMessage).toContain('asana task get 12058909747493732 --format toon')
  })

  test('does not prefix the deny message with a success checkmark', () => {
    const out = decideForToolCall({ tool_name: 'WebFetch', tool_input: { url: taskUrl } })
    expect(out.systemMessage?.startsWith('✓')).toBe(false)
    expect(out.systemMessage?.startsWith('⚠️')).toBe(true)
  })

  test('allows (empty output) a non-Asana WebFetch', () => {
    const out = decideForToolCall({ tool_name: 'WebFetch', tool_input: { url: 'https://github.com/owner/repo' } })
    expect(out).toEqual({})
  })

  test('passes through a non-fetch tool', () => {
    const out = decideForToolCall({ tool_name: 'Bash', tool_input: { command: 'ls' } })
    expect(out).toEqual({})
  })

  test('allows a fetch with no url field', () => {
    const out = decideForToolCall({ tool_name: 'Fetch', tool_input: {} })
    expect(out).toEqual({})
  })
})
