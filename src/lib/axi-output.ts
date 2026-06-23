/**
 * AXI structured output helpers.
 *
 * Renders errors in the format the caller selected. Machine formats (toon/json)
 * emit a structured payload to stdout so agents can read failures; the human
 * `plain` format keeps the existing colored stderr behavior.
 *
 * See ADR-003 (AXI Agent eXperience Conventions) for the error-output model.
 */

import type { ErrorId } from '../constants/errorIds'
import type { OutputFormat } from '../utils/formatter'
import * as nodeFs from 'node:fs'
import { inspect } from 'node:util'
import { encodeToon } from '@pleaseai/cli-toolkit/output'
import chalk from 'chalk'
import { formatOutput } from '../utils/formatter'

export interface AxiError {
  /** Stable, machine-readable error code. */
  code: ErrorId

  /** Translated, actionable message readable by both humans and agents. */
  message: string

  /** Specific next-step command that resolves the error. */
  help?: string

  /** Optional disambiguating key/values. */
  context?: Record<string, unknown>
}

/**
 * Build the structured error payload with a stable key order
 * (`error`, `code`, `help`, `context`). Pure — no side effects.
 *
 * `help` and `context` are included only when present (context must be
 * non-empty), so minimal errors stay minimal.
 */
export function buildErrorPayload(error: AxiError): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    error: error.message,
    code: error.code,
  }

  if (error.help) {
    payload.help = error.help
  }

  if (error.context && Object.keys(error.context).length > 0) {
    payload.context = error.context
  }

  return payload
}

/**
 * Render a structured error for a machine format. Pure — returns a string.
 */
export function formatStructuredError(error: AxiError, format: 'toon' | 'json'): string {
  const payload = buildErrorPayload(error)
  return format === 'toon' ? encodeToon(payload) : JSON.stringify(payload, null, 2)
}

/**
 * Emit an error in the selected format.
 *
 * - `toon` / `json`: structured payload to **stdout** (agent-readable, AXI §6).
 * - `plain`: human-readable, colored, to **stderr** (backward-compatible).
 */
export function emitError(error: AxiError, format: OutputFormat): void {
  if (format === 'plain') {
    emitErrorPlain(error)
    return
  }

  // Write synchronously to stdout (fd 1): callers exit immediately afterwards,
  // and an async console.log could be truncated by process.exit when piped.
  nodeFs.writeSync(1, `${formatStructuredError(error, format)}\n`)
}

/**
 * Emit a successful result in the selected format.
 *
 * - `toon` / `json`: structured `data` to stdout (agent-readable).
 * - `plain`: the human-friendly `plainMessage` (colored) to stdout.
 *
 * Keeps machine output parseable while preserving the existing human UX, so an
 * agent parsing stdout never receives stray prose (Pragmatic Programmer —
 * orthogonality).
 */
export function emitResult(data: unknown, plainMessage: string, format: OutputFormat): void {
  if (format === 'plain') {
    console.log(chalk.green(plainMessage))
    return
  }

  console.log(formatOutput(data, { format }))
}

function emitErrorPlain(error: AxiError): void {
  console.error(chalk.red(`✗ ${error.message}`))

  if (error.context) {
    for (const [key, value] of Object.entries(error.context)) {
      if (value !== undefined && value !== null) {
        const rendered = typeof value === 'string' ? value : inspect(value, { depth: null, colors: false })
        console.error(chalk.gray(`  ${key}: ${rendered}`))
      }
    }
  }

  if (error.help) {
    console.error(chalk.gray(`  Help: ${error.help}`))
  }
}
