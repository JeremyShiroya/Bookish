import { readonly, ref } from 'vue'

export const BOOKISH_SETTINGS_KEY = 'bookish:settings'

export const DEFAULT_BOOKISH_SETTINGS = Object.freeze({
  readerTheme: 'light',
  readerZoom: 1.0,
  libraryView: 'grid',
  groupDetailView: 'table',
  librarySort: 'name',
  librarySortDirection: 'asc',
  libraryGridItemsPerPage: 12,
  libraryTableItemsPerPage: 10,
  ttsVoice: 'en-US-ChristopherNeural',
  ttsSpeed: 1.0,
  ttsVolume: 1.0,
  metadataAutoFill: true,
  trackSplitting: false,
  // ── Appearance preferences (Settings → Preferences) ──────────────────────
  seriesCardBackground: 'blank',   // 'blank' | 'blur'
  seriesCardLayout: 'fan',         // 'fan' (books centered) | 'cover'
  favouritesCardBackground: 'blur',// 'blur' | 'blank'
  favouritesCardLayout: 'grid',    // 'grid' | 'list' (set from the Favourites controls row)
  playlistCardBackground: 'blank', // 'blur' | 'blank' — matches series default
  playlistCardLayout: 'fan',       // 'fan' | 'cover' — matches series default
  readerHighlight: true,           // highlight the section being read
  listenCoverBlur: true,           // blurred cover backdrop in Listen mode
  showStreak: true,                // reading-streak pill in the top nav
  formatFilter: 'all',             // 'all' | 'pdf' | 'epub' — legacy, see useLibraryFilters
  hideContent: false,              // preview the app as though the library were empty
  // Show the series installments you don't own yet. ON by default: it is the
  // answer to "which book do I read next", it needs no setup, and a reader who
  // never opens Preferences would otherwise never discover it exists. Resolution
  // is cached and happens in the background, so it costs nothing visible.
  seriesSuggestions: true,
  // Which formats the app handles AT ALL. Removing one is not a filter: those
  // books are purged from the library and the device scanner stops detecting
  // that extension, so the app really does become an EPUB-only (or PDF-only)
  // reader. Files on the device are never touched.
  enabledFormats: ['epub', 'pdf'],
  formatChoiceMade: false,         // the first-boot chooser has been answered
})

export const SUPPORTED_FORMATS = Object.freeze(['epub', 'pdf'])

// 'both' | 'epub' | 'pdf' — the shape the chooser and the Preferences row speak.
export const formatModeFor = (enabledFormats) => {
  const list = normalizeEnabledFormats(enabledFormats)
  if (list.length === SUPPORTED_FORMATS.length) return 'both'
  return list[0]
}

export const enabledFormatsForMode = (mode) => (
  mode === 'epub' || mode === 'pdf' ? [mode] : [...SUPPORTED_FORMATS]
)

// An empty list would leave the app unable to open anything, so it falls back to
// every supported format rather than bricking the library.
export function normalizeEnabledFormats(value) {
  const list = Array.isArray(value)
    ? [...new Set(value.map((entry) => String(entry || '').toLowerCase()))]
        .filter((entry) => SUPPORTED_FORMATS.includes(entry))
    : []
  return list.length ? SUPPORTED_FORMATS.filter((format) => list.includes(format)) : [...SUPPORTED_FORMATS]
}

export const isFormatEnabled = (book, enabledFormats) => (
  normalizeEnabledFormats(enabledFormats).includes(String(book?.format || '').toLowerCase())
)

// The extension test the device scanner and the file picker share, so "the app
// no longer sees PDFs" is true at every entry point rather than at some of them.
export const enabledExtensionPattern = (enabledFormats) => (
  new RegExp(`\\.(${normalizeEnabledFormats(enabledFormats).join('|')})$`, 'i')
)

export const enabledAcceptAttribute = (enabledFormats) => (
  normalizeEnabledFormats(enabledFormats).map((format) => `.${format}`).join(',')
)

export const CARD_BACKGROUND_OPTIONS = Object.freeze(['blank', 'blur'])
export const SERIES_CARD_LAYOUT_OPTIONS = Object.freeze(['fan', 'cover'])
export const PLAYLIST_CARD_LAYOUT_OPTIONS = Object.freeze(['fan', 'cover'])
export const FAVOURITES_CARD_LAYOUT_OPTIONS = Object.freeze(['grid', 'list'])
export const FORMAT_FILTER_OPTIONS = Object.freeze(['all', 'pdf', 'epub'])

// The pills every library Filter panel renders under its "Format" heading.
export const FORMAT_FILTER_CHOICES = Object.freeze([
  { value: 'all', label: 'All' },
  { value: 'epub', label: 'EPUB' },
  { value: 'pdf', label: 'PDF' },
])

// Books carry `format` as a free-form string; 'all' matches everything.
export const matchesFormatFilter = (book, format) => (
  !format || format === 'all'
    ? true
    : String(book?.format || '').toLowerCase() === format
)

