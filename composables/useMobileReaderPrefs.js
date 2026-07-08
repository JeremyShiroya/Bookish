import { readonly, ref } from 'vue'

// Mobile reader display preferences (Reader → sound-module icon).
// Kept separate from useBookishSettings so the reader page tweaks stay
// self-contained and cheap to extend.

export const MOBILE_READER_PREFS_KEY = 'bookish:mobile-reader-prefs'

export const READING_MODE_OPTIONS = Object.freeze(['page', 'scroll'])
export const READER_BACKGROUND_OPTIONS = Object.freeze(['default', 'sepia'])
// Every reader font must carry real 300-700 weights, otherwise the thickness
// control does nothing: CSS font-matching silently collapses 300 and 500 onto
// 400 when the family has no such face (Georgia only ships 400/700, which is why
// Light/Normal/Medium used to render identically). Literata and General Sans are
// variable/multi-weight; Roboto (Android) covers 300/400/500/700.
export const READER_FONT_OPTIONS = Object.freeze([
  { id: 'serif', label: 'Serif', stack: "Literata, Georgia, 'Times New Roman', serif" },
  { id: 'app', label: 'App font', stack: 'var(--mobile-font-family)' },
  { id: 'sans', label: 'Sans', stack: "Roboto, system-ui, 'Segoe UI', sans-serif" },
])
export const READER_WEIGHT_OPTIONS = Object.freeze([
  { id: 300, label: 'Light' },
  { id: 400, label: 'Normal' },
  { id: 500, label: 'Medium' },
  { id: 700, label: 'Bold' },
])
export const READER_LINE_SPACING_OPTIONS = Object.freeze([1.4, 1.62, 1.8, 2.0])
export const READER_ALIGN_OPTIONS = Object.freeze(['justify', 'left'])
export const READER_FONT_SIZE_MIN = 14
export const READER_FONT_SIZE_MAX = 24

export const DEFAULT_MOBILE_READER_PREFS = Object.freeze({
  readingMode: 'page',      // 'page' (ReadEra-style page turns) | 'scroll'
  background: 'default',    // 'default' (theme) | 'sepia' (book brown)
  fontSize: 17,             // px
  fontFamily: 'serif',      // READER_FONT_OPTIONS id
  fontWeight: 400,
  lineSpacing: 1.62,
  textAlign: 'justify',
})

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export function normalizeMobileReaderPrefs(value) {
  const source = value && typeof value === 'object' ? value : {}
  const fontSize = Number(source.fontSize)
  const fontWeight = Number(source.fontWeight)
  const lineSpacing = Number(source.lineSpacing)
  return {
    readingMode: READING_MODE_OPTIONS.includes(source.readingMode)
      ? source.readingMode
      : DEFAULT_MOBILE_READER_PREFS.readingMode,
    background: READER_BACKGROUND_OPTIONS.includes(source.background)
      ? source.background
      : DEFAULT_MOBILE_READER_PREFS.background,
    fontSize: Number.isFinite(fontSize)
      ? clamp(Math.round(fontSize), READER_FONT_SIZE_MIN, READER_FONT_SIZE_MAX)
      : DEFAULT_MOBILE_READER_PREFS.fontSize,
    fontFamily: READER_FONT_OPTIONS.some((option) => option.id === source.fontFamily)
      ? source.fontFamily
      : DEFAULT_MOBILE_READER_PREFS.fontFamily,
    fontWeight: READER_WEIGHT_OPTIONS.some((option) => option.id === fontWeight)
      ? fontWeight
      : DEFAULT_MOBILE_READER_PREFS.fontWeight,
    lineSpacing: READER_LINE_SPACING_OPTIONS.includes(lineSpacing)
      ? lineSpacing
      : DEFAULT_MOBILE_READER_PREFS.lineSpacing,
    textAlign: READER_ALIGN_OPTIONS.includes(source.textAlign)
      ? source.textAlign
      : DEFAULT_MOBILE_READER_PREFS.textAlign,
  }
}

export function readerFontStack(fontFamilyId) {
  const option = READER_FONT_OPTIONS.find((entry) => entry.id === fontFamilyId)
  return option?.stack || READER_FONT_OPTIONS[0].stack
}

// Any pref that changes text layout invalidates cached page maps.
export function readerPrefsLayoutHash(prefs) {
  return [prefs.fontSize, prefs.fontFamily, prefs.fontWeight, prefs.lineSpacing, prefs.textAlign].join('|')
}

const prefsState = ref({ ...DEFAULT_MOBILE_READER_PREFS })
let loaded = false

export function resetMobileReaderPrefsForTests() {
  prefsState.value = { ...DEFAULT_MOBILE_READER_PREFS }
  loaded = false
}

export const useMobileReaderPrefs = () => {
  const load = () => {
    try {
      const raw = localStorage.getItem(MOBILE_READER_PREFS_KEY)
      prefsState.value = normalizeMobileReaderPrefs(raw ? JSON.parse(raw) : null)
    } catch {
      prefsState.value = { ...DEFAULT_MOBILE_READER_PREFS }
    }
    loaded = true
    return prefsState.value
  }

  if (!loaded && import.meta.client) load()

  const updatePrefs = (patch) => {
    prefsState.value = normalizeMobileReaderPrefs({ ...prefsState.value, ...patch })
    try {
      localStorage.setItem(MOBILE_READER_PREFS_KEY, JSON.stringify(prefsState.value))
    } catch {}
    return prefsState.value
  }

  return { prefs: readonly(prefsState), updatePrefs }
}
