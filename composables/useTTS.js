import { computed } from 'vue'
import { useState } from '#app'

let _synth = null
let _chunks = []
let _chunkIdx = 0
let _currentUtt = null   // always cleared before synth.cancel() to prevent stale callbacks
let _volumeTimer = null

const WORDS_PER_CHUNK = 28
const WORDS_PER_MIN = 145

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

export function splitToChunks(text, maxChars = 180) {
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
//
// Detects copyright pages, table of contents, and other frontmatter boilerplate
// so playback can jump straight to the actual story content.
//
// Scoring rules:
//   • One STRONG signal alone flags a chunk as boilerplate.
//   • Two or more WEAK signals together also flag it.
//   • TOC heading → the next TOC_WINDOW chunks are treated as boilerplate
//     unless one of them looks like real prose, which ends the window early.
//   • Scan is capped at MAX_SCAN_CHUNKS so we never skip deep into the story.

const MAX_SCAN_CHUNKS = 60   // copyright + long TOC + dedication can easily be 40+ chunks
const TOC_WINDOW      = 40   // max chunks to treat as TOC entries after the heading

// ── Copyright / legal signals ─────────────────────────────────────────────

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

// ── Table of contents signals ─────────────────────────────────────────────

// Matches the section heading itself
const TOC_HEADING_RE = /\btable of contents\b/i

// Matches individual TOC entry lines
const TOC_ENTRY_PATTERNS = [
  /\.{4,}/,                       // dot leaders:  Chapter 1 .......... 5
  /\b(?:chapter|part|section|epilogue|prologue|preface|afterword|appendix|interlude|note to reader)\s+(?:\d{1,3}|[ivxlcdm]{1,6})\b/i,
]

// A chunk that has 3+ chapter/section words AND contains digits is almost
// certainly a run of TOC entries packed into one chunk by splitToChunks.
function _isTocEntryChunk(text) {
  if (TOC_ENTRY_PATTERNS.some(re => re.test(text))) return true
  const sectionWords = (text.match(/\b(?:chapter|part|section|epilogue|prologue|appendix|interlude)\b/gi) || []).length
  return sectionWords >= 3 && /\d/.test(text)
}

// ── Other common frontmatter pages ────────────────────────────────────────

const OTHER_FRONTMATTER = [
  /\balso by\b/i,                     // "Also by this author" page
  /\bpraise for\b/i,                  // review blurbs
  /\badvance praise\b/i,
  /\babout the author\b/i,
  /\bauthor's? note\b/i,
  /\ba note (?:on|about) the\b/i,
]

// ── Prose detector — stops the TOC window early ───────────────────────────
//
// A chunk is "likely prose" when it has real sentence structure and common
// narrative words. We use this to avoid skipping into chapter 1 when the
// TOC is short and the story begins well within the TOC window.

const PROSE_WORDS_RE = /\b(?:the|was|had|were|said|walked|looked|felt|knew|thought|turned|could|would|began|came|went|saw|heard|made|told|found|gave|took|seemed|left|wanted|stood|called|asked|answered|smiled|laughed|whispered|cried|ran|sat|lay|rose|fell|opened|closed|started|stopped|reached|pulled|pushed|held|kept|brought|put|got|set|let|led|read|heard|felt|showed|happened|became|followed|stayed|continued|moved|picked|carried|carried|tried|used|passed|played|worked|lived|died|returned|waited|watched|listened|remembered|understood|realized|decided|noticed|felt|seemed|appeared|remained|looked|seemed|sounded|smelled|tasted|touched)\b/i

function _isLikelyProse(text) {
  // Must be long enough to be a real sentence and end with punctuation
  if (text.length < 60) return false
  if (!/[.!?]/.test(text)) return false
  return PROSE_WORDS_RE.test(text)
}

// ── Master frontmatter classifier ────────────────────────────────────────

function _isBoilerplate(text) {
  return (
    _isCopyrightChunk(text) ||
    OTHER_FRONTMATTER.some(re => re.test(text)) ||
    TOC_HEADING_RE.test(text) ||
    _isTocEntryChunk(text)
  )
}

// ── Public export ─────────────────────────────────────────────────────────
//
// Returns the index of the first chunk that looks like real story content.
// Returns 0 when no boilerplate is detected.

export function findContentStart(chunks) {
  const limit = Math.min(chunks.length, MAX_SCAN_CHUNKS)
  let lastBoilerplateIdx = -1
  let tocWindowEnd = -1        // set when a TOC heading is found

  for (let i = 0; i < limit; i++) {
    const chunk = chunks[i]

    if (_isBoilerplate(chunk)) {
      lastBoilerplateIdx = i
      // When we see the TOC heading, open a window covering the next
      // TOC_WINDOW chunks — we'll examine each one individually below.
      if (TOC_HEADING_RE.test(chunk)) {
        tocWindowEnd = Math.min(i + TOC_WINDOW, limit - 1)
      }

    } else if (tocWindowEnd > 0 && i <= tocWindowEnd) {
      // We're inside the TOC window (no boilerplate signal on this chunk).
      // If it looks like real prose, the TOC is over — stop the window.
      // Otherwise treat it as a TOC entry (section title without a number,
      // blank-ish lines, etc.) and keep scanning.
      if (_isLikelyProse(chunk)) {
        tocWindowEnd = -1   // found prose — story starts here, don't extend further
      } else {
        lastBoilerplateIdx = i   // still inside TOC
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
  const ttsVoiceId      = useState('tts:voice',        () => '')
  const ttsVoices       = useState('tts:voices',       () => [])
  const ttsCurrentChunk = useState('tts:currentChunk', () => '')

  const elapsedTime = computed(() => {
    const secsPerChunk = (WORDS_PER_CHUNK / WORDS_PER_MIN) * 60 / ttsSpeed.value
    return formatDuration(ttsChunkIdx.value * secsPerChunk)
  })

  const totalTime = computed(() => {
    const secsPerChunk = (WORDS_PER_CHUNK / WORDS_PER_MIN) * 60 / ttsSpeed.value
    return formatDuration(ttsTotalChunks.value * secsPerChunk)
  })

  const _getSynth = () => {
    if (import.meta.client && !_synth) _synth = window.speechSynthesis
    return _synth
  }

  const _getVoice = () => {
    if (!import.meta.client || !ttsVoiceId.value) return null
    return window.speechSynthesis.getVoices().find(v => v.voiceURI === ttsVoiceId.value) || null
  }

  const loadVoices = () => {
    if (!import.meta.client) return
    const synth = _getSynth()
    const populate = () => {
      const voices = synth.getVoices()
      if (!voices.length) return
      ttsVoices.value = voices.map(v => ({ id: v.voiceURI, name: v.name }))
      if (!ttsVoiceId.value) ttsVoiceId.value = voices[0].voiceURI
    }
    populate()
    synth.onvoiceschanged = populate
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  const _updateProgress = () => {
    ttsChunkIdx.value = _chunkIdx
    ttsCurrentChunk.value = _chunks[_chunkIdx] || ''
    ttsProgress.value = ttsTotalChunks.value > 0
      ? Math.round((_chunkIdx / ttsTotalChunks.value) * 100)
      : 0
  }

  // Clear the current utterance's callbacks and cancel synthesis.
  // Must be called before any explicit cancel so stale onend/onerror don't fire.
  const _cancel = () => {
    if (_currentUtt) {
      _currentUtt.onend = null
      _currentUtt.onerror = null
      _currentUtt = null
    }
    const synth = _getSynth()
    if (synth) synth.cancel()
  }

  const _speakNext = () => {
    const synth = _getSynth()
    if (!synth || _chunkIdx >= _chunks.length) {
      ttsStatus.value = 'idle'
      ttsProgress.value = 100
      ttsCurrentChunk.value = ''
      return
    }
    _updateProgress()

    const utt = new SpeechSynthesisUtterance(_chunks[_chunkIdx])
    _currentUtt = utt
    utt.rate = ttsSpeed.value
    utt.volume = ttsVolume.value
    const voice = _getVoice()
    if (voice) utt.voice = voice

    utt.onend = () => {
      if (_currentUtt !== utt) return   // cancelled — ignore stale event
      _currentUtt = null
      if (ttsStatus.value === 'playing') { _chunkIdx++; _speakNext() }
    }

    utt.onerror = (e) => {
      if (_currentUtt !== utt) return   // cancelled — ignore stale event
      _currentUtt = null
      if (e.error === 'interrupted' && ttsStatus.value === 'playing') {
        // Chrome cancels speech on SPA navigation / layout switches.
        // Re-queue the current chunk so playback recovers automatically.
        setTimeout(() => {
          if (ttsStatus.value === 'playing') _speakNext()
        }, 120)
      } else if (e.error !== 'interrupted') {
        console.error('[TTS]', e.error)
      }
    }

    synth.speak(utt)
  }

  const _stopInternal = () => {
    clearTimeout(_volumeTimer)
    _cancel()
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
        const full = await $fetch(`/api/books/${book.id}`, { query: { content: 'true' } })
        content = full.content
        ttsBook.value = { ...book, ...full }
      } catch (e) {
        console.error('[TTS] Failed to fetch book content:', e)
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

    _chunks = splitToChunks(text, 180)
    const contentStart = findContentStart(_chunks)
    _chunkIdx = contentStart
    ttsTotalChunks.value = _chunks.length
    _updateProgress()

    if (contentStart > 0) {
      const { addToast } = useToast()
      addToast('Skipped copyright page — starting at content.', 'info')
    }

    ttsStatus.value = 'playing'
    _speakNext()
  }

  const pause = () => {
    if (ttsStatus.value !== 'playing') return
    ttsStatus.value = 'paused'
    const synth = _getSynth()
    if (synth) synth.pause()
  }

  const resume = () => {
    if (ttsStatus.value !== 'paused') return
    ttsStatus.value = 'playing'
    const synth = _getSynth()
    if (!synth) return
    synth.resume()
    // Firefox and some Chrome versions cancel on pause — re-queue if not speaking
    if (!synth.speaking && !synth.pending) _speakNext()
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
      _cancel()
      _speakNext()
    }
  }

  // Volume: debounce restarts so dragging the slider doesn't spam cancels.
  const setVolume = (vol) => {
    ttsVolume.value = vol
    if (ttsStatus.value === 'playing') {
      clearTimeout(_volumeTimer)
      _volumeTimer = setTimeout(() => {
        if (ttsStatus.value === 'playing') { _cancel(); _speakNext() }
      }, 350)
    }
  }

  const setVoice = (voiceURI) => {
    ttsVoiceId.value = voiceURI
    if (ttsStatus.value === 'playing') {
      _cancel()
      _speakNext()
    }
  }

  const seekToProgress = (pct) => {
    if (!_chunks.length) return
    _cancel()
    _chunkIdx = Math.max(0, Math.min(_chunks.length - 1, Math.floor((pct / 100) * _chunks.length)))
    _updateProgress()
    if (ttsStatus.value === 'playing') _speakNext()
  }

  const skipChunks = (delta) => {
    if (!_chunks.length) return
    _cancel()
    _chunkIdx = Math.max(0, Math.min(_chunks.length - 1, _chunkIdx + delta))
    _updateProgress()
    if (ttsStatus.value === 'playing') _speakNext()
  }

  return {
    ttsBook, ttsStatus, ttsProgress, ttsChunkIdx, ttsTotalChunks,
    ttsSpeed, ttsVolume, ttsVoiceId, ttsVoices, ttsCurrentChunk,
    elapsedTime, totalTime,
    play, pause, resume, togglePlay, stop,
    setSpeed, setVolume, setVoice, seekToProgress, skipChunks,
    loadVoices,
  }
}
