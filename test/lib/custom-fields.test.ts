import type { CustomFieldDefinition } from '../../src/lib/custom-fields'
import { describe, expect, test } from 'bun:test'
import { coerceCustomFieldValue, mapTaskCustomField } from '../../src/lib/custom-fields'
import { ValidationError } from '../../src/lib/validators'

const TEXT_FIELD: CustomFieldDefinition = {
  gid: '100',
  name: 'Description',
  resource_subtype: 'text',
}

const NUMBER_FIELD: CustomFieldDefinition = {
  gid: '200',
  name: 'Estimate',
  resource_subtype: 'number',
}

const ENUM_FIELD: CustomFieldDefinition = {
  gid: '300',
  name: 'Priority',
  resource_subtype: 'enum',
  enum_options: [
    { gid: '301', name: 'High', enabled: true },
    { gid: '302', name: 'Low', enabled: true },
    { gid: '303', name: 'Deprecated', enabled: false },
  ],
}

describe('coerceCustomFieldValue', () => {
  describe('text fields', () => {
    test('passes text values through unchanged', () => {
      expect(coerceCustomFieldValue(TEXT_FIELD, 'hello world')).toBe('hello world')
    })
  })

  describe('number fields', () => {
    test('parses numeric strings', () => {
      expect(coerceCustomFieldValue(NUMBER_FIELD, '42.5')).toBe(42.5)
    })

    test('throws ValidationError for non-numeric values', () => {
      expect(() => coerceCustomFieldValue(NUMBER_FIELD, 'abc')).toThrow(ValidationError)
    })

    test('throws ValidationError for empty values', () => {
      expect(() => coerceCustomFieldValue(NUMBER_FIELD, '  ')).toThrow(ValidationError)
    })
  })

  describe('enum fields', () => {
    test('resolves an option by name (case-insensitive)', () => {
      expect(coerceCustomFieldValue(ENUM_FIELD, 'high')).toBe('301')
    })

    test('resolves an option by GID', () => {
      expect(coerceCustomFieldValue(ENUM_FIELD, '302')).toBe('302')
    })

    test('ignores disabled options', () => {
      expect(() => coerceCustomFieldValue(ENUM_FIELD, 'Deprecated')).toThrow(ValidationError)
    })

    test('throws ValidationError for unknown options', () => {
      expect(() => coerceCustomFieldValue(ENUM_FIELD, 'Urgent')).toThrow(ValidationError)
    })
  })

  describe('unsupported field types', () => {
    test('throws ValidationError for multi_enum fields', () => {
      const field: CustomFieldDefinition = { gid: '400', resource_subtype: 'multi_enum' }

      expect(() => coerceCustomFieldValue(field, 'x')).toThrow(ValidationError)
    })

    test('falls back to the legacy `type` property', () => {
      const field: CustomFieldDefinition = { gid: '500', type: 'text' }

      expect(coerceCustomFieldValue(field, 'legacy')).toBe('legacy')
    })
  })
})

