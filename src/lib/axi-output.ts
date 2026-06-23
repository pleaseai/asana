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
import { encodeToon } from '@pleaseai/cli-toolkit/output'
import chalk from 'chalk'

export interface AxiError {
  /** Stable, machine-readable error code. */
  code: ErrorId | string

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

  console.log(formatStructuredError(error, format))
}

function emitErrorPlain(error: AxiError): void {
  console.error(chalk.red(`✗ ${error.message}`))

  if (error.context) {
    for (const [key, value] of Object.entries(error.context)) {
      if (value !== undefined && value !== null) {
        console.error(chalk.gray(`  ${key}: ${value}`))
      }
    }
  }

  if (error.help) {
    console.error(chalk.gray(`  Help: ${error.help}`))
  }
}
