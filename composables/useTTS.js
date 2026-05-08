import { computed } from 'vue'
import { useState } from '#app'

// ── Module-level singleton ─────────────────────────────────────────────────
let _worker = null          // Web Worker running Kokoro WASM
let _workerReady = false    // true once the model is loaded in the worker
let _workerLoading = false  // true while the model is downloading
let _workerFailed = false   // true if the model failed to load → Web Speech fallback

let _pendingGen = new Map() // id → { resolve, reject }
let _genId = 0

let _chunks = []
let _chunkIdx = 0
let _audioContext = null
let _gainNode = null
let _currentSource = null
let _synth = null
let _prefetchBuffer = null  // { idx, audioBuffer } — next chunk pre-decoded
let _generating = false     // true while a generate message is awaited
let _consecutiveFails = 0   // count of in-a-row Kokoro chunk failures

const WORDS_PER_CHUNK = 28
const CHUNK_TIMEOUT_MS = 60_000   // per-chunk fallback so a hung worker can't lock us up forever
const MAX_CONSECUTIVE_FAILS = 3   // give up on Kokoro after this many in-a-row timeouts/errors
const MAX_CHUNK_CHARS = 100       // smaller chunks → faster time-to-first-audio on slow GPUs

// Vite/HMR: when this module is replaced in dev, terminate the old worker so
// we don't end up with multiple workers all running inference in parallel
// and competing for the GPU. (The user saw this as "4 warmups" in console.)
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (_worker) {
      try { _worker.terminate() } catch {}
    }
    _worker = null
    _workerReady = false
    _workerLoading = false
    _workerFailed = false
    _pendingGen.clear()
  })
}
const WORDS_PER_MIN = 145

