import { describe, expect, it } from 'vitest'
import { nextEnabledOptionIndex, normalizeSelectOptions } from './useSelectOptions.js'

describe('custom select option helpers', () => {
  it('normalizes string and object options', () => {
    expect(normalizeSelectOptions([
      'Unread',
      { value: 'voice-1', label: 'Jenny (US)' },
    ])).toEqual([
      { value: 'Unread', label: 'Unread', disabled: false },
      { value: 'voice-1', label: 'Jenny (US)', disabled: false },
    ])
  })

  it('moves through enabled options and wraps at the ends', () => {
    const options = normalizeSelectOptions([
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B', disabled: true },
      { value: 'c', label: 'C' },
    ])

    expect(nextEnabledOptionIndex(options, 0, 1)).toBe(2)
    expect(nextEnabledOptionIndex(options, 2, 1)).toBe(0)
    expect(nextEnabledOptionIndex(options, 0, -1)).toBe(2)
  })
})
