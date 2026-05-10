import { computed } from 'vue'
import { useState } from '#app'

// ── Module-level singleton ─────────────────────────────────────────────────
// Two parallel workers run Kokoro inference. Generation alternates between
// them (round-robin) and while chunk N plays we pre-generate N+1 and N+2 in
// parallel — one per worker — so each worker is kept busy.
//
// Playback is via plain HTML5 Audio elements + Blob URLs. No Web Audio API,
// no decodeAudioData, no createBuffer. The browser's native WAV decoder
// handles everything, which avoids the format-quirk static we hit with
// decodeAudioData/copyToChannel paths.
const NUM_WORKERS = 2

let _workers = []
let _workerReady = false
let _workerFailed = false

let _pendingGen = new Map()
let _genId = 0

let _chunks = []
let _chunkIdx = 0
let _currentAudio = null      // HTMLAudioElement currently playing
let _currentAudioUrl = null   // matching Blob URL (revoked when done)
let _synth = null
let _prefetchBlobs = new Map() // idx → { blob, url } — pre-generated WAV blobs
let _pendingPrefetch = new Set()
let _consecutiveFails = 0
let _sessionId = 0

const FIRST_CHUNK_CHARS = 35      // tiny first chunk for fast time-to-first-audio (~3-4s on slow GPUs)
const MAX_CHUNK_CHARS = 100       // normal chunk size after the first
const CHUNK_TIMEOUT_MS = 60_000
const MAX_CONSECUTIVE_FAILS = 3
const WORDS_PER_CHUNK = 28
const WORDS_PER_MIN = 145

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    for (const w of _workers) {
      try { w.worker.terminate() } catch {}
    }
    _workers = []
    _workerReady = false
    _workerFailed = false
    _pendingGen.clear()
    for (const { url } of _prefetchBlobs.values()) {
      try { URL.revokeObjectURL(url) } catch {}
    }
    _prefetchBlobs.clear()
    if (_currentAudioUrl) {
      try { URL.revokeObjectURL(_currentAudioUrl) } catch {}
      _currentAudioUrl = null
    }
  })
}

