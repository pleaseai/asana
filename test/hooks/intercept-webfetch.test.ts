import { describe, expect, test } from 'bun:test'

import { buildCliGuidance, decideForToolCall } from '../../hooks/intercept-webfetch'

// URL parsing itself is covered in test/lib/asana-url.test.ts; here we only test
// the hook-specific guidance and tool-call decision built on top of it.

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

  test('falls back to `asana --help` when a match lacks its id', () => {
    const guidance = buildCliGuidance({ type: 'task' })
    expect(guidance).toContain('asana --help')
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
