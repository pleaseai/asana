import { encodeToon } from '@pleaseai/cli-toolkit/output'
import chalk from 'chalk'

/**
 * Output format types supported by the CLI
 */
export type OutputFormat = 'toon' | 'json' | 'plain'

/**
 * Options for formatting output
 */
export interface FormatterOptions {
  /**
   * Output format type
   */
  format: OutputFormat

  /**
   * Enable colored output (only applies to plain format)
   */
  colors?: boolean
}

/**
 * Resolve the output format from a Commander command, including the global
 * `--format` option declared on the root program.
 *
 * Works for arbitrarily nested subcommands (e.g. `task subtask list`) because
 * `optsWithGlobals()` merges options from the command and all of its parents.
 */
export function getOutputFormat(command: { optsWithGlobals: () => Record<string, any> }): OutputFormat {
  return (command.optsWithGlobals().format || 'toon') as OutputFormat
}

/**
 * Format data for CLI output based on specified format
 *
 * @param data - The data to format
 * @param options - Formatting options
 * @returns Formatted string ready for output
 *
 * @example
 * // TOON format (default) - uses tab delimiter, ~37% token savings vs JSON
 * formatOutput({ tasks: [{ id: 1, name: 'Task 1' }] }, { format: 'toon' })
 * // Output: tasks[1<TAB>]{id<TAB>name}:\n  1<TAB>Task 1
 *
 * @example
 * // JSON format
 * formatOutput({ tasks: [{ id: 1, name: 'Task 1' }] }, { format: 'json' })
 * // Output: {"tasks":[{"id":1,"name":"Task 1"}]}
 *
 * @example
 * // Plain format
 * formatOutput({ tasks: [{ id: 1, name: 'Task 1' }] }, { format: 'plain', colors: true })
 * // Output: Tasks (1):\n  ○ 1 - Task 1
 */
export function formatOutput(data: any, options: FormatterOptions): string {
  const { format, colors = false } = options

  switch (format) {
    case 'toon':
      return formatToon(data)
    case 'json':
      return formatJson(data)
    case 'plain':
      return formatPlain(data, colors)
    default:
      throw new Error(`Unsupported format: ${format}`)
  }
}

/**
 * Format data as TOON (Token-Oriented Object Notation)
 *
 * Uses tab delimiter for token efficiency: ~37% savings vs JSON, measured
 * with the o200k/cl100k tokenizers on TaskView-shaped list output (10-200
 * rows). Savings on single-item detail views with long notes are ~6%.
 * Powered by @pleaseai/cli-toolkit.
 *
 * @param data - The data to format
 * @returns TOON-formatted string with tab delimiters
 */
function formatToon(data: any): string {
  return encodeToon(data)
}

/**
 * Format data as JSON
 *
 * @param data - The data to format
 * @returns JSON-formatted string with 2-space indentation
 */
function formatJson(data: any): string {
  return JSON.stringify(data, null, 2)
}

/**
 * Format data as plain text (human-readable)
 *
 * @param data - The data to format
 * @param colors - Whether to enable colored output
 * @returns Plain text formatted string
 */
function formatPlain(data: any, colors: boolean): string {
  if (Array.isArray(data)) {
    return formatPlainArray(data, colors, '')
  }

  if (typeof data === 'object' && data !== null) {
    return formatPlainObject(data, colors, '')
  }

  return String(data)
}

/**
 * Format array as plain text. Each item starts with a `- ` marker and every
 * continuation line is indented to align under the marker.
 */
function formatPlainArray(data: any[], colors: boolean, indent: string): string {
  const itemIndent = `${indent}  `

  return data
    .map((item) => {
      if (Array.isArray(item)) {
        const body = formatPlainArray(item, colors, itemIndent)
        return `${indent}- ${body.slice(itemIndent.length)}`
      }
      if (typeof item === 'object' && item !== null) {
        const body = formatPlainObject(item, colors, itemIndent)
        // Replace the first line's indent with the `- ` marker.
        return `${indent}- ${body.slice(itemIndent.length)}`
      }
      // Indent continuation lines of multiline strings under the marker.
      const scalar = formatPlainScalar(item, colors).split('\n').join(`\n${indent}  `)
      return `${indent}- ${scalar}`
    })
    .join('\n')
}

/**
 * Format object as plain text with key-value pairs. Keys with `undefined` or
 * `null` values are omitted — plain output is human-facing, and empty fields
 * are noise there (json keeps null for scripting).
 */
function formatPlainObject(data: Record<string, any>, colors: boolean, indent: string): string {
  const lines: string[] = []

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) {
      continue
    }
    const keyLabel = colors ? chalk.bold(key) : key
    if (Array.isArray(value)) {
      const body = formatPlainArray(value, colors, `${indent}  `)
      lines.push(`${indent}${keyLabel}:`)
      if (body) {
        lines.push(body)
      }
    }
    else if (typeof value === 'object') {
      const body = formatPlainObject(value, colors, `${indent}  `)
      lines.push(`${indent}${keyLabel}:`)
      if (body) {
        lines.push(body)
      }
    }
    else {
      // Indent continuation lines of multiline strings under their key.
      const scalar = formatPlainScalar(value, colors).split('\n').join(`\n${indent}  `)
      lines.push(`${indent}${keyLabel}: ${scalar}`)
    }
  }

  return lines.join('\n')
}

/**
 * Format a scalar value for plain text output
 */
function formatPlainScalar(value: any, colors: boolean): string {
  if (typeof value === 'boolean' && colors) {
    return value ? chalk.green('true') : chalk.yellow('false')
  }

  return String(value)
}