export const KOKORO_VOICES = [
  { id: 'af_bella',   name: 'Bella'   },
  { id: 'af_nicole',  name: 'Nicole'  },
  { id: 'am_michael', name: 'Michael' },
  { id: 'bm_george',  name: 'George'  },
  { id: 'bm_lewis',   name: 'Lewis'   },
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

// First chunk uses a smaller character limit so the user gets audio quickly
// after clicking play. Subsequent chunks use the full size for efficiency.
export function splitToChunks(text, maxChars = MAX_CHUNK_CHARS, firstChunkChars = FIRST_CHUNK_CHARS) {
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text]
  const result = []
  let buf = ''
  for (const s of sentences) {
    const trimmed = s.trim()
    if (!trimmed) continue
    const limit = result.length === 0 ? firstChunkChars : maxChars
    if (buf && (buf + ' ' + trimmed).length > limit) {
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
  const ttsVoiceId     = useState('tts:voice',       () => 'af_bella')
  const ttsVoices      = useState('tts:voices',      () => KOKORO_VOICES)
  const kokoroReady    = useState('tts:kokoroReady', () => false)
  const kokoroProgress = useState('tts:kokoroProg',  () => 0)
  const ttsGenerating  = useState('tts:generating',  () => false)

  const elapsedTime = computed(() => {
    const secsPerChunk = (WORDS_PER_CHUNK / WORDS_PER_MIN) * 60 / ttsSpeed.value
    return formatDuration(ttsChunkIdx.value * secsPerChunk)
  })

  const totalTime = computed(() => {
    const secsPerChunk = (WORDS_PER_CHUNK / WORDS_PER_MIN) * 60 / ttsSpeed.value
    return formatDuration(ttsTotalChunks.value * secsPerChunk)
  })

  // ── Worker management ────────────────────────────────────────────────────

  const _makeWorker = (slot) => {
    const worker = new Worker(
      new URL('../workers/tts.worker.js', import.meta.url),
      { type: 'module' }
    )
    const w = { worker, ready: false, loading: true, failed: false, slot }

    worker.onmessage = ({ data: msg }) => {
      switch (msg.type) {
        case 'progress':
          if (msg.pct > kokoroProgress.value) kokoroProgress.value = msg.pct
          break

        case 'ready':
          w.ready = true
          w.loading = false
          console.log(`[TTS] Worker ${w.slot} ready (${msg.device})`)
          if (!_workerReady) {
            _workerReady = true
            kokoroReady.value = true
            kokoroProgress.value = 100
            if (ttsStatus.value === 'loading') {
              ttsStatus.value = 'playing'
              _playNextKokoro()
            }
          }
          break

        case 'load_error':
          console.error(`[TTS] Worker ${w.slot} failed to load Kokoro:`, msg.message)
          w.failed = true
          w.loading = false
          if (_workers.every(x => x.failed)) {
            _workerFailed = true
            if (ttsStatus.value === 'loading') {
              ttsStatus.value = 'playing'
              _speakNextWebSpeech()
            }
          }
          break

        case 'audio': {
          const pending = _pendingGen.get(msg.id)
          if (pending) {
            _pendingGen.delete(msg.id)
            pending.resolve(msg.wav)  // ArrayBuffer of 16-bit WAV
          }
          break
        }

        case 'gen_error': {
          const pending = _pendingGen.get(msg.id)
          if (pending) {
            _pendingGen.delete(msg.id)
            pending.reject(new Error(msg.message))
          }
          break
        }
      }
    }

    worker.onerror = (e) => {
      console.error(`[TTS] Worker ${w.slot} crashed:`, e.message)
      w.failed = true
      if (_workers.every(x => x.failed)) _workerFailed = true
    }

    worker.postMessage({ type: 'init' })
    return w
  }

  const _initWorkers = () => {
    if (!import.meta.client || _workers.length > 0) return
    kokoroProgress.value = 0
    for (let i = 0; i < NUM_WORKERS; i++) {
      _workers.push(_makeWorker(i))
    }
  }

  const loadKokoro = () => {
    if (!import.meta.client) return
    if (_workers.length === 0 && !_workerFailed) _initWorkers()
  }

  const _pickWorker = (idx) => {
    const preferred = _workers[idx % _workers.length]
    if (preferred?.ready && !preferred.failed) return preferred
    return _workers.find(w => w.ready && !w.failed) || null
  }

  // Generate one chunk's WAV as a Blob ready to play. Times out after
  // CHUNK_TIMEOUT_MS so a hung worker can't lock us up forever.
  const _generateChunk = (idx) => {
    return new Promise((resolve, reject) => {
      const w = _pickWorker(idx)
      if (!w) { reject(new Error('No Kokoro worker available')); return }

      const id = ++_genId

      const timer = setTimeout(() => {
        if (!_pendingGen.has(id)) return
        _pendingGen.delete(id)
        reject(new Error(`Chunk ${idx} timed out after ${CHUNK_TIMEOUT_MS}ms`))
      }, CHUNK_TIMEOUT_MS)

      _pendingGen.set(id, {
        resolve: (wav) => {
          clearTimeout(timer)
          const blob = new Blob([wav], { type: 'audio/wav' })
          const url = URL.createObjectURL(blob)
          resolve({ blob, url })
        },
        reject: (err) => { clearTimeout(timer); reject(err) },
      })
      w.worker.postMessage({ type: 'generate', id, text: _chunks[idx], voice: ttsVoiceId.value || 'af_bella' })
    })
  }

  const _prefetchAhead = () => {
    const session = _sessionId
    const ahead = Math.max(1, _workers.filter(w => w.ready && !w.failed).length)
    for (let offset = 1; offset <= ahead; offset++) {
      const idx = _chunkIdx + offset
      if (idx >= _chunks.length) break
      if (_prefetchBlobs.has(idx) || _pendingPrefetch.has(idx)) continue

      _pendingPrefetch.add(idx)
      _generateChunk(idx)
        .then(entry => {
          if (session === _sessionId) _prefetchBlobs.set(idx, entry)
          else { try { URL.revokeObjectURL(entry.url) } catch {} }
        })
        .catch(() => {})
        .finally(() => { _pendingPrefetch.delete(idx) })
    }
  }

  // ── Kokoro playback ──────────────────────────────────────────────────────

  const _updateProgress = () => {
    ttsChunkIdx.value = _chunkIdx
    ttsProgress.value = ttsTotalChunks.value > 0
      ? Math.round((_chunkIdx / ttsTotalChunks.value) * 100)
      : 0
  }

  const _stopCurrentAudio = () => {
    if (_currentAudio) {
      try {
        _currentAudio.onended = null
        _currentAudio.onerror = null
        _currentAudio.pause()
        _currentAudio.removeAttribute('src')
        _currentAudio.load()
      } catch {}
      _currentAudio = null
    }
    if (_currentAudioUrl) {
      try { URL.revokeObjectURL(_currentAudioUrl) } catch {}
      _currentAudioUrl = null
    }
  }

  const _playNextKokoro = async () => {
    if (_chunkIdx >= _chunks.length) {
      ttsStatus.value = 'idle'
      ttsProgress.value = 100
      return
    }
    _updateProgress()

    try {
      let entry = _prefetchBlobs.get(_chunkIdx)
      if (entry) {
        _prefetchBlobs.delete(_chunkIdx)
        ttsGenerating.value = false
      } else {
        ttsGenerating.value = true
        entry = await _generateChunk(_chunkIdx)
        ttsGenerating.value = false
      }

      _consecutiveFails = 0

      if (ttsStatus.value !== 'playing') {
        try { URL.revokeObjectURL(entry.url) } catch {}
        return
      }

      _stopCurrentAudio()

      const audio = new Audio(entry.url)
      audio.playbackRate = ttsSpeed.value
      audio.volume = ttsVolume.value
      _currentAudio = audio
      _currentAudioUrl = entry.url

      audio.onended = () => {
        if (_currentAudio === audio) _currentAudio = null
        if (_currentAudioUrl === entry.url) {
          try { URL.revokeObjectURL(entry.url) } catch {}
          _currentAudioUrl = null
        }
        if (ttsStatus.value === 'playing') {
          _chunkIdx++
          _playNextKokoro()
        }
      }
      audio.onerror = (e) => {
        console.error(`[TTS] Audio playback error on chunk ${_chunkIdx}:`, audio.error?.message || e)
        if (_currentAudio === audio) _currentAudio = null
        if (_currentAudioUrl === entry.url) {
          try { URL.revokeObjectURL(entry.url) } catch {}
          _currentAudioUrl = null
        }
        // Skip this chunk and continue
        if (ttsStatus.value === 'playing') {
          _chunkIdx++
          _playNextKokoro()
        }
      }

      try {
        await audio.play()
      } catch (e) {
        // Most commonly: autoplay policy blocked. The user clicked play, so
        // this should be allowed — but log just in case.
        console.error('[TTS] audio.play() rejected:', e.message)
      }

      _prefetchAhead()
    } catch (err) {
      ttsGenerating.value = false
      _consecutiveFails++
      console.warn(`[TTS] Kokoro chunk failed (${_consecutiveFails}/${MAX_CONSECUTIVE_FAILS}):`, err.message)

      if (_workerFailed || _consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
        _workerFailed = true
        console.warn('[TTS] Switching to Web Speech permanently for this session.')
        _speakNextWebSpeech()
      } else {
        _speakOneWebSpeech(() => {
          if (ttsStatus.value !== 'playing') return
          _chunkIdx++
          _playNextKokoro()
        })
      }
    }
  }

  // ── Web Speech (fallback) ─────────────────────────────────────────────────

  const _getSynth = () => {
    if (import.meta.client && !_synth) _synth = window.speechSynthesis
    return _synth
  }

  const _speakOneWebSpeech = (onDone) => {
    const synth = _getSynth()
    if (!synth || _chunkIdx >= _chunks.length) { onDone(); return }
    _updateProgress()
    const utt = new SpeechSynthesisUtterance(_chunks[_chunkIdx])
    utt.rate = ttsSpeed.value
    utt.volume = ttsVolume.value
    utt.onend = () => onDone()
    utt.onerror = (e) => {
      if (e.error !== 'interrupted') console.error('[TTS]', e.error)
      onDone()
    }
    synth.speak(utt)
  }

  const _speakNextWebSpeech = () => {
    const synth = _getSynth()
    if (!synth || _chunkIdx >= _chunks.length) {
      ttsStatus.value = 'idle'
      ttsProgress.value = 100
      return
    }
    _updateProgress()
    const utt = new SpeechSynthesisUtterance(_chunks[_chunkIdx])
    utt.rate = ttsSpeed.value
    utt.volume = ttsVolume.value
    utt.onend = () => {
      if (ttsStatus.value === 'playing') { _chunkIdx++; _speakNextWebSpeech() }
    }
    utt.onerror = (e) => {
      if (e.error !== 'interrupted') console.error('[TTS]', e.error)
    }
    synth.speak(utt)
  }

  // ── Playback control ──────────────────────────────────────────────────────

  const _stopInternal = () => {
    _sessionId++
    _stopCurrentAudio()
    const synth = _getSynth()
    if (synth) synth.cancel()
    _chunks = []
    _chunkIdx = 0
    for (const { url } of _prefetchBlobs.values()) {
      try { URL.revokeObjectURL(url) } catch {}
    }
    _prefetchBlobs.clear()
    _pendingPrefetch.clear()
    ttsGenerating.value = false
    _consecutiveFails = 0
    _pendingGen.forEach(p => p.reject(new Error('stopped')))
    _pendingGen.clear()
  }

  const _clearPrefetch = () => {
    for (const { url } of _prefetchBlobs.values()) {
      try { URL.revokeObjectURL(url) } catch {}
    }
    _prefetchBlobs.clear()
    _pendingPrefetch.clear()
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
      const { addToast } = useToast()
      addToast('This book has no readable text content for audio playback.', 'error')
      ttsStatus.value = 'idle'
      ttsBook.value = null
      return
    }

    _chunks = splitToChunks(text)
    _chunkIdx = 0
    ttsTotalChunks.value = _chunks.length
    _updateProgress()

    if (!_workerFailed && _workers.length === 0) _initWorkers()

    if (_workerFailed) {
      ttsStatus.value = 'playing'
      _speakNextWebSpeech()
    } else if (_workerReady) {
      ttsStatus.value = 'playing'
      _playNextKokoro()
    }
    // else: status stays 'loading'; the 'ready' message handler will start playback
  }

  const pause = () => {
    if (ttsStatus.value !== 'playing') return
    ttsStatus.value = 'paused'
    if (_currentAudio) {
      try { _currentAudio.pause() } catch {}
    }
    const synth = _getSynth()
    if (synth) synth.pause()
  }

  const resume = () => {
    if (ttsStatus.value !== 'paused') return
    ttsStatus.value = 'playing'
    if (_currentAudio) {
      _currentAudio.play().catch(e => console.error('[TTS] resume play() failed:', e.message))
    } else if (!_workerFailed && _workerReady) {
      _playNextKokoro()
    } else {
      const synth = _getSynth()
      if (synth) synth.resume()
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
    if (_currentAudio) _currentAudio.playbackRate = rate
    if (ttsStatus.value === 'playing' && _workerFailed) {
      const synth = _getSynth()
      if (synth) { synth.cancel(); _speakNextWebSpeech() }
    }
  }

  const setVolume = (vol) => {
    ttsVolume.value = vol
    if (_currentAudio) _currentAudio.volume = vol
  }

  const setVoice = (voiceId) => {
    ttsVoiceId.value = voiceId
    _sessionId++
    _clearPrefetch()
    if (ttsStatus.value === 'playing' && !_workerFailed && _workerReady) {
      _stopCurrentAudio()
      _playNextKokoro()
    }
  }

  const seekToProgress = (pct) => {
    if (!_chunks.length) return
    _sessionId++
    _stopCurrentAudio()
    const synth = _getSynth()
    if (synth) synth.cancel()
    _clearPrefetch()
    _chunkIdx = Math.max(0, Math.min(_chunks.length - 1, Math.floor((pct / 100) * _chunks.length)))
    _updateProgress()
    if (ttsStatus.value === 'playing') {
      if (!_workerFailed && _workerReady) _playNextKokoro()
      else _speakNextWebSpeech()
    }
  }

  const skipChunks = (delta) => {
    if (!_chunks.length) return
    _sessionId++
    _stopCurrentAudio()
    const synth = _getSynth()
    if (synth) synth.cancel()
    _clearPrefetch()
    _chunkIdx = Math.max(0, Math.min(_chunks.length - 1, _chunkIdx + delta))
    _updateProgress()
    if (ttsStatus.value === 'playing') {
      if (!_workerFailed && _workerReady) _playNextKokoro()
      else _speakNextWebSpeech()
    }
  }

  return {
    ttsBook, ttsStatus, ttsProgress, ttsChunkIdx, ttsTotalChunks,
    ttsSpeed, ttsVolume, ttsVoiceId, ttsVoices,
    kokoroReady, kokoroProgress, ttsGenerating,
    elapsedTime, totalTime,
    play, pause, resume, togglePlay, stop,
    setSpeed, setVolume, setVoice, seekToProgress, skipChunks,
    loadKokoro,
  }
}
