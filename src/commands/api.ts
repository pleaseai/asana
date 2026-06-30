import type { ErrorId } from '../constants/errorIds'
import type { OutputFormat } from '../utils/formatter'
import { readFileSync } from 'node:fs'
import { Command } from 'commander'
import { getApiBaseUrl } from '../constants/api'
import { ERROR_IDS } from '../constants/errorIds'
import { emitError } from '../lib/axi-output'
import { getAccessToken } from '../lib/config'
import { handleAsanaError } from '../lib/error-handler'
import { formatOutput, getOutputFormat } from '../utils/formatter'

const BODYLESS_METHODS = new Set(['GET', 'HEAD'])

/**
 * A usage error (AXI §6, exit code 2): a malformed flag detected before any
 * network call. Carries a stable code and an actionable hint.
 */
export class ApiUsageError extends Error {
  constructor(
    readonly errorId: ErrorId,
    message: string,
    readonly help?: string,
  ) {
    super(message)
    this.name = 'ApiUsageError'
  }
}

interface ApiOptions {
  method?: string
  rawField?: string[]
  field?: string[]
  input?: string
  header?: string[]
  include?: boolean
}

/**
 * Resolve an endpoint to an absolute URL. A full `http(s)` URL passes through;
 * a relative path (`/tasks/123` or `tasks/123`) is joined onto the API base.
 */
export function normalizeEndpoint(endpoint: string, baseUrl: string = getApiBaseUrl()): string {
  const trimmed = endpoint.trim()
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }
  return `${baseUrl}/${trimmed.replace(/^\/+/, '')}`
}

/**
 * Coerce a `--field` (typed) value: literals `true`/`false`/`null` and plain
 * numbers map to their JSON types; everything else stays a string.
 */
function coerceTypedValue(value: string): unknown {
  if (value === 'true') {
    return true
  }
  if (value === 'false') {
    return false
  }
  if (value === 'null') {
    return null
  }
  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return Number(value)
  }
  return value
}

/** Split a `key=value` token, rejecting tokens without `=`. */
function splitPair(raw: string): { key: string, value: string } {
  const eq = raw.indexOf('=')
  if (eq === -1) {
    throw new ApiUsageError(
      ERROR_IDS.INVALID_API_ARGUMENT,
      `Invalid field "${raw}": expected key=value`,
      'Example: asana api /tasks -X POST --raw-field name=Foo -F completed=false',
    )
  }
  return { key: raw.slice(0, eq), value: raw.slice(eq + 1) }
}

/**
 * Merge raw (string) and typed fields into one object. Raw passthrough — no
 * `{ data: { ... } }` wrapping (the caller supplies the Asana envelope via
 * `--input` when an endpoint requires it). Typed fields win on key collision.
 */
export function parseFields(rawFields: string[] = [], typedFields: string[] = []): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const raw of rawFields) {
    const { key, value } = splitPair(raw)
    result[key] = value
  }
  for (const raw of typedFields) {
    const { key, value } = splitPair(raw)
    result[key] = coerceTypedValue(value)
  }
  return result
}

/** Parse repeatable `key:value` header tokens into an object. */
export function parseHeaders(headerStrings: string[] = []): Record<string, string> {
  const result: Record<string, string> = {}
  for (const raw of headerStrings) {
    const colon = raw.indexOf(':')
    if (colon === -1) {
      throw new ApiUsageError(
        ERROR_IDS.INVALID_API_ARGUMENT,
        `Invalid header "${raw}": expected key:value`,
        'Example: -H "Asana-Enable: new_user_task_lists"',
      )
    }
    result[raw.slice(0, colon).trim()] = raw.slice(colon + 1).trim()
  }
  return result
}

/** Default to GET, or POST when a body is present, unless an explicit method is given (gh behavior). */
export function resolveMethod(explicit: string | undefined, hasBody: boolean): string {
  if (explicit) {
    return explicit.toUpperCase()
  }
  return hasBody ? 'POST' : 'GET'
}

/** Parse a response body as JSON, falling back to the raw text (e.g. non-JSON downloads). */
export function parseBody(text: string): unknown {
  if (text.length === 0) {
    return {}
  }
  try {
    return JSON.parse(text)
  }
  catch {
    return text
  }
}

export interface BuildRequestOptions {
  endpoint: string
  method: string
  fields: Record<string, unknown>
  body?: string
  headers: Record<string, string>
  token: string
  baseUrl?: string
}