export const LIBRARY_GRID_ITEMS_PER_PAGE_OPTIONS = Object.freeze([6, 8, 10, 12])
export const LIBRARY_TABLE_ITEMS_PER_PAGE_OPTIONS = Object.freeze([8, 10, 20, 30, 50, 100])

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
  const legacyPageSize = Number(source.libraryItemsPerPage)
  const legacyGridPageSize = LIBRARY_GRID_ITEMS_PER_PAGE_OPTIONS.includes(legacyPageSize)
    ? legacyPageSize
    : DEFAULT_BOOKISH_SETTINGS.libraryGridItemsPerPage
  const legacyTablePageSize = LIBRARY_TABLE_ITEMS_PER_PAGE_OPTIONS.includes(legacyPageSize)
    && legacyPageSize <= DEFAULT_BOOKISH_SETTINGS.libraryTableItemsPerPage
    ? legacyPageSize
    : DEFAULT_BOOKISH_SETTINGS.libraryTableItemsPerPage

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
    groupDetailView: ['grid', 'table'].includes(source.groupDetailView)
      ? source.groupDetailView
      : DEFAULT_BOOKISH_SETTINGS.groupDetailView,
    librarySort: ['name', 'rating', 'year', 'added'].includes(source.librarySort)
      ? source.librarySort
      : DEFAULT_BOOKISH_SETTINGS.librarySort,
    librarySortDirection: ['asc', 'desc'].includes(source.librarySortDirection)
      ? source.librarySortDirection
      : DEFAULT_BOOKISH_SETTINGS.librarySortDirection,
    libraryGridItemsPerPage: LIBRARY_GRID_ITEMS_PER_PAGE_OPTIONS.includes(Number(source.libraryGridItemsPerPage))
      ? Number(source.libraryGridItemsPerPage)
      : legacyGridPageSize,
    libraryTableItemsPerPage: LIBRARY_TABLE_ITEMS_PER_PAGE_OPTIONS.includes(Number(source.libraryTableItemsPerPage))
      ? Number(source.libraryTableItemsPerPage)
      : legacyTablePageSize,
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
    trackSplitting: source.trackSplitting === undefined
      ? DEFAULT_BOOKISH_SETTINGS.trackSplitting
      : source.trackSplitting === true,
    seriesCardBackground: CARD_BACKGROUND_OPTIONS.includes(source.seriesCardBackground)
      ? source.seriesCardBackground
      : DEFAULT_BOOKISH_SETTINGS.seriesCardBackground,
    seriesCardLayout: SERIES_CARD_LAYOUT_OPTIONS.includes(source.seriesCardLayout)
      ? source.seriesCardLayout
      : DEFAULT_BOOKISH_SETTINGS.seriesCardLayout,
    favouritesCardBackground: CARD_BACKGROUND_OPTIONS.includes(source.favouritesCardBackground)
      ? source.favouritesCardBackground
      : DEFAULT_BOOKISH_SETTINGS.favouritesCardBackground,
    favouritesCardLayout: FAVOURITES_CARD_LAYOUT_OPTIONS.includes(source.favouritesCardLayout)
      ? source.favouritesCardLayout
      : DEFAULT_BOOKISH_SETTINGS.favouritesCardLayout,
    playlistCardBackground: CARD_BACKGROUND_OPTIONS.includes(source.playlistCardBackground)
      ? source.playlistCardBackground
      : DEFAULT_BOOKISH_SETTINGS.playlistCardBackground,
    playlistCardLayout: PLAYLIST_CARD_LAYOUT_OPTIONS.includes(source.playlistCardLayout)
      ? source.playlistCardLayout
      : DEFAULT_BOOKISH_SETTINGS.playlistCardLayout,
    readerHighlight: source.readerHighlight === undefined
      ? DEFAULT_BOOKISH_SETTINGS.readerHighlight
      : source.readerHighlight !== false,
    listenCoverBlur: source.listenCoverBlur === undefined
      ? DEFAULT_BOOKISH_SETTINGS.listenCoverBlur
      : source.listenCoverBlur !== false,
    showStreak: source.showStreak === undefined
      ? DEFAULT_BOOKISH_SETTINGS.showStreak
      : source.showStreak !== false,
    formatFilter: FORMAT_FILTER_OPTIONS.includes(source.formatFilter)
      ? source.formatFilter
      : DEFAULT_BOOKISH_SETTINGS.formatFilter,
    hideContent: source.hideContent === true,
    // undefined means "never chosen", which must fall through to the default —
    // `=== true` would pin every existing install to off no matter what the
    // default says, so flipping the default alone would change nothing.
    seriesSuggestions: source.seriesSuggestions === undefined
      ? DEFAULT_BOOKISH_SETTINGS.seriesSuggestions
      : source.seriesSuggestions !== false,
    enabledFormats: normalizeEnabledFormats(source.enabledFormats),
    formatChoiceMade: source.formatChoiceMade === true,
  }
}

export function applyBookishTheme(theme) {
  if (typeof document === 'undefined') return

  const normalizedTheme = theme === 'dark' ? 'dark' : 'light'
  document.documentElement.dataset.theme = normalizedTheme
  document.documentElement.style.colorScheme = normalizedTheme
  syncSystemBarAppearance(normalizedTheme === 'dark')
}

// The Android status and navigation bars are transparent, so the app's own
// background already shows through them in either theme — but their ICONS do
// not follow, and dark icons on the dark theme were unreadable. Android exposes
// that only as a window flag, so the theme switch tells the native side here.
// Fire-and-forget and fully optional: on the web (or before the bridge is up)
// there is simply nothing to call.
function syncSystemBarAppearance(dark) {
  try {
    const bridge = globalThis.Capacitor
    if (!bridge?.isNativePlatform?.()) return
    bridge.Plugins?.SystemBars?.setAppearance?.({ dark })?.catch?.(() => {})
  } catch {
    // Bridge not ready or plugin missing — the bars keep their current icons.
  }
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
    return normalizeBookishSettings(JSON.parse(raw))
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