describe('mapTaskCustomField', () => {
  test('maps a text field to gid/name/type/value', () => {
    const field = {
      gid: '100',
      name: 'Description',
      resource_subtype: 'text',
      display_value: 'hello',
    }

    expect(mapTaskCustomField(field)).toEqual({
      gid: '100',
      name: 'Description',
      type: 'text',
      value: 'hello',
    })
  })

  test('defaults missing type to unknown and missing display value to empty string', () => {
    expect(mapTaskCustomField({ gid: '101', name: 'Mystery' })).toEqual({
      gid: '101',
      name: 'Mystery',
      type: 'unknown',
      value: '',
    })
  })

  test('does not add a people array for non-people fields', () => {
    const mapped = mapTaskCustomField({
      gid: '102',
      name: 'Priority',
      resource_subtype: 'enum',
      display_value: 'High',
    })

    expect(mapped).not.toHaveProperty('people')
  })

  test('exposes people_value gids for people fields alongside the display value', () => {
    const field = {
      gid: '200',
      name: 'Reporter',
      resource_subtype: 'people',
      display_value: 'Minsu Lee, Jane Doe',
      people_value: [
        { gid: '111', name: 'Minsu Lee' },
        { gid: '222', name: 'Jane Doe' },
      ],
    }

    expect(mapTaskCustomField(field)).toEqual({
      gid: '200',
      name: 'Reporter',
      type: 'people',
      value: 'Minsu Lee, Jane Doe',
      people: [
        { gid: '111', name: 'Minsu Lee' },
        { gid: '222', name: 'Jane Doe' },
      ],
    })
  })

  test('returns an empty people array for an unset people field', () => {
    const mapped = mapTaskCustomField({
      gid: '201',
      name: 'Reporter',
      resource_subtype: 'people',
      display_value: '',
    })

    expect(mapped.people).toEqual([])
    expect(mapped.value).toBe('')
  })

  test('exposes the selected option gid for enum fields', () => {
    const field = {
      gid: '300',
      name: 'Priority',
      resource_subtype: 'enum',
      display_value: 'High',
      enum_value: { gid: '301', name: 'High', color: 'red', enabled: true },
    }

    expect(mapTaskCustomField(field)).toEqual({
      gid: '300',
      name: 'Priority',
      type: 'enum',
      value: 'High',
      enum_option: { gid: '301', name: 'High' },
    })
  })

  test('returns a null enum_option for an unset enum field', () => {
    const mapped = mapTaskCustomField({
      gid: '301',
      name: 'Priority',
      resource_subtype: 'enum',
      display_value: '',
    })

    expect(mapped.enum_option).toBeNull()
  })

  test('exposes selected option gids for multi_enum fields', () => {
    const field = {
      gid: '400',
      name: 'Teams',
      resource_subtype: 'multi_enum',
      display_value: 'Backend, Frontend',
      multi_enum_values: [
        { gid: '401', name: 'Backend', enabled: true },
        { gid: '402', name: 'Frontend', enabled: true },
      ],
    }

    expect(mapTaskCustomField(field)).toEqual({
      gid: '400',
      name: 'Teams',
      type: 'multi_enum',
      value: 'Backend, Frontend',
      enum_options: [
        { gid: '401', name: 'Backend' },
        { gid: '402', name: 'Frontend' },
      ],
    })
  })

  test('returns an empty enum_options array for an unset multi_enum field', () => {
    const mapped = mapTaskCustomField({
      gid: '401',
      name: 'Teams',
      resource_subtype: 'multi_enum',
      display_value: '',
    })

    expect(mapped.enum_options).toEqual([])
  })

  test('exposes the raw ISO date for date fields', () => {
    const field = {
      gid: '500',
      name: 'Launch',
      resource_subtype: 'date',
      display_value: 'July 1, 2026',
      date_value: { date: '2026-07-01', date_time: null },
    }

    expect(mapTaskCustomField(field)).toEqual({
      gid: '500',
      name: 'Launch',
      type: 'date',
      value: 'July 1, 2026',
      date: { date: '2026-07-01', date_time: null },
    })
  })

  test('preserves the date_time component when present', () => {
    const mapped = mapTaskCustomField({
      gid: '501',
      name: 'Launch',
      resource_subtype: 'date',
      display_value: 'July 1, 2026 09:00',
      date_value: { date: '2026-07-01', date_time: '2026-07-01T09:00:00.000Z' },
    })

    expect(mapped.date).toEqual({ date: '2026-07-01', date_time: '2026-07-01T09:00:00.000Z' })
  })

  test('returns a null date for an unset date field', () => {
    const mapped = mapTaskCustomField({
      gid: '502',
      name: 'Launch',
      resource_subtype: 'date',
      display_value: '',
    })

    expect(mapped.date).toBeNull()
  })

  test('falls back to the legacy `type` property when resource_subtype is absent', () => {
    const field = {
      gid: '700',
      name: 'Reporter',
      type: 'people',
      display_value: 'Minsu Lee',
      people_value: [{ gid: '111', name: 'Minsu Lee' }],
    }

    expect(mapTaskCustomField(field)).toEqual({
      gid: '700',
      name: 'Reporter',
      type: 'people',
      value: 'Minsu Lee',
      people: [{ gid: '111', name: 'Minsu Lee' }],
    })
  })

  test('does not add typed keys from other types onto a text field', () => {
    const mapped = mapTaskCustomField({
      gid: '600',
      name: 'Notes',
      resource_subtype: 'text',
      display_value: 'hi',
    })

    expect(mapped).not.toHaveProperty('people')
    expect(mapped).not.toHaveProperty('enum_option')
    expect(mapped).not.toHaveProperty('enum_options')
    expect(mapped).not.toHaveProperty('date')
  })
})
