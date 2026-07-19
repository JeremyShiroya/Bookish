import { computed } from 'vue'
import { useState } from '#app'
import { useApiEndpoint } from '~/composables/useApiEndpoint'
import { synthesizeDesktopSpeech } from '~/composables/tts/desktopTtsDriver'
import { synthesizeMobileSpeech, resetMobileTtsDriver } from '~/composables/tts/mobileTtsDriver'
import { createNativeSpeechAudio, loadNativeVoices } from '~/composables/tts/nativeSpeech'
import { isNativeCapacitorPlatform } from '~/composables/useNativePlatform'
import { firstChunkForPage } from '~/composables/usePdfManifest'
import { useBookishSettings } from '~/composables/useBookishSettings'

let _currentAudio = null
let _prefetchChunk = null        // { chunkIdx, audio, boundaries }
let _prefetchGeneration = 0      // incremented on cancel to invalidate in-flight pre-fetches
let _chunks = []
let _chunkIdx = 0
let _currentBoundaries = []      // word boundaries for the currently playing chunk
let _rafId = null                // requestAnimationFrame handle for word-highlight loop
let _onlineListenerBound = false // useTTS() runs per-component; bind the listener once

const DEFAULT_SENTENCE_MAX_CHARS = 480
const AUDIO_CACHE_LIMIT = 8
const WORDS_PER_MIN = 145
export const BOOKISH_TTS_SESSION_KEY = 'bookish:tts-session'

const EDGE_VOICES = [
  { id: 'en-US-ChristopherNeural', name: 'Christopher (US)' },
  { id: 'en-US-JennyNeural',       name: 'Jenny (US)' },
  { id: 'en-US-AriaNeural',        name: 'Aria (US)' },
  { id: 'en-US-GuyNeural',         name: 'Guy (US)' },
  { id: 'en-US-DavisNeural',       name: 'Davis (US)' },
  { id: 'en-GB-SoniaNeural',       name: 'Sonia (UK)' },
  { id: 'en-GB-RyanNeural',        name: 'Ryan (UK)' },
  { id: 'en-AU-NatashaNeural',     name: 'Natasha (AU)' },
]

const DEFAULT_TTS_VOICE = EDGE_VOICES[0].id
const KOKORO_VOICE_PREFIX = 'kokoro:'

let _audioCache = new Map()
let _prewarmCache = new Map()
const PREWARM_CACHE_LIMIT = 4

const isKokoroVoice = (voiceId) => String(voiceId || '').startsWith(KOKORO_VOICE_PREFIX)
const normalizeAvailableVoice = (voiceId) => {
  const nextVoice = String(voiceId || '').trim()
  if (isKokoroVoice(nextVoice)) return DEFAULT_TTS_VOICE
  return EDGE_VOICES.some(voice => voice.id === nextVoice) ? nextVoice : DEFAULT_TTS_VOICE
}

const resolveStorage = () => {
  if (typeof localStorage === 'undefined') return null
  return localStorage
}

export function readStoredTtsSession(storage = resolveStorage()) {
  if (!storage) return null

  try {
    const raw = storage.getItem(BOOKISH_TTS_SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    if (!session?.bookId) return null

    return {
      bookId: session.bookId,
      chunkIdx: Math.max(0, Number(session.chunkIdx) || 0),
      totalChunks: Math.max(0, Number(session.totalChunks) || 0),
      progress: Math.max(0, Math.min(100, Number(session.progress) || 0)),
      elapsedSeconds: Math.max(0, Number(session.elapsedSeconds) || 0),
      totalSeconds: Math.max(0, Number(session.totalSeconds) || 0),
      currentChunk: typeof session.currentChunk === 'string' ? session.currentChunk : '',
      updatedAt: session.updatedAt || null,
    }
  } catch {
    return null
  }
}

export function writeStoredTtsSession(session, storage = resolveStorage()) {
  if (!storage || !session?.bookId) return null

  const normalized = {
    bookId: session.bookId,
    chunkIdx: Math.max(0, Number(session.chunkIdx) || 0),
    totalChunks: Math.max(0, Number(session.totalChunks) || 0),
    progress: Math.max(0, Math.min(100, Number(session.progress) || 0)),
    elapsedSeconds: Math.max(0, Number(session.elapsedSeconds) || 0),
    totalSeconds: Math.max(0, Number(session.totalSeconds) || 0),
    currentChunk: typeof session.currentChunk === 'string' ? session.currentChunk : '',
    updatedAt: session.updatedAt || new Date().toISOString(),
  }

  try {
    storage.setItem(BOOKISH_TTS_SESSION_KEY, JSON.stringify(normalized))
  } catch {
    // localStorage can fail in private browsing or quota-limited contexts.
  }

  return normalized
}

export function clearStoredTtsSession(storage = resolveStorage()) {
  storage?.removeItem?.(BOOKISH_TTS_SESSION_KEY)
}

export function takeMatchingPrefetch(prefetch, chunkIdx, chunkText) {
  return prefetch?.chunkIdx === chunkIdx && prefetch?.chunkText === chunkText
    ? prefetch
    : null
}

export function ttsPrewarmKey(text, voice, speed) {
  return `${String(text || '')}::${String(voice || '')}::${String(speed || '')}`
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    for (const item of _audioCache.values()) {
      if (item?.objectUrl) URL.revokeObjectURL(item.audio)
    }
    _audioCache.clear()
  })
}

// ── Pure helpers (exported for tests) ─────────────────────────────────────

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', hellip: '…',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  laquo: '«', raquo: '»', shy: '', copy: '©', reg: '®', trade: '™',
  eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç',
  auml: 'ä', ouml: 'ö', uuml: 'ü',
}

export function decodeEntities(text) {
  if (!text) return ''
  let result = text
  if (result.includes('&')) {
    result = result
      .replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
        try { return String.fromCodePoint(parseInt(hex, 16)) } catch { return match }
      })
      .replace(/&#(\d+);/g, (match, num) => {
        try { return String.fromCodePoint(Number(num)) } catch { return match }
      })
      .replace(/&([a-z]+);/gi, (match, name) => {
        const key = name.toLowerCase()
        return key in NAMED_ENTITIES ? NAMED_ENTITIES[key] : match
      })
  }
  // Strip soft hyphens and zero-width characters that break text matching
  return result.replace(/[\u00AD\u200B-\u200D\uFEFF]/g, '')
}

export function stripHtml(html) {
  if (!html) return ''
  const text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<hr[^>]*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
  return decodeEntities(text)
    .replace(/\s+/g, ' ')
    .trim()
}

