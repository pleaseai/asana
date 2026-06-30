import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { Command } from 'commander'
import {
  ApiUsageError,
  buildRequest,
  createApiCommand,
  normalizeEndpoint,
  parseBody,
  parseFields,
  parseHeaders,
  resolveMethod,
} from '../../src/commands/api'

const BASE = 'https://api.test/api/1.0'
const TOKEN = 'test-token'

describe('normalizeEndpoint', () => {
  test('joins a leading-slash path onto the base URL', () => {
    expect(normalizeEndpoint('/tasks/123', BASE)).toBe(`${BASE}/tasks/123`)
  })

  test('joins a bare path onto the base URL', () => {
    expect(normalizeEndpoint('tasks/123', BASE)).toBe(`${BASE}/tasks/123`)
  })

  test('accepts a full URL on the same origin as the base (e.g. next_page.uri)', () => {
    expect(normalizeEndpoint(`${BASE}/tasks?offset=abc`, BASE)).toBe(`${BASE}/tasks?offset=abc`)
  })

  test('rejects an off-origin URL so the bearer token is never leaked', () => {
    expect(() => normalizeEndpoint('https://evil.example/steal', BASE)).toThrow(ApiUsageError)
  })

  test('keeps the API prefix when resolving a bare path (no prefix climbing)', () => {
    expect(normalizeEndpoint('users/me', BASE)).toBe(`${BASE}/users/me`)
  })
})

describe('parseFields', () => {
  test('keeps raw fields as strings', () => {
    expect(parseFields(['name=Hello World'], [])).toEqual({ name: 'Hello World' })
  })

  test('coerces typed fields: boolean, null, number', () => {
    expect(parseFields([], ['completed=true', 'parent=null', 'count=42', 'ratio=1.5']))
      .toEqual({ completed: true, parent: null, count: 42, ratio: 1.5 })
  })

  test('leaves a non-numeric typed value as a string', () => {
    expect(parseFields([], ['name=Foo'])).toEqual({ name: 'Foo' })
  })

  test('does NOT wrap fields in a data envelope (raw passthrough)', () => {
    expect(parseFields(['name=Foo'], [])).not.toHaveProperty('data')
  })

  test('throws ApiUsageError on a token without "="', () => {
    expect(() => parseFields(['name'], [])).toThrow(ApiUsageError)
  })

  test('splits only on the first "=" so values may contain "="', () => {
    expect(parseFields(['note=a=b=c'], [])).toEqual({ note: 'a=b=c' })
  })
})

describe('parseHeaders', () => {
  test('parses key:value headers and trims whitespace', () => {
    expect(parseHeaders(['Asana-Enable: new_user_task_lists'])).toEqual({
      'Asana-Enable': 'new_user_task_lists',
    })
  })

  test('throws ApiUsageError on a header without ":"', () => {
    expect(() => parseHeaders(['bogus'])).toThrow(ApiUsageError)
  })
})

describe('resolveMethod', () => {
  test('defaults to GET with no body', () => {
    expect(resolveMethod(undefined, false)).toBe('GET')
  })

  test('defaults to POST when a body is present', () => {
    expect(resolveMethod(undefined, true)).toBe('POST')
  })

  test('uppercases an explicit method and ignores body', () => {
    expect(resolveMethod('delete', false)).toBe('DELETE')
  })
})

describe('parseBody', () => {
  test('parses JSON', () => {
    expect(parseBody('{"data":{"gid":"1"}}')).toEqual({ data: { gid: '1' } })
  })

  test('returns an empty object for an empty body', () => {
    expect(parseBody('')).toEqual({})
  })

  test('falls back to raw text for non-JSON', () => {
    expect(parseBody('not json')).toBe('not json')
  })
})

