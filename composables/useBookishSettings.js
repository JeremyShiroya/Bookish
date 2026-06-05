import { readonly, ref } from 'vue'

export const BOOKISH_SETTINGS_KEY = 'bookish:settings'

export const DEFAULT_BOOKISH_SETTINGS = Object.freeze({
  readerTheme: 'light',
  readerZoom: 1.0,
  libraryView: 'grid',
  librarySort: 'name',
  librarySortDirection: 'asc',
  libraryItemsPerPage: 20,
  ttsVoice: 'en-US-ChristopherNeural',
  ttsSpeed: 1.0,
  ttsVolume: 1.0,
  metadataAutoFill: true,
})

export const LIBRARY_ITEMS_PER_PAGE_OPTIONS = Object.freeze([10, 20, 30, 50, 100])

const TTS_VOICE_IDS = new Set([
  'en-US-ChristopherNeural',
  'en-US-JennyNeural',
  'en-US-AriaNeural',
  'en-US-GuyNeural',
  'en-US-DavisNeural',
  'en-GB-SoniaNeural',
  'en-GB-RyanNeural',
  'en-AU-NatashaNeural',
])

const settingsState = ref({ ...DEFAULT_BOOKISH_SETTINGS })
let loadedFromStorage = false

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const numberOrDefault = (value, fallback, min, max) => {
  const next = Number(value)
  return Number.isFinite(next) ? clamp(next, min, max) : fallback
}

const voiceOrDefault = (value) => {
  const voice = typeof value === 'string' ? value.trim() : ''
  return TTS_VOICE_IDS.has(voice) ? voice : DEFAULT_BOOKISH_SETTINGS.ttsVoice
}

export function normalizeBookishSettings(value) {
  const source = value && typeof value === 'object' ? value : {}

  return {
    readerTheme: ['light', 'dark'].includes(source.readerTheme)
      ? source.readerTheme
      : DEFAULT_BOOKISH_SETTINGS.readerTheme,
    readerZoom: numberOrDefault(
      source.readerZoom,
      DEFAULT_BOOKISH_SETTINGS.readerZoom,
      0.5,
      2.5
    ),
    libraryView: ['grid', 'table'].includes(source.libraryView)
      ? source.libraryView
      : DEFAULT_BOOKISH_SETTINGS.libraryView,
    librarySort: ['name', 'rating', 'year'].includes(source.librarySort)
      ? source.librarySort
      : DEFAULT_BOOKISH_SETTINGS.librarySort,
    librarySortDirection: ['asc', 'desc'].includes(source.librarySortDirection)
      ? source.librarySortDirection
      : DEFAULT_BOOKISH_SETTINGS.librarySortDirection,
    libraryItemsPerPage: LIBRARY_ITEMS_PER_PAGE_OPTIONS.includes(Number(source.libraryItemsPerPage))
      ? Number(source.libraryItemsPerPage)
      : DEFAULT_BOOKISH_SETTINGS.libraryItemsPerPage,
    ttsVoice: voiceOrDefault(source.ttsVoice),
    ttsSpeed: numberOrDefault(
      source.ttsSpeed,
      DEFAULT_BOOKISH_SETTINGS.ttsSpeed,
      0.5,
      2.5
    ),
    ttsVolume: numberOrDefault(
      source.ttsVolume,
      DEFAULT_BOOKISH_SETTINGS.ttsVolume,
      0,
      1
    ),
    metadataAutoFill: source.metadataAutoFill === undefined
      ? DEFAULT_BOOKISH_SETTINGS.metadataAutoFill
      : source.metadataAutoFill !== false,
  }
}

export function applyBookishTheme(theme) {
  if (typeof document === 'undefined') return

  const normalizedTheme = theme === 'dark' ? 'dark' : 'light'
  document.documentElement.dataset.theme = normalizedTheme
  document.documentElement.style.colorScheme = normalizedTheme
}

const resolveStorage = (storage) => {
  if (storage) return storage
  if (typeof localStorage === 'undefined') return null
  return localStorage
}

export function readBookishSettings(storage) {
  const targetStorage = resolveStorage(storage)
  if (!targetStorage) return { ...DEFAULT_BOOKISH_SETTINGS }

  try {
    const raw = targetStorage.getItem(BOOKISH_SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_BOOKISH_SETTINGS }
    return normalizeBookishSettings({
      ...DEFAULT_BOOKISH_SETTINGS,
      ...JSON.parse(raw),
    })
  } catch {
    return { ...DEFAULT_BOOKISH_SETTINGS }
  }
}

export function writeBookishSettings(nextSettings, storage) {
  const normalized = normalizeBookishSettings({
    ...DEFAULT_BOOKISH_SETTINGS,
    ...nextSettings,
  })
  const targetStorage = resolveStorage(storage)

  if (targetStorage) {
    try {
      targetStorage.setItem(BOOKISH_SETTINGS_KEY, JSON.stringify(normalized))
    } catch {
      // localStorage can fail in private browsing or quota-limited contexts.
    }
  }

  return normalized
}

export function resetBookishSettingsForTests() {
  settingsState.value = { ...DEFAULT_BOOKISH_SETTINGS }
  loadedFromStorage = false
}

export const useBookishSettings = () => {
  const loadSettings = () => {
    settingsState.value = readBookishSettings()
    applyBookishTheme(settingsState.value.readerTheme)
    loadedFromStorage = true
    return settingsState.value
  }

  if (!loadedFromStorage && import.meta.client) {
    loadSettings()
  }

  const updateSettings = (patch) => {
    settingsState.value = writeBookishSettings({
      ...settingsState.value,
      ...patch,
    })
    applyBookishTheme(settingsState.value.readerTheme)
    loadedFromStorage = true
    return settingsState.value
  }

  const setSetting = (key, value) => updateSettings({ [key]: value })

  return {
    settings: readonly(settingsState),
    loadSettings,
    updateSettings,
    setSetting,
  }
}