function splitLongSentence(sentence, maxChars) {
  const result = []
  const words = sentence.split(/\s+/).filter(Boolean)
  let buffer = ''

  for (const word of words) {
    if (buffer && `${buffer} ${word}`.length > maxChars) {
      result.push(buffer)
      buffer = word
    } else {
      buffer = buffer ? `${buffer} ${word}` : word
    }
  }

  if (buffer) result.push(buffer)
  return result
}

export function splitToChunks(text, maxChars = DEFAULT_SENTENCE_MAX_CHARS) {
  const normalized = (text || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return []

  // Closing quotes (straight and curly) after the terminator belong to this
  // sentence — absorbing them keeps highlight boundaries on sentence edges.
  const sentences = normalized.match(/[^.!?]+(?:[.!?]+["'’”»)\]]*)?|[.!?]+/g) || [normalized]
  const chunks = []

  for (const sentence of sentences) {
    const trimmed = sentence.trim()
    if (!trimmed) continue

    if (trimmed.length <= maxChars) {
      chunks.push(trimmed)
    } else {
      chunks.push(...splitLongSentence(trimmed, maxChars))
    }
  }

  return chunks
}

export function groupChunks(chunks, maxChars = DEFAULT_SENTENCE_MAX_CHARS) {
  const grouped = []
  let buffer = ''

  for (const chunk of chunks) {
    const next = chunk?.trim()
    if (!next) continue
    if (buffer && `${buffer} ${next}`.length > maxChars) {
      grouped.push(buffer)
      buffer = next
    } else {
      buffer = buffer ? `${buffer} ${next}` : next
    }
  }

  if (buffer) grouped.push(buffer)
  return grouped
}

// A content section is renderable if it has real text or visible media.
// Shared by the EPUB extractor, the reader, and the boundary builder so
// section indexes stay aligned with stored tocTitles.
export function isRenderableSection(html) {
  if (!html) return false
  if (html.replace(/<[^>]+>/g, '').trim().length > 3) return true
  return /<(img|image|svg)\b/i.test(html)
}

const SECTION_TITLE_PATTERN = /^((?:Chapter|Part|Book)\s+(?:\d{1,4}|[IVXLCDM]+|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty)\b.{0,60}?|Prologue|Epilogue|Interlude|Preface|Foreword|Introduction|Afterword)/i

// Splits assembled EPUB content into its renderable `<hr chapter-break>`
// sections (the same parts the reader renders as `ch-N` elements and the
// EPUB extractor emits one tocTitle per).
export function splitContentSections(html) {
  if (!html) return []
  const cleaned = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  return cleaned
    .split(/<hr[^>]*chapter-break[^>]*\/?>/i)
    .filter(isRenderableSection)
}

// Canonical readable-chunk builder shared by TTS playback, the reader's flat
// chunk list, and the highlighter. EPUBs are chunked SECTION-BY-SECTION and
// concatenated — never as one joined blob — so a chunk never straddles a
// `<hr chapter-break>`. That keeps chunk indices in perfect lockstep with
// section boundaries: chapter splits and "read from here" resolve to the exact
// sentence the reader shows, instead of drifting because cross-section
// sentence-splitting produced a different total. Returns the flat chunk list
// plus per-section chunk counts (for chapter-boundary math).
export function buildReadableChunks(html) {
  const parts = splitContentSections(html)
  if (parts.length < 2) {
    const chunks = splitToChunks(stripHtml(html || ''))
    return { chunks, sectionCounts: [chunks.length] }
  }
  const chunks = []
  const sectionCounts = []
  for (const part of parts) {
    const partChunks = splitToChunks(stripHtml(part))
    sectionCounts.push(partChunks.length)
    for (const chunk of partChunks) chunks.push(chunk)
  }
  return { chunks, sectionCounts }
}

export function resolvePlaybackChunks({
  format = '',
  html = '',
  explicitChunks = [],
} = {}) {
  if (String(format).toLowerCase() === 'pdf' && Array.isArray(explicitChunks)) {
    return explicitChunks
      .map(chunk => String(chunk || '').trim())
      .filter(Boolean)
  }
  return buildReadableChunks(html).chunks
}

export function chunkIndexForProgress(progress, sectionCounts, contentStart = 0) {
  const counts = Array.isArray(sectionCounts) ? sectionCounts : []
  const totalChunks = counts.reduce((sum, count) => sum + Math.max(0, Number(count) || 0), 0)
  const safeContentStart = Math.max(0, Math.min(Math.max(0, totalChunks - 1), Number(contentStart) || 0))
  const safeProgress = Math.max(0, Math.min(100, Number(progress) || 0))
  if (safeProgress <= 0 || counts.length <= 1) return safeContentStart

  const targetSection = Math.round((safeProgress / 100) * Math.max(0, counts.length - 1))
  let offset = 0
  for (let index = 0; index < targetSection; index += 1) {
    offset += Math.max(0, Number(counts[index]) || 0)
  }
  return Math.max(safeContentStart, Math.min(Math.max(0, totalChunks - 1), offset))
}

export function chunkIndexForPdfProgress(progress, manifest, contentStart = 0) {
  const pages = Array.isArray(manifest?.pages) ? manifest.pages : []
  if (!pages.length) return Math.max(0, Number(contentStart) || 0)

  const safeProgress = Math.max(0, Math.min(100, Number(progress) || 0))
  if (safeProgress <= 0) return Math.max(0, Number(contentStart) || 0)

  const maxPage = pages.reduce((max, page) => Math.max(max, Number(page?.page) || 0), 1)
  const targetPage = Math.round((safeProgress / 100) * Math.max(0, maxPage - 1)) + 1
  return firstChunkForPage(manifest, targetPage)?.id ?? Math.max(0, Number(contentStart) || 0)
}

// Builds [{ chunkStart, chunkEnd, title }] from EPUB content HTML so the
// playing bar can render chapter segments that MATCH the reader's table of
// contents one-to-one.
//
// EPUBs are often split into one file per few PAGES, not per chapter. The
// reader's TOC shows exactly the sections that carry a chapter title
// (tocTitles[i]); every untitled section belongs to the titled chapter before
// it. We mirror that here: one segment per titled section, starting at that
// section's chunk offset and running until the next titled section. Because
// section chunk counts come from the same per-section split as
// `buildReadableChunks`, every chunkStart is an exact index into the TTS chunk
// array — clicking a split lands on the right chapter. Without TOC data we fall
// back to heading / "Chapter N" detection. Returns [] when fewer than two
// chapters are found (PDFs, flat text) so the bar shows a single fill.
export function buildChapterBoundariesFromHtml(html, totalChunks, tocTitles = []) {
  if (!html || !totalChunks || totalChunks <= 0) return []

  const parts = splitContentSections(html)
  if (parts.length < 2) return []

  const titles = Array.isArray(tocTitles) ? tocTitles : []
  const hasToc = titles.some(title => title && String(title).trim())

  const sectionTitle = (part, index) => {
    if (hasToc) {
      const title = titles[index]
      return title && String(title).trim() ? String(title).trim().slice(0, 80) : null
    }
    const headingMatch = part.match(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/i)
    if (headingMatch) {
      const heading = headingMatch[2].replace(/<[^>]+>/g, '').trim()
      if (heading && heading.length <= 120) return heading.slice(0, 80)
    }
    const text = part.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const patternMatch = text.match(SECTION_TITLE_PATTERN)
    return patternMatch ? patternMatch[1].trim().slice(0, 80) : null
  }

  // Cumulative chunk offset + resolved title for every section.
  const sections = []
  let offset = 0
  parts.forEach((part, index) => {
    sections.push({ offset, title: sectionTitle(part, index) })
    offset += splitToChunks(stripHtml(part)).length
  })

  // Chapters = sections that begin a titled TOC entry (identical to the set
  // the reader renders in its sidebar), so the bar and TOC never diverge.
  const starts = sections.filter(section => section.title)
  if (starts.length < 2) return []

  const boundaries = starts.map((section, index) => {
    const next = starts[index + 1]
    const chunkStart = Math.min(section.offset, totalChunks - 1)
    const chunkEnd = next ? Math.min(next.offset - 1, totalChunks - 1) : totalChunks - 1
    return {
      chunkStart,
      chunkEnd: Math.max(chunkStart, chunkEnd),
      title: section.title,
    }
  })

  // Pin the last segment to the true end so the bar always covers the track.
  boundaries[boundaries.length - 1].chunkEnd = totalChunks - 1
  return boundaries
}

export function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0))
  const h = Math.floor(safeSeconds / 3600)
  const m = Math.floor((safeSeconds % 3600) / 60)
  const s = safeSeconds % 60

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

export async function resolveReadableText(book, stored = null) {
  const htmlText = stripHtml(book?.content || stored?.content || '')
  if (htmlText.trim()) return htmlText

  const isPdf = (book?.format || stored?.format || '').toLowerCase() === 'pdf'
  if (!isPdf || !stored?.source) return ''

  const { extractPdfTextFromSource } = await import('~/composables/usePdfExtractor.js')
  return await extractPdfTextFromSource(stored.source)
}

// ── Copyright / frontmatter skip ──────────────────────────────────────────

const MAX_SCAN_CHUNKS = 60
const TOC_WINDOW      = 40

const STRONG_COPYRIGHT = [
  /©/,
  /\bISBN[-–\s]?\d/i,
  /\beISBN\b/i,
  /all rights reserved/i,
  /library of congress/i,
  /cataloging.{0,20}publication/i,
  /no part of this (?:book|publication|work)/i,
  /transmitted in any form/i,
  /any resemblance.*?(?:coincidental|purely fictitious)/i,
  /permission.*?publisher/i,
  /published.*?permission/i,
]

const WEAK_COPYRIGHT = [
  /\bcopyright\b/i,
  /work of fiction/i,
  /printed in/i,
  /first (?:published|edition|printing)/i,
  /\bpublished by\b/i,
  /moral rights/i,
  /\bregistered trademark\b/i,
  /\bimprint\b/i,
  /\bpublishing group\b/i,
  /\bdivision of\b.*\bpublish/i,
]

function _isCopyrightChunk(text) {
  if (STRONG_COPYRIGHT.some(re => re.test(text))) return true
  return WEAK_COPYRIGHT.filter(re => re.test(text)).length >= 2
}

const TOC_HEADING_RE = /\btable of contents\b/i

const TOC_ENTRY_PATTERNS = [
  /\.{4,}/,
  /\b(?:chapter|part|section|epilogue|prologue|preface|afterword|appendix|interlude|note to reader)\s+(?:\d{1,3}|[ivxlcdm]{1,6})\b/i,
]

function _isTocEntryChunk(text) {
  if (TOC_ENTRY_PATTERNS.some(re => re.test(text))) return true
  const sectionWords = (text.match(/\b(?:chapter|part|section|epilogue|prologue|appendix|interlude)\b/gi) || []).length
  return sectionWords >= 3 && /\d/.test(text)
}

const OTHER_FRONTMATTER = [
  /\balso by\b/i,
  /\bpraise for\b/i,
  /\badvance praise\b/i,
  /\babout the author\b/i,
  /\bauthor's? note\b/i,
  /\ba note (?:on|about) the\b/i,
]

const PROSE_WORDS_RE = /\b(?:the|was|had|were|said|walked|looked|felt|knew|thought|turned|could|would|began|came|went|saw|heard|made|told|found|gave|took|seemed|left|wanted|stood|called|asked|answered|smiled|laughed|whispered|cried|ran|sat|lay|rose|fell|opened|closed|started|stopped|reached|pulled|pushed|held|kept|brought|put|got|set|let|led|read|heard|felt|showed|happened|became|followed|stayed|continued|moved|picked|carried|carried|tried|used|passed|played|worked|lived|died|returned|waited|watched|listened|remembered|understood|realized|decided|noticed|felt|seemed|appeared|remained|looked|seemed|sounded|smelled|tasted|touched)\b/i

function _isLikelyProse(text) {
  if (text.length < 60) return false
  if (!/[.!?]/.test(text)) return false
  return PROSE_WORDS_RE.test(text)
}

function _isBoilerplate(text) {
  return (
    _isCopyrightChunk(text) ||
    OTHER_FRONTMATTER.some(re => re.test(text)) ||
    TOC_HEADING_RE.test(text) ||
    _isTocEntryChunk(text)
  )
}

export function findContentStart(chunks) {
  const limit = Math.min(chunks.length, MAX_SCAN_CHUNKS)
  let lastBoilerplateIdx = -1
  let tocWindowEnd = -1

  for (let i = 0; i < limit; i++) {
    const chunk = chunks[i]

    if (_isBoilerplate(chunk)) {
      lastBoilerplateIdx = i
      if (TOC_HEADING_RE.test(chunk)) {
        tocWindowEnd = Math.min(i + TOC_WINDOW, limit - 1)
      }
    } else if (tocWindowEnd > 0 && i <= tocWindowEnd) {
      if (_isLikelyProse(chunk)) {
        tocWindowEnd = -1
      } else {
        lastBoilerplateIdx = i
      }
    }
  }

  if (lastBoilerplateIdx === -1) return 0
  return Math.min(lastBoilerplateIdx + 1, MAX_SCAN_CHUNKS)
}

// ── Composable ─────────────────────────────────────────────────────────────

// Synthesize one sentence of speech by delegating to the platform's own,
// independent TTS driver:
//   • desktop/web → composables/tts/desktopTtsDriver (server /api/tts)
//   • native app  → composables/tts/mobileTtsDriver  (WebView Edge + device-voice
//                    fallback, returned as a { native: true } marker)
// The two drivers are isolated so a change to one platform never affects the
// other. Returns either { audio, boundaries } or { native, text, voice, speed }.
async function synthesizeSpeech({ text, voice, speed, apiUrl, apiBaseUrl }) {
  if (isNativeCapacitorPlatform()) {
    return synthesizeMobileSpeech({ text, voice, speed, apiUrl, apiBaseUrl })
  }
  return synthesizeDesktopSpeech({ text, voice, speed, apiUrl })
}

export const useTTS = () => {
  const { settings, updateSettings } = useBookishSettings()
  const { apiUrl, apiBaseUrl } = useApiEndpoint()

  const ttsBook         = useState('tts:book',         () => null)
  const ttsStatus       = useState('tts:status',       () => 'idle')
  const ttsProgress     = useState('tts:progress',     () => 0)
  const ttsChunkIdx     = useState('tts:chunkIdx',     () => 0)
  const ttsTotalChunks  = useState('tts:totalChunks',  () => 0)
  const ttsElapsedSeconds = useState('tts:elapsedSeconds', () => 0)
  const ttsTotalSeconds = useState('tts:totalSeconds', () => 0)
  const ttsSpeed        = useState('tts:speed',        () => settings.value.ttsSpeed)
  const ttsVolume       = useState('tts:volume',       () => settings.value.ttsVolume)
  const ttsVoiceId      = useState('tts:voice',        () => normalizeAvailableVoice(settings.value.ttsVoice))
  const ttsVoices       = useState('tts:voices',       () => EDGE_VOICES)
  // The phone's built-in TTS voices (offline). Loaded on demand so the narrator
  // picker can offer real device voices when Edge is unavailable.
  const ttsNativeVoices = useState('tts:nativeVoices', () => [])
  // Index into ttsNativeVoices the user explicitly chose (-1 = auto-map).
  const ttsNativeVoiceIdx = useState('tts:nativeVoiceIdx', () => -1)
  // True while narration is actually coming out of the phone's TTS engine.
  // The narrator picker keys off this rather than navigator.onLine, which an
  // Android WebView reports as `true` for any network interface — a phone on
  // Wi-Fi with no working internet still claimed to be online, so the picker
  // kept listing Edge voices the device could not reach.
  const ttsUsingDeviceVoice = useState('tts:usingDeviceVoice', () => false)
  const ttsCurrentChunk = useState('tts:currentChunk', () => '')
  const ttsPlayingChunkIdx = useState('tts:playingChunkIdx', () => -1)
  const ttsPlayingChunkText = useState('tts:playingChunkText', () => '')
  // Word-level highlight: index into the boundary array for the current chunk
  const ttsWordIdx      = useState('tts:wordIdx',      () => -1)
  // The boundary array for the currently-playing chunk (populated from TTS response)
  const ttsBoundaries   = useState('tts:boundaries',   () => [])
  // Chapter boundaries for track splitting: [{ chunkStart, chunkEnd, title }]
  const ttsChapterBoundaries = useState('tts:chapterBoundaries', () => [])

  const { getBookContent } = useBookStorage()

  // Coming back online is the clearest signal that a device-voice fallback is
  // stale, so re-probe Edge immediately instead of waiting out the cooldown.
  if (import.meta.client && !_onlineListenerBound) {
    _onlineListenerBound = true
    window.addEventListener('online', () => resetMobileTtsDriver())
  }

  const normalizedVoice = normalizeAvailableVoice(ttsVoiceId.value)
  if (ttsVoiceId.value !== normalizedVoice) {
    ttsVoiceId.value = normalizedVoice
    updateSettings({ ttsVoice: normalizedVoice })
  }

  const _estimatedChunkSeconds = (chunk) => {
    const words = (chunk?.match(/\S+/g) || []).length || 1
    return (words / WORDS_PER_MIN) * 60 / ttsSpeed.value
  }

  const _persistSession = () => {
    if (!ttsBook.value?.id) return

    writeStoredTtsSession({
      bookId: ttsBook.value.id,
      chunkIdx: _chunks.length ? _chunkIdx : ttsChunkIdx.value,
      totalChunks: ttsTotalChunks.value,
      progress: ttsProgress.value,
      elapsedSeconds: ttsElapsedSeconds.value,
      totalSeconds: ttsTotalSeconds.value,
      currentChunk: ttsCurrentChunk.value,
      updatedAt: new Date().toISOString(),
    })
  }

  const elapsedTime = computed(() => {
    return formatDuration(ttsElapsedSeconds.value)
  })

  const totalTime = computed(() => {
    if (ttsTotalSeconds.value <= 0) return '--'
    return formatDuration(ttsTotalSeconds.value)
  })

  // ── Internal helpers ───────────────────────────────────────────────────────

  const _updateProgress = () => {
    ttsChunkIdx.value = _chunkIdx
    ttsCurrentChunk.value = _chunks[_chunkIdx] || ''
    ttsElapsedSeconds.value = _chunks
      .slice(0, Math.max(0, _chunkIdx))
      .reduce((sum, chunk) => sum + _estimatedChunkSeconds(chunk), 0)
    ttsTotalSeconds.value = _chunks.reduce((sum, chunk) => sum + _estimatedChunkSeconds(chunk), 0)
    ttsProgress.value = ttsTotalChunks.value > 0
      ? Math.round((_chunkIdx / ttsTotalChunks.value) * 100)
      : 0
    _persistSession()
  }

  const _audioCacheKey = (chunkIdx) => (
    `${ttsBook.value?.id || ''}:${chunkIdx}:${ttsVoiceId.value}:${ttsSpeed.value}`
  )

  const _cacheAudio = (chunkIdx, data) => {
    if (!data?.audio) return
    const key = _audioCacheKey(chunkIdx)
    if (_audioCache.has(key)) {
      const old = _audioCache.get(key)
      if (old?.objectUrl) URL.revokeObjectURL(old.audio)
      _audioCache.delete(key)
    }
    _audioCache.set(key, data)
    while (_audioCache.size > AUDIO_CACHE_LIMIT) {
      const oldestKey = _audioCache.keys().next().value
      const oldest = _audioCache.get(oldestKey)
      if (oldest?.objectUrl) URL.revokeObjectURL(oldest.audio)
      _audioCache.delete(oldestKey)
    }
  }

  const _getCachedAudio = (chunkIdx, chunkText) => {
    const key = _audioCacheKey(chunkIdx)
    const cached = _audioCache.get(key) ?? null
    if (cached?.chunkText === chunkText) return cached
    if (cached) _audioCache.delete(key)
    return null
  }

  const _clearAudioCache = () => {
    for (const item of _audioCache.values()) {
      if (item?.objectUrl) URL.revokeObjectURL(item.audio)
    }
    _audioCache.clear()
    _prewarmCache.clear()
  }

  // ── Background keep-alive ──────────────────────────────────────────────────
  //
  // Narration is a chain of one-sentence <audio> elements. Between two chunks
  // the page emits NO audio for a moment, and a backgrounded WebView that is
  // not producing audio gets its timers throttled (and its process frozen) by
  // Android — so the `onended` handler that starts the next sentence never ran
  // and playback stalled at a sentence boundary while the UI still said
  // "playing". A silent looping track plays for the whole narration session, so
  // the media element chain is never empty and the audio session stays alive
  // across chunk boundaries.
  let _keepAlive = null
  let _keepAliveUrl = null

  // The keep-alive track is the first stream to open the shared audio output, so
  // its format decides the output format: an 8kHz mono track forced the device
  // into narrowband and resampled the narration down with it — the voices came
  // out boxy, like a phone call. Match ordinary device output (48kHz stereo) so
  // nothing about the speech is renegotiated or resampled.
  const KEEPALIVE_SAMPLE_RATE = 48000
  const KEEPALIVE_CHANNELS = 2

  const _silentLoopUrl = () => {
    if (_keepAliveUrl) return _keepAliveUrl
    // 0.5s of 48kHz 16-bit stereo silence — a real WAV, built at runtime.
    const frames = KEEPALIVE_SAMPLE_RATE / 2
    const bytesPerFrame = KEEPALIVE_CHANNELS * 2
    const dataBytes = frames * bytesPerFrame
    const buffer = new ArrayBuffer(44 + dataBytes)
    const view = new DataView(buffer)
    const ascii = (offset, text) => {
      for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
    }
    ascii(0, 'RIFF')
    view.setUint32(4, 36 + dataBytes, true)
    ascii(8, 'WAVEfmt ')
    view.setUint32(16, 16, true)                                  // fmt chunk size
    view.setUint16(20, 1, true)                                   // PCM
    view.setUint16(22, KEEPALIVE_CHANNELS, true)                  // stereo
    view.setUint32(24, KEEPALIVE_SAMPLE_RATE, true)
    view.setUint32(28, KEEPALIVE_SAMPLE_RATE * bytesPerFrame, true) // byte rate
    view.setUint16(32, bytesPerFrame, true)                       // block align
    view.setUint16(34, 16, true)                                  // bits per sample
    ascii(36, 'data')
    view.setUint32(40, dataBytes, true)
    // Samples stay zero — the buffer is already zero-filled.
    _keepAliveUrl = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
    return _keepAliveUrl
  }

  const _startKeepAlive = () => {
    if (!import.meta.client || _keepAlive) return
    try {
      const audio = new Audio(_silentLoopUrl())
      audio.loop = true
      // The samples are pure silence, so nothing is ever heard. Keep the gain
      // NON-zero all the same: a muted / zero-volume element can be treated as
      // "not producing audio", which would let the output stream close between
      // sentences — the very stall this track exists to prevent.
      audio.volume = 0.001
      _keepAlive = audio
      audio.play().catch(() => {
        // Autoplay blocked (no gesture yet) — narration itself still plays.
        _keepAlive = null
      })
    } catch {
      _keepAlive = null
    }
  }

  const _stopKeepAlive = () => {
    if (!_keepAlive) return
    _keepAlive.pause()
    _keepAlive.src = ''
    _keepAlive = null
  }

  const _cancelAudio = () => {
    if (_currentAudio) {
      _currentAudio.onended = null
      _currentAudio.onerror = null
      // Device-voice player: fully cancel the utterance, not just pause it.
      if (_currentAudio.stop) _currentAudio.stop()
      else _currentAudio.pause()
      _currentAudio = null
    }
    _prefetchChunk = null
    _prefetchGeneration++
    ttsPlayingChunkIdx.value = -1
    ttsPlayingChunkText.value = ''
    // Stop the word-highlight rAF loop
    if (_rafId !== null) { cancelAnimationFrame(_rafId); _rafId = null }
    _currentBoundaries = []
  }

  // Returns { audio: dataUrl, boundaries: [...] } or null
  const _fetchChunkAudio = async (chunkIdx) => {
    const chunk = _chunks[chunkIdx]
    if (!chunk) return null
    const cached = _getCachedAudio(chunkIdx, chunk)
    if (cached) return cached

    const voice = normalizeAvailableVoice(ttsVoiceId.value)
    const prewarmKey = ttsPrewarmKey(chunk, voice, ttsSpeed.value)
    const prewarmed = _prewarmCache.get(prewarmKey)
    if (prewarmed) {
      _prewarmCache.delete(prewarmKey)
      const result = {
        chunkIdx,
        chunkText: chunk,
        audio: prewarmed.audio,
        boundaries: prewarmed.boundaries ?? [],
      }
      _cacheAudio(chunkIdx, result)
      return result
    }

    try {
      const data = await synthesizeSpeech({
        text: chunk,
        voice,
        speed: ttsSpeed.value,
        apiUrl,
        apiBaseUrl,
      })
      const result = {
        chunkIdx,
        chunkText: chunk,
        audio: data.audio ?? null,
        boundaries: data.boundaries ?? [],
        // Device-voice marker: no pre-synthesized audio; the engine speaks it
        // live via the Web Speech API when it reaches this chunk.
        native: !!data.native,
        nativeText: data.native ? (data.text ?? chunk) : undefined,
        nativeVoice: data.native ? data.voice : undefined,
      }
      _cacheAudio(chunkIdx, result)
      return result
    } catch (err) {
      console.warn('[TTS] fetch error:', err)
      return null
    }
  }

  // rAF loop: maps audio.currentTime → the current word boundary index
  const _startWordLoop = (wordBoundaries) => {
    if (_rafId !== null) { cancelAnimationFrame(_rafId); _rafId = null }
    if (!wordBoundaries.length) return
    const loop = () => {
      if (!_currentAudio || ttsStatus.value !== 'playing') { _rafId = null; return }
      const t = _currentAudio.currentTime
      // Binary search: find the last boundary whose offset ≤ currentTime
      let lo = 0, hi = wordBoundaries.length - 1, found = -1
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        if (wordBoundaries[mid].offset <= t) { found = mid; lo = mid + 1 }
        else hi = mid - 1
      }
      if (found !== -1 && found !== ttsWordIdx.value) ttsWordIdx.value = found
      _rafId = requestAnimationFrame(loop)
    }
    _rafId = requestAnimationFrame(loop)
  }

  const _syncWordIndexForTime = (time) => {
    if (!_currentBoundaries.length) return
    let found = -1
    for (let i = 0; i < _currentBoundaries.length; i++) {
      if (_currentBoundaries[i].offset <= time) found = i
      else break
    }
    if (found !== -1) ttsWordIdx.value = found
  }

  // A chunk that fails to synthesize is retried before narration gives up.
  // Backgrounded WebViews get throttled sockets, so a failure there usually
  // means "try again in a moment", not "the endpoint is gone" — bailing out
  // used to silently end the book, or swap the narrator to the device voice.
  const CHUNK_RETRY_LIMIT = 4
  const CHUNK_RETRY_DELAY_MS = 1200

  const _speakNextEdge = async (retryCount = 0) => {
    // Capture generation at call time — if _cancelAudio() fires mid-await,
    // the generation increments and we know to abort.
    const myGen = _prefetchGeneration

    if (_chunkIdx >= _chunks.length) {
      ttsStatus.value = 'idle'
      ttsProgress.value = 100
      ttsCurrentChunk.value = ''
      _stopKeepAlive()
      _persistSession()
      return
    }
    _updateProgress()
    const requestedChunkIdx = _chunkIdx
    const requestedChunkText = _chunks[requestedChunkIdx] || ''

    // Show the sentence highlight immediately, before the audio fetch returns.
    // Any non-success path below resets these to -1 / ''.
    ttsPlayingChunkIdx.value = requestedChunkIdx
    ttsPlayingChunkText.value = requestedChunkText

    // Use pre-fetched result if available, otherwise fetch now
    let chunkData = null
    const prefetched = takeMatchingPrefetch(
      _prefetchChunk,
      requestedChunkIdx,
      requestedChunkText,
    )
    if (prefetched) {
      chunkData = {
        audio: prefetched.audio,
        boundaries: prefetched.boundaries ?? [],
        native: !!prefetched.native,
        nativeText: prefetched.nativeText,
        nativeVoice: prefetched.nativeVoice,
      }
      _prefetchChunk = null
    } else {
      _prefetchChunk = null
      chunkData = await _fetchChunkAudio(requestedChunkIdx)
    }

    // Bail if cancel/seek/voice-switch happened while we were awaiting the fetch
    if (_prefetchGeneration !== myGen) return
    if (ttsStatus.value !== 'playing') return
    if (_chunkIdx !== requestedChunkIdx || _chunks[requestedChunkIdx] !== requestedChunkText) return

    if (!chunkData || (!chunkData.audio && !chunkData.native)) {
      // Retry this same sentence with backoff before declaring failure, so a
      // throttled socket in the background can't end the book (or force a
      // narrator-voice switch) on one bad fetch.
      if (retryCount < CHUNK_RETRY_LIMIT) {
        setTimeout(() => {
          if (_prefetchGeneration !== myGen || ttsStatus.value !== 'playing') return
          if (_chunkIdx !== requestedChunkIdx) return
          _speakNextEdge(retryCount + 1)
        }, CHUNK_RETRY_DELAY_MS * (retryCount + 1))
        return
      }

      const { addToast } = useToast()
      addToast('TTS failed — check your connection.', 'error')
      ttsPlayingChunkIdx.value = -1
      ttsPlayingChunkText.value = ''
      ttsStatus.value = 'idle'
      _stopKeepAlive()
      return
    }

    // Build the player: a device-voice speaker for native chunks (no timed word
    // boundaries → highlighting is skipped), otherwise an <audio> element.
    let audio
    if (chunkData.native) {
      const voices = await loadNativeVoices()
      // Re-check generation: loading device voices can await on first use.
      if (_prefetchGeneration !== myGen || ttsStatus.value !== 'playing') return
      if (_chunkIdx !== requestedChunkIdx || _chunks[requestedChunkIdx] !== requestedChunkText) return
      // Keep the exposed device-voice list fresh for the narrator picker.
      if (voices.length && voices.length !== ttsNativeVoices.value.length) ttsNativeVoices.value = voices
      ttsUsingDeviceVoice.value = true
      audio = createNativeSpeechAudio({
        text: chunkData.nativeText ?? requestedChunkText,
        voice: chunkData.nativeVoice ?? normalizeAvailableVoice(ttsVoiceId.value),
        speed: ttsSpeed.value,
        volume: ttsVolume.value,
        voices,
        nativeVoiceIndex: ttsNativeVoiceIdx.value,
      })
      chunkData.boundaries = []
    } else {
      ttsUsingDeviceVoice.value = false
      audio = new Audio(chunkData.audio)
    }
    audio.volume = ttsVolume.value
    _currentAudio = audio
    _currentBoundaries = chunkData.boundaries ?? []
    ttsBoundaries.value = _currentBoundaries   // expose via reactive state
    ttsWordIdx.value = -1                       // reset word index for new chunk
    ttsPlayingChunkIdx.value = requestedChunkIdx
    ttsPlayingChunkText.value = requestedChunkText

    // Pre-fetch next chunk while this one plays
    const nextIdx = _chunkIdx + 1
    if (nextIdx < _chunks.length) {
      const gen = _prefetchGeneration
      _fetchChunkAudio(nextIdx).then(result => {
        if (_prefetchGeneration === gen && result) {
          _prefetchChunk = result
        }
      })
    }

    // Warm one more chunk ahead into the per-index audio cache.
    const nextIdx2 = _chunkIdx + 2
    if (nextIdx2 < _chunks.length) {
      _fetchChunkAudio(nextIdx2).catch(() => {})
    }

    audio.onended = () => {
      if (_currentAudio !== audio) return
      _currentAudio = null
      if (ttsStatus.value === 'playing') {
        _chunkIdx++
        _updateProgress()
        _speakNextEdge()
      }
    }

    audio.onerror = () => {
      if (_currentAudio !== audio) return
      _currentAudio = null
      ttsPlayingChunkIdx.value = -1
      ttsPlayingChunkText.value = ''
      const { addToast } = useToast()
      addToast('TTS failed — check your connection.', 'error')
      ttsStatus.value = 'idle'
      _stopKeepAlive()
    }

    const playGen = _prefetchGeneration
    audio.play().then(() => {
      _startWordLoop(_currentBoundaries)
    }).catch(() => {
      if (_prefetchGeneration === playGen && _currentAudio === audio) {
        _currentAudio = null
        ttsPlayingChunkIdx.value = -1
        ttsPlayingChunkText.value = ''
        ttsStatus.value = 'idle'
        _stopKeepAlive()
      }
    })
  }

  const _stopInternal = () => {
    _cancelAudio()
    _stopKeepAlive()
    _clearAudioCache()
    _chunks = []
    _chunkIdx = 0
    ttsCurrentChunk.value = ''
    ttsPlayingChunkIdx.value = -1
    ttsPlayingChunkText.value = ''
    ttsWordIdx.value = -1
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  const play = async (book, options = {}) => {
    _stopInternal()
    ttsBook.value = book
    ttsStatus.value = 'loading'
    ttsVoiceId.value = normalizeAvailableVoice(ttsVoiceId.value)

    let stored = null
    if (!book?.content || !book?.tocTitles) {
      try {
        stored = await getBookContent(book.id)
      } catch (e) {
        console.error('[TTS] Failed to load book content from storage:', e)
      }
    }

    const html = book?.content || stored?.content || ''
    let sentenceChunks = []
    let sectionCounts = []
    const format = String(book?.format || stored?.format || '').toLowerCase()
    const storedPdfChunks = stored?.pdfManifest?.chunks?.map(chunk => chunk.text) || []
    const explicitPdfChunks = Array.isArray(options.chunks) && options.chunks.length
      ? options.chunks
      : storedPdfChunks
    if (format === 'pdf' && explicitPdfChunks.length) {
      sentenceChunks = resolvePlaybackChunks({
        format,
        html,
        explicitChunks: explicitPdfChunks,
      })
    } else if (stripHtml(html).trim() && format !== 'pdf') {
      // EPUB / HTML: chunk section-by-section so chunk indices stay aligned
      // with chapter boundaries and the reader's highlight spans.
      const readable = buildReadableChunks(html)
      sentenceChunks = readable.chunks
      sectionCounts = readable.sectionCounts
    } else {
      // PDF / plain text: no chapter-break sections, chunk the extracted text.
      let text = ''
      try {
        text = await resolveReadableText(book, stored)
      } catch (e) {
        console.error('[TTS] Failed to extract readable PDF text:', e)
      }
      sentenceChunks = splitToChunks(text)
      sectionCounts = [sentenceChunks.length]
    }

    if (!sentenceChunks.length) {
      const { addToast } = useToast()
      addToast('This book has no readable text content for audio playback.', 'error')
      ttsStatus.value = 'idle'
      ttsBook.value = null
      return
    }

    const contentStart = findContentStart(sentenceChunks)
    const hasRequestedChunkIdx = Number.isFinite(Number(options.startChunkIdx))
    const requestedChunkIdx = hasRequestedChunkIdx
      ? Number(options.startChunkIdx)
      : format === 'pdf' && stored?.pdfManifest
        ? chunkIndexForPdfProgress(book?.progress, stored.pdfManifest, contentStart)
        : chunkIndexForProgress(book?.progress, sectionCounts, contentStart)
    _chunks = sentenceChunks
    const startChunkIdx = Math.max(0, Math.min(_chunks.length - 1, requestedChunkIdx ?? contentStart))
    _chunkIdx = hasRequestedChunkIdx ? startChunkIdx : Math.max(contentStart, startChunkIdx)
    ttsTotalChunks.value = _chunks.length
    ttsChapterBoundaries.value = buildChapterBoundariesFromHtml(
      book?.content || stored?.content || '',
      _chunks.length,
      book?.tocTitles || stored?.tocTitles || [],
    )
    _updateProgress()

    if (contentStart > 0 && _chunkIdx === contentStart) {
      const { addToast } = useToast()
      addToast('Skipped copyright page — starting at content.', 'info')
    }

    ttsStatus.value = 'playing'
    _startKeepAlive()
    _speakNextEdge()
  }

  const pause = () => {
    if (ttsStatus.value !== 'playing') return
    ttsStatus.value = 'paused'
    _currentAudio?.pause()
    _stopKeepAlive()
    _persistSession()
  }

  const resume = () => {
    if (ttsStatus.value !== 'paused') return
    ttsStatus.value = 'playing'
    _startKeepAlive()
    if (_currentAudio) {
      _currentAudio.play().then(() => {
        _startWordLoop(_currentBoundaries)
      }).catch(() => {
        if (ttsStatus.value === 'playing') {
          ttsStatus.value = 'idle'
        }
      })
    } else if (_chunks.length) {
      _speakNextEdge()
    } else if (ttsBook.value) {
      play(ttsBook.value, { startChunkIdx: ttsChunkIdx.value })
    }
  }

  const togglePlay = () => {
    if (ttsStatus.value === 'playing') pause()
    else if (ttsStatus.value === 'paused') resume()
    else if (ttsBook.value) play(ttsBook.value, { startChunkIdx: ttsChunkIdx.value })
  }

  const stop = () => {
    _stopInternal()
    ttsStatus.value = 'idle'
    ttsProgress.value = 0
    ttsChunkIdx.value = 0
    ttsTotalChunks.value = 0
    ttsElapsedSeconds.value = 0
    ttsTotalSeconds.value = 0
    ttsBook.value = null
    ttsChapterBoundaries.value = []
    clearStoredTtsSession()
  }

  const setSpeed = (rate) => {
    const nextSettings = updateSettings({ ttsSpeed: Number(rate) })
    ttsSpeed.value = nextSettings.ttsSpeed
    _clearAudioCache()
    if (_chunks.length) _updateProgress()
    else _persistSession()
    if (ttsStatus.value === 'playing') {
      _cancelAudio()
      _speakNextEdge()
    } else if (ttsStatus.value === 'paused') {
      // Discard paused audio so resume() re-fetches at the new speed
      _cancelAudio()
    }
  }

  const setVolume = (vol) => {
    const nextSettings = updateSettings({ ttsVolume: Number(vol) })
    ttsVolume.value = nextSettings.ttsVolume
    if (_currentAudio) _currentAudio.volume = ttsVolume.value
    _persistSession()
  }

  const setVoice = (voiceId) => {
    const nextSettings = updateSettings({ ttsVoice: normalizeAvailableVoice(voiceId) })
    ttsVoiceId.value = nextSettings.ttsVoice
    // Choosing an Edge voice implies the user wants cloud narration — clear any
    // explicit device-voice override and retry Edge.
    ttsNativeVoiceIdx.value = -1
    resetMobileTtsDriver()
    _clearAudioCache()
    _persistSession()
    if (ttsStatus.value === 'playing') {
      _cancelAudio()
      _speakNextEdge()
    } else if (ttsStatus.value === 'paused') {
      // Discard paused audio so resume() re-fetches with the new voice
      _cancelAudio()
    }
  }

  // Populate ttsNativeVoices with the phone's built-in TTS voices, so the
  // narrator picker can list real device voices when offline.
  const loadDeviceVoices = async () => {
    if (!import.meta.client) return []
    const voices = await loadNativeVoices()
    if (Array.isArray(voices) && voices.length) ttsNativeVoices.value = voices
    return ttsNativeVoices.value
  }

  // Pick a specific device voice by its index in ttsNativeVoices (the offline
  // narrator picker). Re-speaks the current chunk with it.
  const setNativeVoice = (index) => {
    const idx = Number(index)
    ttsNativeVoiceIdx.value = Number.isInteger(idx) && idx >= 0 ? idx : -1
    _clearAudioCache()
    _persistSession()
    if (ttsStatus.value === 'playing') {
      _cancelAudio()
      _speakNextEdge()
    } else if (ttsStatus.value === 'paused') {
      _cancelAudio()
    }
  }

  const restart = () => {
    if (!_chunks.length) return
    const wasActive = ttsStatus.value === 'playing' || ttsStatus.value === 'paused'
    _cancelAudio()
    _chunkIdx = 0
    _updateProgress()
    if (wasActive) {
      ttsStatus.value = 'playing'
      _speakNextEdge()
    }
  }

  // Fetch audio for a sentence ahead of play time (e.g. while the user reads the
  // "Read from here" prompt) so playback can start without waiting on the
  // network. Best-effort; normal playback re-fetches if this hasn't landed.
  const prewarmText = async (text) => {
    const value = String(text || '').trim()
    if (!value) return
    const voice = normalizeAvailableVoice(ttsVoiceId.value)
    const key = ttsPrewarmKey(value, voice, ttsSpeed.value)
    if (_prewarmCache.has(key)) return
    try {
      const data = await synthesizeSpeech({
        text: value,
        voice,
        speed: ttsSpeed.value,
        apiUrl,
        apiBaseUrl,
      })
      if (!data?.audio) return
      _prewarmCache.set(key, { audio: data.audio, boundaries: data.boundaries ?? [] })
      while (_prewarmCache.size > PREWARM_CACHE_LIMIT) {
        _prewarmCache.delete(_prewarmCache.keys().next().value)
      }
    } catch {
      // Prewarm is best-effort; normal fetch will run at play time.
    }
  }

  const seekToProgress = (pct) => {
    if (!_chunks.length) return
    _cancelAudio()
    _chunkIdx = Math.max(0, Math.min(_chunks.length - 1, Math.floor((pct / 100) * _chunks.length)))
    _updateProgress()
    if (ttsStatus.value === 'playing') _speakNextEdge()
  }

  const skipChunks = (delta) => {
    if (!_chunks.length) return
    _cancelAudio()
    _chunkIdx = Math.max(0, Math.min(_chunks.length - 1, _chunkIdx + delta))
    _updateProgress()
    if (ttsStatus.value === 'playing') _speakNextEdge()
  }

  // Jump to an absolute chunk index (used by chapter segments in the player).
  // For a restored session whose chunks aren't loaded yet, start playback there.
  const seekToChunk = (index) => {
    const target = Math.max(0, Number(index) || 0)
    if (_chunks.length) {
      _cancelAudio()
      _chunkIdx = Math.min(_chunks.length - 1, target)
      _updateProgress()
      if (ttsStatus.value === 'playing') _speakNextEdge()
      return
    }
    if (ttsBook.value) {
      play(ttsBook.value, { startChunkIdx: target, ignoreSavedSession: true })
    }
  }

  // Seek by wall-clock seconds inside the current sentence when possible.
  // If the seek crosses a sentence boundary, move to the adjacent sentence.
  const skipSeconds = (seconds) => {
    if (!_chunks.length) return

    if (_currentAudio && Number.isFinite(_currentAudio.duration)) {
      const target = _currentAudio.currentTime + seconds
      if (target >= 0 && target < _currentAudio.duration) {
        _currentAudio.currentTime = target
        _syncWordIndexForTime(target)
        _persistSession()
        return
      }
    }

    skipChunks(seconds < 0 ? -1 : 1)
  }

  const restoreLastSession = (availableBooks = []) => {
    if (ttsBook.value || ttsStatus.value === 'playing' || ttsStatus.value === 'loading') return false

    const session = readStoredTtsSession()
    if (!session?.bookId) return false

    const restoredBook = availableBooks.find(book => String(book.id) === String(session.bookId))
    if (!restoredBook) return false

    ttsBook.value = restoredBook
    ttsStatus.value = 'paused'
    ttsChunkIdx.value = session.chunkIdx
    ttsTotalChunks.value = session.totalChunks
    ttsProgress.value = session.progress
    ttsElapsedSeconds.value = session.elapsedSeconds
    ttsTotalSeconds.value = session.totalSeconds
    ttsCurrentChunk.value = session.currentChunk

    // Hydrate chapter segments for the restored track (fire-and-forget)
    if (import.meta.client && session.totalChunks > 0) {
      const restoredId = restoredBook.id
      getBookContent(restoredId).then(stored => {
        if (ttsBook.value?.id !== restoredId || ttsChapterBoundaries.value.length) return
        const html = restoredBook?.content || stored?.content || ''
        const tocTitles = restoredBook?.tocTitles || stored?.tocTitles || []
        ttsChapterBoundaries.value = buildChapterBoundariesFromHtml(html, session.totalChunks, tocTitles)
      }).catch(() => {})
    }
    return true
  }

  const setChapterBoundaries = (boundaries) => {
    ttsChapterBoundaries.value = Array.isArray(boundaries) ? boundaries : []
  }

  return {
    ttsBook, ttsStatus, ttsProgress, ttsChunkIdx, ttsTotalChunks,
    ttsElapsedSeconds, ttsTotalSeconds,
    ttsSpeed, ttsVolume, ttsVoiceId, ttsVoices, ttsCurrentChunk,
    ttsNativeVoices, ttsNativeVoiceIdx, ttsUsingDeviceVoice,
    ttsPlayingChunkIdx, ttsPlayingChunkText,
    ttsWordIdx, ttsBoundaries, ttsChapterBoundaries,
    elapsedTime, totalTime,
    play, pause, resume, togglePlay, stop, restart, restoreLastSession,
    setSpeed, setVolume, setVoice, seekToProgress, skipChunks, skipSeconds, seekToChunk,
    loadDeviceVoices, setNativeVoice,
    setChapterBoundaries, prewarmText,
  }
}
