import { describe, expect, test } from 'bun:test'

import { buildCliGuidance, decideForToolCall } from '../../hooks/intercept-webfetch'

// URL parsing itself is covered in test/lib/asana-url.test.ts; here we only test
// the hook-specific guidance and tool-call decision built on top of it.

describe('buildCliGuidance', () => {
  test('recommends `asana fetch <url>` with the URL passed verbatim', () => {
    const url = 'https://app.asana.com/1/15793206719/task/12058909747493732'
    const guidance = buildCliGuidance(url)
    expect(guidance).toContain(`asana fetch ${url} --format toon`)
  })
})

describe('decideForToolCall', () => {
  const taskUrl = 'https://app.asana.com/1/15793206719/task/12058909747493732'

  test('denies a WebFetch of an Asana task URL with `asana fetch` guidance', () => {
    const out = decideForToolCall({ tool_name: 'WebFetch', tool_input: { url: taskUrl } })
    expect(out.hookSpecificOutput?.permissionDecision).toBe('deny')
    expect(out.systemMessage).toContain(`asana fetch ${taskUrl} --format toon`)
  })

  test('denies the Fetch tool path the same way as WebFetch', () => {
    const out = decideForToolCall({ tool_name: 'Fetch', tool_input: { url: taskUrl } })
    expect(out.hookSpecificOutput?.permissionDecision).toBe('deny')
    expect(out.systemMessage).toContain(`asana fetch ${taskUrl} --format toon`)
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
