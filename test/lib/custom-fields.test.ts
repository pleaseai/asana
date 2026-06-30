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
})