/**
 * Build the URL and fetch init. GET/HEAD put fields on the query string;
 * other methods send `--input` (raw body) or the fields as a JSON body.
 * The bearer token and Accept default first so user `-H` headers can override.
 */
export function buildRequest(opts: BuildRequestOptions): { url: string, init: RequestInit } {
  const { endpoint, method, fields, body, headers, token, baseUrl } = opts
  const url = new URL(normalizeEndpoint(endpoint, baseUrl))

  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...headers,
    },
  }

  if (BODYLESS_METHODS.has(method)) {
    for (const [key, value] of Object.entries(fields)) {
      url.searchParams.append(key, String(value))
    }
  }
  else if (body !== undefined) {
    init.body = body
    init.headers = { 'Content-Type': 'application/json', ...init.headers }
  }
  else if (Object.keys(fields).length > 0) {
    init.body = JSON.stringify(fields)
    init.headers = { 'Content-Type': 'application/json', ...init.headers }
  }

  return { url: url.toString(), init }
}

/** Read `--input`: a file path, or `-` for stdin (fd 0). */
function readInput(input: string): string {
  try {
    return readFileSync(input === '-' ? 0 : input, 'utf-8')
  }
  catch {
    throw new ApiUsageError(
      ERROR_IDS.FILE_NOT_FOUND,
      `Could not read request body from ${input === '-' ? 'stdin' : `"${input}"`}`,
      'Pass a readable file path, or "-" to read the body from stdin.',
    )
  }
}

function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {}
  headers.forEach((value, key) => {
    result[key] = value
  })
  return result
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value]
}

/**
 * `asana api <endpoint>` — call any Asana REST endpoint directly, like
 * `gh api`. An escape hatch for endpoints not covered by the typed commands.
 * Note: `-f` is the global `--format` flag, so the string-field flag is the
 * long `--raw-field`; use `-F`/`--field` for typed values.
 */
export function createApiCommand(): Command {
  return new Command('api')
    .description('Call any Asana REST API endpoint directly (like `gh api`)')
    .argument('<endpoint>', 'API path (e.g. /tasks/123 or tasks/123) or a full https URL')
    .option('-X, --method <method>', 'HTTP method (default: GET, or POST when a body is provided)')
    .option('--raw-field <key=value>', 'Add a string body/query parameter (repeatable)', collect, [])
    .option('-F, --field <key=value>', 'Add a typed body/query parameter — true/false/null/number parsed (repeatable)', collect, [])
    .option('--input <file>', 'Read the raw request body from a file, or "-" for stdin (overrides --field)')
    .option('-H, --header <key:value>', 'Add a request header (repeatable)', collect, [])
    .option('-i, --include', 'Include the HTTP response status and headers in the output')
    .action(runApi)
}

async function runApi(endpoint: string, options: ApiOptions, command: Command): Promise<void> {
  const format = getOutputFormat(command)

  // Validate inputs before any network call (usage errors → exit 2, AXI §6 / D5).
  let fields: Record<string, unknown>
  let headers: Record<string, string>
  let body: string | undefined
  try {
    fields = parseFields(options.rawField, options.field)
    headers = parseHeaders(options.header)
    body = options.input === undefined ? undefined : readInput(options.input)
  }
  catch (error) {
    if (error instanceof ApiUsageError) {
      emitError({ code: error.errorId, message: error.message, help: error.help }, format)
      process.exit(2)
    }
    throw error
  }

  const token = getAccessToken()
  if (!token) {
    emitError({
      code: ERROR_IDS.AUTH_FAILED,
      message: 'Asana access token not found',
      help: 'Set ASANA_ACCESS_TOKEN or run "asana auth login" first.',
    }, format)
    process.exit(1)
  }

  const hasBody = body !== undefined || Object.keys(fields).length > 0
  const method = resolveMethod(options.method, hasBody)
  const { url, init } = buildRequest({ endpoint, method, fields, body, headers, token })

  try {
    const response = await fetch(url, init)
    const parsed = parseBody(await response.text())

    if (!response.ok) {
      // Reuse the SDK error shape so translateAsanaError surfaces Asana's own
      // message/help and the 401/403/429/5xx mappings.
      handleAsanaError(
        { status: response.status, value: parsed },
        'API request',
        { endpoint: url, status: response.status },
        format,
      )
    }

    const payload = options.include
      ? { status: response.status, headers: headersToObject(response.headers), body: parsed }
      : parsed
    console.log(formatOutput(payload, { format: format as OutputFormat, colors: process.stdout.isTTY }))
  }
  catch (error) {
    handleAsanaError(error, 'API request', { endpoint: url }, format)
  }
}
