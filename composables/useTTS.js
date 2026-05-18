import { computed } from 'vue'
import { useState } from '#app'

let _currentAudio = null
let _prefetchAudio = null
let _prefetchGeneration = 0   // incremented on cancel to invalidate in-flight pre-fetches
let _chunks = []
let _chunkIdx = 0

const WORDS_PER_CHUNK = 28
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

export function splitToChunks(text, maxChars = 400) {
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text]
  const result = []
  let buf = ''
  for (const s of sentences) {
    const trimmed = s.trim()
    if (!trimmed) continue
    if (buf && (buf + ' ' + trimmed).length > maxChars) {
      result.push(buf)
      buf = trimmed
    } else {
      buf = buf ? buf + ' ' + trimmed : trimmed
    }
  }
  if (buf) result.push(buf)
  return result.filter(c => c.length > 0)
}

export function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
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
  const ttsBook         = useState('tts:book',         () => null)
  const ttsStatus       = useState('tts:status',       () => 'idle')
  const ttsProgress     = useState('tts:progress',     () => 0)
  const ttsChunkIdx     = useState('tts:chunkIdx',     () => 0)
  const ttsTotalChunks  = useState('tts:totalChunks',  () => 0)
  const ttsSpeed        = useState('tts:speed',        () => 1.0)
  const ttsVolume       = useState('tts:volume',       () => 1.0)
  const ttsVoiceId      = useState('tts:voice',        () => 'en-US-ChristopherNeural')
  const ttsVoices       = useState('tts:voices',       () => EDGE_VOICES)
  const ttsCurrentChunk = useState('tts:currentChunk', () => '')

  const { getBookContent } = useBookStorage()

  const elapsedTime = computed(() => {
    const secsPerChunk = (WORDS_PER_CHUNK / WORDS_PER_MIN) * 60 / ttsSpeed.value
    return formatDuration(ttsChunkIdx.value * secsPerChunk)
  })

  const totalTime = computed(() => {
    const secsPerChunk = (WORDS_PER_CHUNK / WORDS_PER_MIN) * 60 / ttsSpeed.value
    return formatDuration(ttsTotalChunks.value * secsPerChunk)
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
    _prefetchGeneration++
  }

  const _fetchChunkAudio = async (chunkIdx) => {
    const chunk = _chunks[chunkIdx]
    if (!chunk) return null
    try {
      const data = await $fetch('/api/tts', {
        method: 'POST',
        body: { text: chunk, voice: ttsVoiceId.value, speed: ttsSpeed.value },
      })
      return data.audio ?? null
    } catch (err) {
      console.warn('[TTS] fetch error:', err)
      return null
    }
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

    let audioSrc = _prefetchAudio
    _prefetchAudio = null
    if (!audioSrc) {
      audioSrc = await _fetchChunkAudio(_chunkIdx)
    }

    // Bail if cancel/seek/voice-switch happened while we were awaiting the fetch
    if (_prefetchGeneration !== myGen) return
    if (ttsStatus.value !== 'playing') return

    if (!audioSrc) {
      const { addToast } = useToast()
      addToast('TTS failed — check your connection.', 'error')
      ttsStatus.value = 'idle'
      return
    }

    const audio = new Audio(audioSrc)
    audio.volume = ttsVolume.value
    _currentAudio = audio

    // Pre-fetch next chunk while this one plays to hide network latency.
    // Capture generation so a cancel() that arrives before this resolves
    // doesn't let stale audio (wrong voice/speed) overwrite _prefetchAudio.
    const nextIdx = _chunkIdx + 1
    if (nextIdx < _chunks.length) {
      const gen = _prefetchGeneration
      _fetchChunkAudio(nextIdx).then(src => {
        if (_prefetchGeneration === gen) _prefetchAudio = src
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

    audio.play().catch(() => {
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
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  const play = async (book) => {
    _stopInternal()
    ttsBook.value = book
    ttsStatus.value = 'loading'

    let content = book.content
    if (!content) {
      try {
        const stored = await getBookContent(book.id)
        content = stored?.content ?? null
      } catch (e) {
        console.error('[TTS] Failed to load book content from storage:', e)
      }
    }

    const text = stripHtml(content || '')
    if (!text.trim()) {
      const { addToast } = useToast()
      addToast('This book has no readable text content for audio playback.', 'error')
      ttsStatus.value = 'idle'
      ttsBook.value = null
      return
    }

    _chunks = splitToChunks(text, 400)
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
      _currentAudio.play().catch(() => {
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
    ttsSpeed.value = rate
    if (ttsStatus.value === 'playing') {
      _cancelAudio()
      _speakNextEdge()
    } else if (ttsStatus.value === 'paused') {
      // Discard paused audio so resume() re-fetches at the new speed
      _cancelAudio()
    }
  }

  const setVolume = (vol) => {
    ttsVolume.value = vol
    if (_currentAudio) _currentAudio.volume = vol
  }

  const setVoice = (voiceId) => {
    ttsVoiceId.value = voiceId
    if (ttsStatus.value === 'playing') {
      _cancelAudio()
      _speakNextEdge()
    } else if (ttsStatus.value === 'paused') {
      // Discard paused audio so resume() re-fetches with the new voice
      _cancelAudio()
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

  return {
    ttsBook, ttsStatus, ttsProgress, ttsChunkIdx, ttsTotalChunks,
    ttsSpeed, ttsVolume, ttsVoiceId, ttsVoices, ttsCurrentChunk,
    elapsedTime, totalTime,
    play, pause, resume, togglePlay, stop,
    setSpeed, setVolume, setVoice, seekToProgress, skipChunks,
  }
}
