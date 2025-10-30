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
 * Format data for CLI output based on specified format
 *
 * @param data - The data to format
 * @param options - Formatting options
 * @returns Formatted string ready for output
 *
 * @example
 * // TOON format (default) - uses tab delimiter for 58.9% token savings
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
 * Uses tab delimiter for maximum token efficiency (58.9% savings vs JSON).
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
  // This will be implemented based on the specific data structure
  // For now, return a basic representation
  if (Array.isArray(data)) {
    return formatPlainArray(data, colors)
  }

  if (typeof data === 'object' && data !== null) {
    return formatPlainObject(data, colors)
  }

  return String(data)
}

/**
 * Format array as plain text
 */
function formatPlainArray(data: any[], colors: boolean): string {
  const lines: string[] = []

  for (const item of data) {
    if (typeof item === 'object' && item !== null) {
      lines.push(formatPlainObject(item, colors))
    }
    else {
      lines.push(String(item))
    }
  }

  return lines.join('\n')
}

/**
 * Format object as plain text with key-value pairs
 */
function formatPlainObject(data: Record<string, any>, colors: boolean): string {
  const lines: string[] = []

  for (const [key, value] of Object.entries(data)) {
    const keyLabel = colors ? chalk.bold(key) : key
    if (Array.isArray(value)) {
      lines.push(`${keyLabel}:`)
      lines.push(...value.map(item => `  ${formatPlainValue(item, colors)}`))
    }
    else {
      lines.push(`${keyLabel}: ${formatPlainValue(value, colors)}`)
    }
  }

  return lines.join('\n')
}

/**
 * Format a single value for plain text output
 */
function formatPlainValue(value: any, colors: boolean): string {
  if (typeof value === 'boolean') {
    if (colors) {
      return value ? chalk.green('true') : chalk.yellow('false')
    }
    return String(value)
  }

  if (typeof value === 'object' && value !== null) {
    return formatPlainObject(value, colors)
  }

  return String(value)
}
