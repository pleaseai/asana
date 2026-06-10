/**
 * Batch operation helpers: input file parsing and a concurrency-limited
 * runner with progress reporting.
 *
 * Parsing is kept pure (string in, records out) so it can be unit-tested
 * without touching the filesystem.
 */

import chalk from 'chalk'
import { ERROR_IDS } from '../constants/errorIds'
import { ValidationError } from './validators'

/** Max concurrent API calls; Asana rate limits at 150 req/min for free tier. */
export const BATCH_CONCURRENCY = 5

export interface BatchResult<T = unknown> {
  total: number
  succeeded: number
  failed: number
  failures: Array<{ item: string, error: string }>
  results: T[]
}

function invalidBatchFile(message: string, context: Record<string, any> = {}): ValidationError {
  console.error(chalk.red(`✗ ${message}`))
  return new ValidationError(ERROR_IDS.INVALID_BATCH_FILE, message, context)
}

/**
 * Parse a JSON batch file. Accepts either a top-level array or an object
 * with a `tasks` array (`{"tasks": [...]}`).
 */
export function parseJsonRecords(content: string): Record<string, any>[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  }
  catch (error) {
    throw invalidBatchFile(`Invalid JSON in batch file: ${(error as Error).message}`)
  }

  const records = Array.isArray(parsed)
    ? parsed
    : (parsed as Record<string, any>)?.tasks

  if (!Array.isArray(records)) {
    throw invalidBatchFile('JSON batch file must be an array of objects or {"tasks": [...]}')
  }
  if (records.some(record => typeof record !== 'object' || record === null || Array.isArray(record))) {
    throw invalidBatchFile('Every entry in the JSON batch file must be an object')
  }
  return records
}

/**
 * Parse a CSV batch file with a header row into records keyed by header.
 *
 * Supports RFC 4180 quoting: quoted values may contain commas, newlines,
 * and escaped quotes (`""`). Empty cells are omitted from the record.
 */
export function parseCsvRecords(content: string): Record<string, string>[] {
  const rows = parseCsvRows(content)
  if (rows.length === 0) {
    throw invalidBatchFile('CSV batch file is empty')
  }

  const headers = rows[0].map(header => header.trim())
  if (headers.includes('')) {
    throw invalidBatchFile('CSV header row contains an empty column name')
  }

  return rows.slice(1).map((row, index) => {
    if (row.length > headers.length) {
      throw invalidBatchFile(
        `CSV row ${index + 2} has ${row.length} columns but the header has ${headers.length}`,
      )
    }
    const record: Record<string, string> = {}
    headers.forEach((header, column) => {
      const value = row[column]?.trim() ?? ''
      if (value !== '') {
        record[header] = value
      }
    })
    return record
  }).filter(record => Object.keys(record).length > 0)
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < content.length; i++) {
    const char = content[i]

    if (inQuotes) {
      if (char === '"' && content[i + 1] === '"') {
        cell += '"'
        i++
      }
      else if (char === '"') {
        inQuotes = false
      }
      else {
        cell += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    }
    else if (char === ',') {
      row.push(cell)
      cell = ''
    }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && content[i + 1] === '\n') {
        i++
      }
      row.push(cell)
      cell = ''
      if (row.some(value => value !== '')) {
        rows.push(row)
      }
      row = []
    }
    else {
      cell += char
    }
  }

  row.push(cell)
  if (row.some(value => value !== '')) {
    rows.push(row)
  }
  return rows
}

/**
 * Parse a plain-text GID list: one GID per line, blank lines and
 * `#`-comments ignored.
 */
export function parseGidLines(content: string): string[] {
  const gids = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '' && !line.startsWith('#'))

  const invalid = gids.filter(gid => !/^\d+$/.test(gid))
  if (invalid.length > 0) {
    throw invalidBatchFile(
      `Invalid GID(s) in batch file: ${invalid.slice(0, 5).join(', ')}`,
      { invalid },
    )
  }
  return gids
}

/**
 * Run `operation` over `items` with limited concurrency, reporting progress
 * to stderr (TTY only) and collecting per-item failures instead of aborting
 * the whole batch on the first error.
 */
export async function runBatch<TItem, TResult>(
  items: TItem[],
  operation: (item: TItem) => Promise<TResult>,
  options: {
    describe: (item: TItem) => string
    concurrency?: number
    onProgress?: (done: number, total: number) => void
  },
): Promise<BatchResult<TResult>> {
  const concurrency = options.concurrency ?? BATCH_CONCURRENCY
  const onProgress = options.onProgress ?? createProgressReporter()

  const result: BatchResult<TResult> = {
    total: items.length,
    succeeded: 0,
    failed: 0,
    failures: [],
    results: [],
  }

  let done = 0
  let cursor = 0

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const item = items[cursor++]
      try {
        result.results.push(await operation(item))
        result.succeeded++
      }
      catch (error) {
        result.failed++
        result.failures.push({
          item: options.describe(item),
          error: extractErrorMessage(error),
        })
      }
      onProgress(++done, items.length)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )
  return result
}

/** Progress line on stderr so stdout stays machine-parseable. */
function createProgressReporter(): (done: number, total: number) => void {
  if (!process.stderr.isTTY) {
    return () => {}
  }
  return (done, total) => {
    process.stderr.write(`\r${chalk.gray(`Processing ${done}/${total}...`)}`)
    if (done === total) {
      process.stderr.write('\n')
    }
  }
}

function extractErrorMessage(error: any): string {
  if (error?.value?.errors?.[0]?.message) {
    return error.value.errors[0].message
  }
  if (error?.status) {
    return `HTTP ${error.status}`
  }
  return error?.message ?? String(error)
}
