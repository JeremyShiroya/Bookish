import { computed } from 'vue'
import { useState } from '#app'
import { useBookishSettings } from '~/composables/useBookishSettings'

let _currentAudio = null
let _prefetchAudio = null
let _prefetchBoundaries = null   // word boundaries for the pre-fetched next chunk
let _prefetchGeneration = 0      // incremented on cancel to invalidate in-flight pre-fetches
let _chunks = []
let _chunkIdx = 0
let _currentBoundaries = []      // word boundaries for the currently playing chunk
let _rafId = null                // requestAnimationFrame handle for word-highlight loop

const DEFAULT_SENTENCE_MAX_CHARS = 480
const WORDS_PER_MIN = 145

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

// ── Pure helpers (exported for tests) ─────────────────────────────────────

export function stripHtml(html) {
  if (!html) return ''
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<hr[^>]*>/gi, ' . ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
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

  const sentences = normalized.match(/[^.!?]+(?:[.!?]+["')\]]*)?|[.!?]+/g) || [normalized]
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

export function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
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

export const useTTS = () => {
  const { settings, updateSettings } = useBookishSettings()

  const ttsBook         = useState('tts:book',         () => null)
  const ttsStatus       = useState('tts:status',       () => 'idle')
  const ttsProgress     = useState('tts:progress',     () => 0)
  const ttsChunkIdx     = useState('tts:chunkIdx',     () => 0)
  const ttsTotalChunks  = useState('tts:totalChunks',  () => 0)
  const ttsSpeed        = useState('tts:speed',        () => settings.value.ttsSpeed)
  const ttsVolume       = useState('tts:volume',       () => settings.value.ttsVolume)
  const ttsVoiceId      = useState('tts:voice',        () => settings.value.ttsVoice)
  const ttsVoices       = useState('tts:voices',       () => EDGE_VOICES)
  const ttsCurrentChunk = useState('tts:currentChunk', () => '')
  // Word-level highlight: index into the boundary array for the current chunk
  const ttsWordIdx      = useState('tts:wordIdx',      () => -1)
  // The boundary array for the currently-playing chunk (populated from TTS response)
  const ttsBoundaries   = useState('tts:boundaries',   () => [])

  const { getBookContent } = useBookStorage()

  const _estimatedChunkSeconds = (chunk) => {
    const words = (chunk?.match(/\S+/g) || []).length || 1
    return (words / WORDS_PER_MIN) * 60 / ttsSpeed.value
  }

  const elapsedTime = computed(() => {
    const seconds = _chunks
      .slice(0, Math.max(0, ttsChunkIdx.value))
      .reduce((sum, chunk) => sum + _estimatedChunkSeconds(chunk), 0)
    return formatDuration(seconds)
  })

  const totalTime = computed(() => {
    const seconds = _chunks.reduce((sum, chunk) => sum + _estimatedChunkSeconds(chunk), 0)
    return formatDuration(seconds)
  })

  // ── Internal helpers ───────────────────────────────────────────────────────

  const _updateProgress = () => {
    ttsChunkIdx.value = _chunkIdx
    ttsCurrentChunk.value = _chunks[_chunkIdx] || ''
    ttsProgress.value = ttsTotalChunks.value > 0
      ? Math.round((_chunkIdx / ttsTotalChunks.value) * 100)
      : 0
  }

  const _cancelAudio = () => {
    if (_currentAudio) {
      _currentAudio.onended = null
      _currentAudio.onerror = null
      _currentAudio.pause()
      _currentAudio = null
    }
    _prefetchAudio = null
    _prefetchBoundaries = null
    _prefetchGeneration++
    // Stop the word-highlight rAF loop
    if (_rafId !== null) { cancelAnimationFrame(_rafId); _rafId = null }
    _currentBoundaries = []
  }

  // Returns { audio: dataUrl, boundaries: [...] } or null
  const _fetchChunkAudio = async (chunkIdx) => {
    const chunk = _chunks[chunkIdx]
    if (!chunk) return null
    try {
      const data = await $fetch('/api/tts', {
        method: 'POST',
        body: { text: chunk, voice: ttsVoiceId.value, speed: ttsSpeed.value },
      })
      return { audio: data.audio ?? null, boundaries: data.boundaries ?? [] }
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

  const _speakNextEdge = async () => {
    // Capture generation at call time — if _cancelAudio() fires mid-await,
    // the generation increments and we know to abort.
    const myGen = _prefetchGeneration

    if (_chunkIdx >= _chunks.length) {
      ttsStatus.value = 'idle'
      ttsProgress.value = 100
      ttsCurrentChunk.value = ''
      return
    }
    _updateProgress()

    // Use pre-fetched result if available, otherwise fetch now
    let chunkData = null
    if (_prefetchAudio) {
      chunkData = { audio: _prefetchAudio, boundaries: _prefetchBoundaries ?? [] }
      _prefetchAudio = null
      _prefetchBoundaries = null
    } else {
      chunkData = await _fetchChunkAudio(_chunkIdx)
    }

    // Bail if cancel/seek/voice-switch happened while we were awaiting the fetch
    if (_prefetchGeneration !== myGen) return
    if (ttsStatus.value !== 'playing') return

    if (!chunkData?.audio) {
      const { addToast } = useToast()
      addToast('TTS failed — check your connection.', 'error')
      ttsStatus.value = 'idle'
      return
    }

    const audio = new Audio(chunkData.audio)
    audio.volume = ttsVolume.value
    _currentAudio = audio
    _currentBoundaries = chunkData.boundaries ?? []
    ttsBoundaries.value = _currentBoundaries   // expose via reactive state
    ttsWordIdx.value = -1                       // reset word index for new chunk

    // Pre-fetch next chunk while this one plays
    const nextIdx = _chunkIdx + 1
    if (nextIdx < _chunks.length) {
      const gen = _prefetchGeneration
      _fetchChunkAudio(nextIdx).then(result => {
        if (_prefetchGeneration === gen && result) {
          _prefetchAudio = result.audio
          _prefetchBoundaries = result.boundaries
        }
      })
    }

    audio.onended = () => {
      if (_currentAudio !== audio) return
      _currentAudio = null
      if (ttsStatus.value === 'playing') { _chunkIdx++; _speakNextEdge() }
    }

    audio.onerror = () => {
      if (_currentAudio !== audio) return
      _currentAudio = null
      const { addToast } = useToast()
      addToast('TTS failed — check your connection.', 'error')
      ttsStatus.value = 'idle'
    }

    audio.play().then(() => {
      _startWordLoop(_currentBoundaries)
    }).catch(() => {
      if (_currentAudio === audio) {
        _currentAudio = null
        ttsStatus.value = 'idle'
      }
    })
  }

  const _stopInternal = () => {
    _cancelAudio()
    _chunks = []
    _chunkIdx = 0
    ttsCurrentChunk.value = ''
    ttsWordIdx.value = -1
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  const play = async (book) => {
    _stopInternal()
    ttsBook.value = book
    ttsStatus.value = 'loading'

    let stored = null
    if (!book?.content) {
      try {
        stored = await getBookContent(book.id)
      } catch (e) {
        console.error('[TTS] Failed to load book content from storage:', e)
      }
    }

    let text = ''
    try {
      text = await resolveReadableText(book, stored)
    } catch (e) {
      console.error('[TTS] Failed to extract readable PDF text:', e)
    }

    if (!text.trim()) {
      const { addToast } = useToast()
      addToast('This book has no readable text content for audio playback.', 'error')
      ttsStatus.value = 'idle'
      ttsBook.value = null
      return
    }

    _chunks = splitToChunks(text)
    const contentStart = findContentStart(_chunks)
    _chunkIdx = contentStart
    ttsTotalChunks.value = _chunks.length
    _updateProgress()

    if (contentStart > 0) {
      const { addToast } = useToast()
      addToast('Skipped copyright page — starting at content.', 'info')
    }

    ttsStatus.value = 'playing'
    _speakNextEdge()
  }

  const pause = () => {
    if (ttsStatus.value !== 'playing') return
    ttsStatus.value = 'paused'
    _currentAudio?.pause()
  }

  const resume = () => {
    if (ttsStatus.value !== 'paused') return
    ttsStatus.value = 'playing'
    if (_currentAudio) {
      _currentAudio.play().then(() => {
        _startWordLoop(_currentBoundaries)
      }).catch(() => {
        if (ttsStatus.value === 'playing') {
          ttsStatus.value = 'idle'
        }
      })
    } else {
      _speakNextEdge()
    }
  }

  const togglePlay = () => {
    if (ttsStatus.value === 'playing') pause()
    else if (ttsStatus.value === 'paused') resume()
  }

  const stop = () => {
    _stopInternal()
    ttsStatus.value = 'idle'
    ttsProgress.value = 0
    ttsChunkIdx.value = 0
    ttsTotalChunks.value = 0
    ttsBook.value = null
  }

  const setSpeed = (rate) => {
    const nextSettings = updateSettings({ ttsSpeed: Number(rate) })
    ttsSpeed.value = nextSettings.ttsSpeed
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
  }

  const setVoice = (voiceId) => {
    const nextSettings = updateSettings({ ttsVoice: voiceId })
    ttsVoiceId.value = nextSettings.ttsVoice
    if (ttsStatus.value === 'playing') {
      _cancelAudio()
      _speakNextEdge()
    } else if (ttsStatus.value === 'paused') {
      // Discard paused audio so resume() re-fetches with the new voice
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

  // Seek by wall-clock seconds inside the current sentence when possible.
  // If the seek crosses a sentence boundary, move to the adjacent sentence.
  const skipSeconds = (seconds) => {
    if (!_chunks.length) return

    if (_currentAudio && Number.isFinite(_currentAudio.duration)) {
      const target = _currentAudio.currentTime + seconds
      if (target >= 0 && target < _currentAudio.duration) {
        _currentAudio.currentTime = target
        _syncWordIndexForTime(target)
        return
      }
    }

    skipChunks(seconds < 0 ? -1 : 1)
  }

  return {
    ttsBook, ttsStatus, ttsProgress, ttsChunkIdx, ttsTotalChunks,
    ttsSpeed, ttsVolume, ttsVoiceId, ttsVoices, ttsCurrentChunk,
    ttsWordIdx, ttsBoundaries,
    elapsedTime, totalTime,
    play, pause, resume, togglePlay, stop, restart,
    setSpeed, setVolume, setVoice, seekToProgress, skipChunks, skipSeconds,
  }
}
