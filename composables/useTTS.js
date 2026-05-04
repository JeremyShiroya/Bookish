import { computed } from 'vue'
import { useState } from '#app'

// ── Module-level singleton playback state ──────────────────────────────────
let _chunks = []
let _chunkIdx = 0
let _synth = null
let _currentAudio = null

const WORDS_PER_CHUNK = 28
const WORDS_PER_MIN = 145

// ── Pure helpers (exported for tests) ─────────────────────────────────────

export function stripHtml(html) {
  if (!html) return ''
  // Strip tags first, collapse whitespace and trim HTML-induced spaces
  const stripped = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<hr[^>]*>/gi, ' . ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // Decode entities after trim so &nbsp; at end produces a trailing space
  return stripped
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
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

// ── Composable ─────────────────────────────────────────────────────────────

export const useTTS = () => {
  const ttsBook        = useState('tts:book',        () => null)
  const ttsStatus      = useState('tts:status',      () => 'idle')
  const ttsProgress    = useState('tts:progress',    () => 0)
  const ttsChunkIdx    = useState('tts:chunkIdx',    () => 0)
  const ttsTotalChunks = useState('tts:totalChunks', () => 0)
  const ttsSpeed       = useState('tts:speed',       () => 1.0)
  const ttsVolume      = useState('tts:volume',      () => 1.0)
  const ttsVoiceName   = useState('tts:voice',       () => '')
  const ttsVoices      = useState('tts:voices',      () => [])
  const ttsEngine      = useState('tts:engine',      () => 'webspeech')
  const voxcpmOnline   = useState('tts:voxcpm',      () => false)

  const elapsedTime = computed(() => {
    const secsPerChunk = (WORDS_PER_CHUNK / WORDS_PER_MIN) * 60 / ttsSpeed.value
    return formatDuration(ttsChunkIdx.value * secsPerChunk)
  })

  const totalTime = computed(() => {
    const secsPerChunk = (WORDS_PER_CHUNK / WORDS_PER_MIN) * 60 / ttsSpeed.value
    return formatDuration(ttsTotalChunks.value * secsPerChunk)
  })

  const getSynth = () => {
    if (import.meta.client && !_synth) _synth = window.speechSynthesis
    return _synth
  }

  const initVoices = () => {
    if (!import.meta.client) return
    const synth = getSynth()
    if (!synth) return
    const update = () => {
      ttsVoices.value = synth.getVoices()
        .filter(v => v.lang.startsWith('en'))
        .map(v => ({ name: v.name, lang: v.lang }))
      if (!ttsVoiceName.value && ttsVoices.value.length) {
        ttsVoiceName.value = ttsVoices.value[0].name
      }
    }
    update()
    synth.onvoiceschanged = update
  }

  const checkVoxCPM = async () => {
    if (!import.meta.client) return
    try {
      const res = await $fetch('/api/tts/status', { timeout: 3000 })
      voxcpmOnline.value = res.available
      if (res.available) ttsEngine.value = 'voxcpm'
    } catch {
      voxcpmOnline.value = false
      ttsEngine.value = 'webspeech'
    }
  }

  const _updateProgress = () => {
    ttsChunkIdx.value = _chunkIdx
    ttsProgress.value = ttsTotalChunks.value > 0
      ? Math.round((_chunkIdx / ttsTotalChunks.value) * 100)
      : 0
  }

  const _speakNextWebSpeech = () => {
    const synth = getSynth()
    if (!synth || _chunkIdx >= _chunks.length) {
      ttsStatus.value = 'idle'
      ttsProgress.value = 100
      return
    }
    _updateProgress()
    const utt = new SpeechSynthesisUtterance(_chunks[_chunkIdx])
    utt.rate = ttsSpeed.value
    utt.volume = ttsVolume.value
    if (ttsVoiceName.value) {
      const v = synth.getVoices().find(v => v.name === ttsVoiceName.value)
      if (v) utt.voice = v
    }
    utt.onend = () => {
      if (ttsStatus.value === 'playing') {
        _chunkIdx++
        _speakNextWebSpeech()
      }
    }
    utt.onerror = (e) => {
      if (e.error !== 'interrupted') console.error('[TTS]', e.error)
    }
    synth.speak(utt)
  }

  const _playNextVoxCPM = async () => {
    if (_chunkIdx >= _chunks.length) {
      ttsStatus.value = 'idle'
      ttsProgress.value = 100
      return
    }
    _updateProgress()
    try {
      const res = await $fetch('/api/tts', {
        method: 'POST',
        body: { text: _chunks[_chunkIdx], speed: ttsSpeed.value, voice: ttsVoiceName.value || undefined },
      })
      if (res.engine === 'webspeech') {
        ttsEngine.value = 'webspeech'
        _speakNextWebSpeech()
        return
      }
      _currentAudio = new Audio(res.audio)
      _currentAudio.volume = ttsVolume.value
      _currentAudio.onended = () => {
        if (ttsStatus.value === 'playing') { _chunkIdx++; _playNextVoxCPM() }
      }
      _currentAudio.onerror = () => {
        console.error('[TTS] VoxCPM audio error, falling back to Web Speech')
        ttsEngine.value = 'webspeech'
        voxcpmOnline.value = false
        _speakNextWebSpeech()
      }
      await _currentAudio.play()
    } catch (err) {
      console.error('[TTS] VoxCPM request error:', err)
      ttsEngine.value = 'webspeech'
      voxcpmOnline.value = false
      _speakNextWebSpeech()
    }
  }

  const _stopInternal = () => {
    const synth = getSynth()
    if (synth) synth.cancel()
    if (_currentAudio) { _currentAudio.pause(); _currentAudio = null }
    _chunks = []
    _chunkIdx = 0
  }

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
      ttsStatus.value = 'idle'
      ttsBook.value = null
      alert('This book has no readable text content for audio playback.')
      return
    }

    if (import.meta.client && !window.speechSynthesis && ttsEngine.value === 'webspeech') {
      ttsStatus.value = 'idle'
      ttsBook.value = null
      alert('Audio playback is not supported in this browser.')
      return
    }

    _chunks = splitToChunks(text)
    _chunkIdx = 0
    ttsTotalChunks.value = _chunks.length
    ttsStatus.value = 'playing'
    _updateProgress()

    if (ttsEngine.value === 'voxcpm' && voxcpmOnline.value) {
      _playNextVoxCPM()
    } else {
      _speakNextWebSpeech()
    }
  }

  const pause = () => {
    if (ttsStatus.value !== 'playing') return
    ttsStatus.value = 'paused'
    const synth = getSynth()
    if (ttsEngine.value === 'webspeech' && synth) {
      synth.pause()
    } else if (_currentAudio) {
      _currentAudio.pause()
    }
  }

  const resume = () => {
    if (ttsStatus.value !== 'paused') return
    ttsStatus.value = 'playing'
    const synth = getSynth()
    if (ttsEngine.value === 'webspeech' && synth) {
      synth.resume()
    } else if (_currentAudio) {
      _currentAudio.play()
    } else if (ttsEngine.value === 'voxcpm') {
      _playNextVoxCPM()
    } else {
      _speakNextWebSpeech()
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
    if (ttsStatus.value === 'playing' && ttsEngine.value === 'webspeech') {
      const synth = getSynth()
      if (synth) { synth.cancel(); _speakNextWebSpeech() }
    }
  }

  const setVolume = (vol) => {
    ttsVolume.value = vol
    if (_currentAudio) _currentAudio.volume = vol
  }

  const setVoice = (name) => {
    ttsVoiceName.value = name
    if (ttsStatus.value === 'playing' && ttsEngine.value === 'webspeech') {
      const synth = getSynth()
      if (synth) { synth.cancel(); _speakNextWebSpeech() }
    }
  }

  const seekToProgress = (pct) => {
    if (!_chunks.length) return
    const synth = getSynth()
    if (synth) synth.cancel()
    if (_currentAudio) { _currentAudio.pause(); _currentAudio = null }
    _chunkIdx = Math.max(0, Math.min(_chunks.length - 1, Math.floor((pct / 100) * _chunks.length)))
    _updateProgress()
    if (ttsStatus.value === 'playing') {
      if (ttsEngine.value === 'voxcpm' && voxcpmOnline.value) _playNextVoxCPM()
      else _speakNextWebSpeech()
    }
  }

  const skipChunks = (delta) => {
    if (!_chunks.length) return
    const synth = getSynth()
    if (synth) synth.cancel()
    if (_currentAudio) { _currentAudio.pause(); _currentAudio = null }
    _chunkIdx = Math.max(0, Math.min(_chunks.length - 1, _chunkIdx + delta))
    _updateProgress()
    if (ttsStatus.value === 'playing') {
      if (ttsEngine.value === 'voxcpm' && voxcpmOnline.value) _playNextVoxCPM()
      else _speakNextWebSpeech()
    }
  }

  return {
    ttsBook, ttsStatus, ttsProgress, ttsChunkIdx, ttsTotalChunks,
    ttsSpeed, ttsVolume, ttsVoiceName, ttsVoices, ttsEngine, voxcpmOnline,
    elapsedTime, totalTime,
    play, pause, resume, togglePlay, stop,
    setSpeed, setVolume, setVoice, seekToProgress, skipChunks,
    initVoices, checkVoxCPM,
  }
}
