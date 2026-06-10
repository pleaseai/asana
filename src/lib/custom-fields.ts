/**
 * Custom field value coercion.
 *
 * The Asana API expects typed values per field type (number for `number`
 * fields, enum option GID for `enum` fields, string for `text` fields).
 * The CLI receives everything as strings, so we coerce based on the field
 * definition fetched from the API.
 */

import chalk from 'chalk'
import { ERROR_IDS } from '../constants/errorIds'
import { ValidationError } from './validators'

export interface CustomFieldDefinition {
  gid: string
  name?: string
  type?: string
  resource_subtype?: string
  enum_options?: Array<{ gid: string, name: string, enabled?: boolean }>
}

export const SUPPORTED_CUSTOM_FIELD_TYPES = ['text', 'number', 'enum'] as const

/**
 * Coerce a raw CLI string into the value the Asana API expects for the field.
 *
 * - `text`: passed through as-is
 * - `number`: parsed as a finite number
 * - `enum`: resolved to an enum option GID (accepts option name or GID)
 */
export function coerceCustomFieldValue(field: CustomFieldDefinition, rawValue: string): string | number {
  const type = field.resource_subtype ?? field.type

  switch (type) {
    case 'text':
      return rawValue

    case 'number': {
      const parsed = Number(rawValue)
      if (rawValue.trim() === '' || !Number.isFinite(parsed)) {
        console.error(chalk.red(`✗ Invalid number value for custom field "${field.name ?? field.gid}"`))
        console.error(chalk.gray(`  Provided: ${rawValue}`))
        throw new ValidationError(
          ERROR_IDS.INVALID_CUSTOM_FIELD_VALUE,
          'Invalid number value for custom field',
          { fieldGid: field.gid, rawValue },
        )
      }
      return parsed
    }

    case 'enum': {
      const options = (field.enum_options ?? []).filter(option => option.enabled !== false)
      const match = options.find(
        option => option.gid === rawValue || option.name.toLowerCase() === rawValue.toLowerCase(),
      )
      if (!match) {
        console.error(chalk.red(`✗ Unknown enum option for custom field "${field.name ?? field.gid}"`))
        console.error(chalk.gray(`  Provided: ${rawValue}`))
        console.error(chalk.gray(`  Available options: ${options.map(option => option.name).join(', ') || '(none)'}`))
        throw new ValidationError(
          ERROR_IDS.INVALID_CUSTOM_FIELD_VALUE,
          'Unknown enum option for custom field',
          { fieldGid: field.gid, rawValue },
        )
      }
      return match.gid
    }

    default:
      console.error(chalk.red(`✗ Unsupported custom field type: ${type ?? 'unknown'}`))
      console.error(chalk.gray(`  Supported types: ${SUPPORTED_CUSTOM_FIELD_TYPES.join(', ')}`))
      throw new ValidationError(
        ERROR_IDS.UNSUPPORTED_CUSTOM_FIELD_TYPE,
        'Unsupported custom field type',
        { fieldGid: field.gid, type },
      )
  }
}