describe('buildRequest', () => {
  test('GET puts fields on the query string, not the body', () => {
    const { url, init } = buildRequest({
      endpoint: '/tasks',
      method: 'GET',
      fields: { opt_fields: 'name', limit: 5 },
      headers: {},
      token: TOKEN,
      baseUrl: BASE,
    })
    expect(url).toBe(`${BASE}/tasks?opt_fields=name&limit=5`)
    expect(init.body).toBeUndefined()
  })

  test('sets the bearer Authorization header', () => {
    const { init } = buildRequest({
      endpoint: '/users/me',
      method: 'GET',
      fields: {},
      headers: {},
      token: TOKEN,
      baseUrl: BASE,
    })
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
  })

  test('POST sends fields as a flat JSON body with NO data envelope', () => {
    const { init } = buildRequest({
      endpoint: '/tasks',
      method: 'POST',
      fields: { name: 'Foo' },
      headers: {},
      token: TOKEN,
      baseUrl: BASE,
    })
    expect(init.body).toBe('{"name":"Foo"}')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  test('a raw --input body takes precedence over fields', () => {
    const { init } = buildRequest({
      endpoint: '/tasks',
      method: 'POST',
      fields: { name: 'ignored' },
      body: '{"data":{"name":"Bar"}}',
      headers: {},
      token: TOKEN,
      baseUrl: BASE,
    })
    expect(init.body).toBe('{"data":{"name":"Bar"}}')
  })

  test('a user header may override the default Authorization', () => {
    const { init } = buildRequest({
      endpoint: '/tasks',
      method: 'GET',
      fields: {},
      headers: { Authorization: 'Bearer override' },
      token: TOKEN,
      baseUrl: BASE,
    })
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer override')
  })
})

describe('api command structure', () => {
  test('creates a command named api', () => {
    expect(createApiCommand().name()).toBe('api')
  })

  test('takes a required <endpoint> argument', () => {
    const args = createApiCommand().registeredArguments
    expect(args).toHaveLength(1)
    expect(args[0]?.name()).toBe('endpoint')
    expect(args[0]?.required).toBe(true)
  })
})

describe('api command execution', () => {
  let fetchCalls: Array<{ url: string, init: RequestInit }>
  let nextResponse: Response
  let logs: string[]
  let exitSpy: ReturnType<typeof spyOn>
  let errorSpy: ReturnType<typeof spyOn>
  const originalFetch = globalThis.fetch
  const originalLog = console.log

  beforeEach(() => {
    process.env.ASANA_ACCESS_TOKEN = TOKEN
    process.env.ASANA_API_BASE_URL = BASE
    fetchCalls = []
    logs = []
    console.log = (...args: unknown[]) => {
      logs.push(args.join(' '))
    }
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      fetchCalls.push({ url, init })
      return nextResponse
    }) as unknown as typeof fetch
    // Spy here, restore in afterEach — so a failing assertion mid-test can never
    // leak the process.exit / console.error mock into later tests.
    exitSpy = spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('__exit__')
    }) as never)
    errorSpy = spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    console.log = originalLog
    exitSpy.mockRestore()
    errorSpy.mockRestore()
    delete process.env.ASANA_ACCESS_TOKEN
    delete process.env.ASANA_API_BASE_URL
  })

  function runApi(args: string[]): Promise<Command> {
    const program = new Command()
    program.name('asana').option('-f, --format <type>', 'output format', 'toon')
    program.addCommand(createApiCommand())
    return program.parseAsync(args, { from: 'user' })
  }

  test('GET sends a bearer-authenticated request and prints the response (json)', async () => {
    nextResponse = new Response(JSON.stringify({ data: { gid: '1', name: 'Me' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })

    await runApi(['--format', 'json', 'api', '/users/me'])

    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0]?.url).toBe(`${BASE}/users/me`)
    expect(fetchCalls[0]?.init.method).toBe('GET')
    expect((fetchCalls[0]?.init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
    expect(logs.join('\n')).toContain('"name": "Me"')
  })

  test('fields alone stay GET and become query parameters (no auto-POST)', async () => {
    nextResponse = new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })

    await runApi(['api', '/tasks/1', '-F', 'opt_fields=name,completed'])

    expect(fetchCalls[0]?.init.method).toBe('GET')
    expect(fetchCalls[0]?.url).toBe(`${BASE}/tasks/1?opt_fields=name%2Ccompleted`)
    expect(fetchCalls[0]?.init.body).toBeUndefined()
  })

  test('an explicit POST sends fields as a JSON body', async () => {
    nextResponse = new Response(JSON.stringify({ data: { gid: '99' } }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    })

    await runApi(['api', '/tasks', '-X', 'POST', '--raw-field', 'name=New Task'])

    expect(fetchCalls[0]?.init.method).toBe('POST')
    expect(fetchCalls[0]?.init.body).toBe('{"name":"New Task"}')
  })

  test('--input flips the default method to POST', async () => {
    nextResponse = new Response(JSON.stringify({ data: { gid: '7' } }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    })

    await runApi(['api', '/tasks', '--input', 'package.json'])

    expect(fetchCalls[0]?.init.method).toBe('POST')
  })

  test('routes an HTTP error response through handleAsanaError (plain → stderr, exit 1)', async () => {
    nextResponse = new Response(JSON.stringify({ errors: [{ message: 'task: Not a recognized id.' }] }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    })

    await expect(runApi(['--format', 'plain', 'api', '/tasks/bad'])).rejects.toThrow('__exit__')

    const printed = errorSpy.mock.calls.flat().join(' ')
    expect(printed).toContain('Not a recognized id')
  })

  test('a malformed --raw-field is a usage error (exit 2) before any request', async () => {
    await expect(runApi(['--format', 'json', 'api', '/tasks', '--raw-field', 'name'])).rejects.toThrow('__exit__')

    expect(exitSpy).toHaveBeenCalledWith(2)
    expect(fetchCalls).toHaveLength(0)
  })

  test('an off-origin endpoint is rejected (exit 2) and never fetched', async () => {
    await expect(runApi(['--format', 'json', 'api', 'https://evil.example/steal'])).rejects.toThrow('__exit__')

    expect(exitSpy).toHaveBeenCalledWith(2)
    expect(fetchCalls).toHaveLength(0)
  })

  test('--input with an explicit bodyless method (GET) is a usage error, not a silent drop', async () => {
    // package.json is a real, readable file so readInput succeeds and the
    // body-drop guard (not file validation) is what trips the usage error.
    await expect(
      runApi(['--format', 'json', 'api', '/tasks', '-X', 'GET', '--input', 'package.json']),
    ).rejects.toThrow('__exit__')

    expect(exitSpy).toHaveBeenCalledWith(2)
    expect(fetchCalls).toHaveLength(0)
  })
})