export const KOKORO_VOICES = [
  { id: 'af_bella',   name: 'Bella'   },  // American Female
  { id: 'af_nicole',  name: 'Nicole'  },  // American Female
  { id: 'am_michael', name: 'Michael' },  // American Male
  { id: 'bm_george',  name: 'George'  },  // British Male
  { id: 'bm_lewis',   name: 'Lewis'   },  // British Male
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

  const _getAudioContext = () => {
    if (!import.meta.client) return null
    if (!_audioContext) {
      _audioContext = new AudioContext()
      _gainNode = _audioContext.createGain()
      _gainNode.connect(_audioContext.destination)
      _gainNode.gain.value = ttsVolume.value
    }
    return _audioContext
  }

  // ── Worker management ────────────────────────────────────────────────────

  const _initWorker = () => {
    if (!import.meta.client || _worker) return
    _workerLoading = true
    kokoroProgress.value = 0

    _worker = new Worker(
      new URL('../workers/tts.worker.js', import.meta.url),
      { type: 'module' }
    )

    _worker.onmessage = ({ data: msg }) => {
      switch (msg.type) {
        case 'progress':
          kokoroProgress.value = msg.pct
          break

        case 'ready':
          _workerReady = true
          _workerLoading = false
          kokoroReady.value = true
          kokoroProgress.value = 100
          // If we were waiting to play, kick off playback now
          if (ttsStatus.value === 'loading') {
            ttsStatus.value = 'playing'
            _playNextKokoro()
          }
          break

        case 'load_error':
          console.error('[TTS] Worker failed to load Kokoro:', msg.message)
          _workerFailed = true
          _workerLoading = false
          // If we were waiting to play, fall back to Web Speech
          if (ttsStatus.value === 'loading') {
            ttsStatus.value = 'playing'
            _speakNextWebSpeech()
          }
          break

        case 'audio': {
          const pending = _pendingGen.get(msg.id)
          if (pending) {
            _pendingGen.delete(msg.id)
            pending.resolve(msg.wav)  // WAV ArrayBuffer — decoded in _generateChunk
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

    _worker.onerror = (e) => {
      console.error('[TTS] Worker crashed:', e.message)
      _workerFailed = true
      _workerLoading = false
    }

    _worker.postMessage({ type: 'init' })
  }

  const loadKokoro = () => {
    if (!import.meta.client) return
    if (!_worker && !_workerFailed) _initWorker()
  }

  // Ask the worker to generate one chunk; returns a decoded AudioBuffer.
  // Times out after CHUNK_TIMEOUT_MS so a hung worker can't lock us up
  // forever, but does NOT permanently disable Kokoro — only this chunk
  // falls back to Web Speech, the next chunk tries Kokoro again.
  const _generateChunk = (idx, ctx) => {
    return new Promise((resolve, reject) => {
      const id = ++_genId

      const timer = setTimeout(() => {
        if (!_pendingGen.has(id)) return
        _pendingGen.delete(id)
        reject(new Error(`Chunk ${idx} timed out after ${CHUNK_TIMEOUT_MS}ms`))
      }, CHUNK_TIMEOUT_MS)

      _pendingGen.set(id, {
        // wav is an ArrayBuffer containing a WAV file produced by RawAudio.toWav().
        // decodeAudioData reads sampling_rate, channels, and PCM data from the
        // WAV header automatically — no manual reconstruction, no static.
        resolve: async (wav) => {
          clearTimeout(timer)
          try {
            const audioBuffer = await ctx.decodeAudioData(wav)
            resolve(audioBuffer)
          } catch (e) { reject(e) }
        },
        reject: (err) => { clearTimeout(timer); reject(err) },
      })
      _worker.postMessage({ type: 'generate', id, text: _chunks[idx], voice: ttsVoiceId.value || 'af_bella' })
    })
  }

  // Pre-generate the next chunk while the current one plays
  const _prefetchNext = async (ctx) => {
    const idx = _chunkIdx + 1
    if (idx >= _chunks.length || _generating || _prefetchBuffer?.idx === idx) return
    try {
      _generating = true
      const audioBuffer = await _generateChunk(idx, ctx)
      _prefetchBuffer = { idx, audioBuffer }
    } catch {
      // silent — will generate on demand
    } finally {
      _generating = false
    }
  }

  // ── Kokoro playback ──────────────────────────────────────────────────────

  const _updateProgress = () => {
    ttsChunkIdx.value = _chunkIdx
    ttsProgress.value = ttsTotalChunks.value > 0
      ? Math.round((_chunkIdx / ttsTotalChunks.value) * 100)
      : 0
  }

  const _stopCurrentSource = () => {
    if (_currentSource) {
      _currentSource.onended = null
      try { _currentSource.stop() } catch {}
      _currentSource = null
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
      const ctx = _getAudioContext()
      if (!ctx) return
      if (ctx.state === 'suspended') await ctx.resume()

      let audioBuffer
      if (_prefetchBuffer?.idx === _chunkIdx) {
        audioBuffer = _prefetchBuffer.audioBuffer
        _prefetchBuffer = null
        ttsGenerating.value = false
      } else {
        _generating = true
        ttsGenerating.value = true
        audioBuffer = await _generateChunk(_chunkIdx, ctx)
        _generating = false
        ttsGenerating.value = false
      }

      _consecutiveFails = 0  // a successful generate resets the failure streak

      if (ttsStatus.value !== 'playing') return

      _stopCurrentSource()

      _currentSource = ctx.createBufferSource()
      _currentSource.buffer = audioBuffer
      _currentSource.playbackRate.value = ttsSpeed.value
      _currentSource.connect(_gainNode)
      _currentSource.onended = () => {
        _currentSource = null
        if (ttsStatus.value === 'playing') {
          _chunkIdx++
          _playNextKokoro()
        }
      }
      _currentSource.start()

      _prefetchNext(ctx)
    } catch (err) {
      _generating = false
      ttsGenerating.value = false
      _consecutiveFails++
      console.warn(`[TTS] Kokoro chunk failed (${_consecutiveFails}/${MAX_CONSECUTIVE_FAILS}):`, err.message)

      if (_workerFailed || _consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
        // Kokoro is too slow / broken on this device — give up for the rest
        // of the session and use Web Speech end-to-end. Better than making the
        // user wait 60s every chunk.
        _workerFailed = true
        console.warn('[TTS] Switching to Web Speech permanently for this session — Kokoro inference is too slow on this device.')
        _speakNextWebSpeech()
      } else {
        // Try Kokoro again on the next chunk — sometimes the model warms up
        // after one inference and subsequent chunks are fast.
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

  // Speak exactly one chunk via Web Speech, then call onDone. Used as a
  // per-chunk recovery path when a Kokoro generate times out or errors.
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
    _stopCurrentSource()
    const synth = _getSynth()
    if (synth) synth.cancel()
    if (_audioContext?.state === 'suspended') _audioContext.resume()
    _chunks = []
    _chunkIdx = 0
    _prefetchBuffer = null
    _generating = false
    ttsGenerating.value = false
    _consecutiveFails = 0
    _pendingGen.forEach(p => p.reject(new Error('stopped')))
    _pendingGen.clear()
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

    _chunks = splitToChunks(text, MAX_CHUNK_CHARS)
    _chunkIdx = 0
    ttsTotalChunks.value = _chunks.length
    _updateProgress()

    // Start worker if not already running
    if (!_workerFailed && !_worker) _initWorker()

    if (_workerFailed) {
      // Worker failed to load — go straight to Web Speech
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
    if (_audioContext?.state === 'running') _audioContext.suspend()
    const synth = _getSynth()
    if (synth) synth.pause()
  }

  const resume = () => {
    if (ttsStatus.value !== 'paused') return
    ttsStatus.value = 'playing'
    if (_audioContext?.state === 'suspended') {
      _audioContext.resume().then(() => {
        if (ttsStatus.value === 'playing' && !_currentSource && !_generating) {
          if (!_workerFailed && _workerReady) _playNextKokoro()
          else _speakNextWebSpeech()
        }
      })
    } else if (!_workerFailed && _workerReady) {
      if (!_currentSource) _playNextKokoro()
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
    if (_currentSource) _currentSource.playbackRate.value = rate
    if (ttsStatus.value === 'playing' && _workerFailed) {
      const synth = _getSynth()
      if (synth) { synth.cancel(); _speakNextWebSpeech() }
    }
  }

  const setVolume = (vol) => {
    ttsVolume.value = vol
    if (_gainNode) _gainNode.gain.value = vol
  }

  const setVoice = (voiceId) => {
    ttsVoiceId.value = voiceId
    _prefetchBuffer = null
    if (ttsStatus.value === 'playing' && !_workerFailed && _workerReady) {
      _stopCurrentSource()
      _playNextKokoro()
    }
  }

  const seekToProgress = (pct) => {
    if (!_chunks.length) return
    _stopCurrentSource()
    const synth = _getSynth()
    if (synth) synth.cancel()
    _prefetchBuffer = null
    _chunkIdx = Math.max(0, Math.min(_chunks.length - 1, Math.floor((pct / 100) * _chunks.length)))
    _updateProgress()
    if (ttsStatus.value === 'playing') {
      if (!_workerFailed && _workerReady) _playNextKokoro()
      else _speakNextWebSpeech()
    }
  }

  const skipChunks = (delta) => {
    if (!_chunks.length) return
    _stopCurrentSource()
    const synth = _getSynth()
    if (synth) synth.cancel()
    _prefetchBuffer = null
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
