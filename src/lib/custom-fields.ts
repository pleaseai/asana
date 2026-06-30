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

/** A single user referenced by a `people`-type custom field. */
export interface CustomFieldUser {
  gid: string
  name?: string
}

/** A single enum option selected on an `enum`/`multi_enum` field. */
export interface CustomFieldOption {
  gid: string
  name?: string
}

/** The raw value of a `date`-type field (ISO date, optional ISO date-time). */
export interface CustomFieldDate {
  date?: string
  date_time?: string | null
}

/** Compact summary of a custom field value as read from a task. */
export interface TaskCustomFieldSummary {
  gid: string
  name?: string
  type: string
  value: string
  /** Present only for `people`-type fields: the assigned users with their gids. */
  people?: CustomFieldUser[]
  /** Present only for `enum`-type fields: the selected option, or `null` if unset. */
  enum_option?: CustomFieldOption | null
  /** Present only for `multi_enum`-type fields: the selected options. */
  enum_options?: CustomFieldOption[]
  /** Present only for `date`-type fields: the raw ISO value, or `null` if unset. */
  date?: CustomFieldDate | null
}

function toOption(option: any): CustomFieldOption {
  return { gid: option.gid, name: option.name }
}

/**
 * Map a raw Asana task custom field into the compact summary the CLI prints.
 *
 * `value` keeps the documented `display_value` string for every type, so the
 * shape stays backward compatible. For types whose `display_value` hides
 * machine-readable data, the structured value is surfaced as an extra key so
 * JSON consumers can read it:
 *
 * - `people` → `people`: assigned users with their `gid`s (needed for @-mentions)
 * - `enum` → `enum_option`: the selected option `{gid, name}`, or `null`
 * - `multi_enum` → `enum_options`: the selected options `[{gid, name}]`
 * - `date` → `date`: the raw `{date, date_time}` ISO value, or `null`
 */
export function mapTaskCustomField(field: any): TaskCustomFieldSummary {
  const type = field.resource_subtype ?? 'unknown'
  const summary: TaskCustomFieldSummary = {
    gid: field.gid,
    name: field.name,
    type,
    value: field.display_value ?? '',
  }

  switch (type) {
    case 'people':
      summary.people = (field.people_value ?? []).map((user: any) => ({
        gid: user.gid,
        name: user.name,
      }))
      break

    case 'enum':
      summary.enum_option = field.enum_value ? toOption(field.enum_value) : null
      break

    case 'multi_enum':
      summary.enum_options = (field.multi_enum_values ?? []).map(toOption)
      break

    case 'date':
      summary.date = field.date_value
        ? { date: field.date_value.date, date_time: field.date_value.date_time ?? null }
        : null
      break
  }

  return summary
}

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
