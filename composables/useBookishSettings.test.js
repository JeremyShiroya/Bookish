import { describe, expect, it } from 'vitest'
import {
  BOOKISH_SETTINGS_KEY,
  DEFAULT_BOOKISH_SETTINGS,
  readBookishSettings,
  writeBookishSettings,
} from './useBookishSettings.js'

const createMemoryStorage = () => {
  const data = new Map()

  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear(),
  }
}

describe('useBookishSettings storage helpers', () => {
  it('returns defaults when no saved settings exist', () => {
    expect(readBookishSettings(createMemoryStorage())).toEqual(DEFAULT_BOOKISH_SETTINGS)
  })

  it('persists partial updates with defaults for missing values', () => {
    const storage = createMemoryStorage()

    writeBookishSettings({
      readerTheme: 'dark',
      libraryView: 'table',
      ttsSpeed: 1.5,
    }, storage)

    expect(readBookishSettings(storage)).toMatchObject({
      ...DEFAULT_BOOKISH_SETTINGS,
      readerTheme: 'dark',
      libraryView: 'table',
      ttsSpeed: 1.5,
    })
  })

  it('ignores malformed saved JSON and falls back safely', () => {
    const storage = createMemoryStorage()
    storage.setItem(BOOKISH_SETTINGS_KEY, '{bad json')

    expect(readBookishSettings(storage)).toEqual(DEFAULT_BOOKISH_SETTINGS)
  })

  it('falls back when a hidden Kokoro voice was previously saved', () => {
    const storage = createMemoryStorage()

    writeBookishSettings({ ttsVoice: 'kokoro:af_heart' }, storage)

    expect(readBookishSettings(storage).ttsVoice).toBe(DEFAULT_BOOKISH_SETTINGS.ttsVoice)
  })
})
