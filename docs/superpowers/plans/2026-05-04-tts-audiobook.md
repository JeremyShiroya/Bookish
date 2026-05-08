# TTS Audiobook Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the PlayingBar functional for audiobook playback using VoxCPM as primary TTS engine with Web Speech API automatic fallback, wired to play buttons on every book card.

**Architecture:** A `useTTS` composable holds all shared playback state via Nuxt `useState`. Two Nitro server routes proxy text to VoxCPM (when `VOXCPM_URL` env var is set) or return `{ engine: 'webspeech' }` to trigger client-side fallback. PlayingBar reads/writes `useTTS` state. Book card play buttons call `useTTS().play(book)`.

**Tech Stack:** Nuxt 4, Vue 3, Web Speech API (browser built-in), VoxCPM HTTP service (optional), vitest for pure-function tests

---

### Task 1: Server TTS status route

**Files:**
- Create: `server/api/tts/status.get.ts`

- [ ] **Step 1: Create the route**

Create `server/api/tts/status.get.ts` with exactly this content:

```ts
export default defineEventHandler(async () => {
  const url = process.env.VOXCPM_URL
  if (!url) return { available: false, engine: 'webspeech' }

  try {
    const res = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(2000),
    })
    return { available: res.ok, engine: res.ok ? 'voxcpm' : 'webspeech' }
  } catch {
    return { available: false, engine: 'webspeech' }
  }
})
```

- [ ] **Step 2: Verify it responds**

Start the dev server (`npm run dev`) then in a new terminal:

```bash
curl http://localhost:3000/api/tts/status
```

Expected (no `VOXCPM_URL` set): `{"available":false,"engine":"webspeech"}`

- [ ] **Step 3: Commit**

```bash
git add server/api/tts/status.get.ts
git commit -m "feat: add TTS status route for VoxCPM health check"
```

---

### Task 2: Server TTS proxy route

**Files:**
- Create: `server/api/tts/index.post.ts`

- [ ] **Step 1: Create the route**

Create `server/api/tts/index.post.ts` with exactly this content:

```ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const voxcpmUrl = process.env.VOXCPM_URL
  const speaker = process.env.VOXCPM_SPEAKER || 'default'
  const apiKey = process.env.VOXCPM_API_KEY
  const ttsPath = process.env.VOXCPM_TTS_PATH || '/tts'

  if (!voxcpmUrl) {
    return { engine: 'webspeech' }
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  try {
    const response = await fetch(`${voxcpmUrl}${ttsPath}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: body.text,
        speaker,
        speed: body.speed ?? 1.0,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      console.error(`[TTS] VoxCPM returned ${response.status}`)
      return { engine: 'webspeech' }
    }

    const contentType = response.headers.get('content-type') || 'audio/wav'
    const audioBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(audioBuffer).toString('base64')
    const mimeType = contentType.split(';')[0].trim()

    return {
      engine: 'voxcpm',
      audio: `data:${mimeType};base64,${base64}`,
    }
  } catch (err) {
    console.error('[TTS] VoxCPM error:', err)
    return { engine: 'webspeech' }
  }
})
```

- [ ] **Step 2: Verify it responds (fallback path)**

With dev server running:

```bash
curl -X POST http://localhost:3000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello world","speed":1.0}'
```

Expected (no `VOXCPM_URL` set): `{"engine":"webspeech"}`

- [ ] **Step 3: Document required env vars**

Add to `.env` (create it at the project root if it doesn't exist):

```
# VoxCPM TTS integration (all optional — Web Speech API used when unset)
# VOXCPM_URL=http://localhost:8000
# VOXCPM_SPEAKER=default
# VOXCPM_API_KEY=
# VOXCPM_TTS_PATH=/tts
```

- [ ] **Step 4: Commit**

```bash
git add server/api/tts/index.post.ts .env
git commit -m "feat: add TTS proxy route for VoxCPM with Web Speech fallback"
```

---

### Task 3: `useTTS` composable

**Files:**
- Create: `composables/useTTS.js`
- Create: `composables/useTTS.test.js`

- [ ] **Step 1: Write the failing tests**

Create `composables/useTTS.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { stripHtml, splitToChunks, formatDuration } from './useTTS.js'

describe('stripHtml', () => {
  it('removes block tags and collapses whitespace', () => {
    expect(stripHtml('<p>Hello</p><p>World</p>')).toBe('Hello World')
  })
  it('removes style blocks entirely', () => {
    expect(stripHtml('<style>body{color:red}</style><p>Text</p>')).toBe('Text')
  })
  it('removes script blocks entirely', () => {
    expect(stripHtml('<script>alert(1)</script><p>Safe</p>')).toBe('Safe')
  })
  it('decodes common HTML entities', () => {
    expect(stripHtml('&amp; &lt; &gt; &quot; &#39; &nbsp;')).toBe('& < > " \' ')
  })
  it('returns empty string for null/empty', () => {
    expect(stripHtml(null)).toBe('')
    expect(stripHtml('')).toBe('')
  })
})

describe('splitToChunks', () => {
  it('splits long text at sentence boundaries', () => {
    const text = 'First sentence. Second sentence. Third sentence.'
    const chunks = splitToChunks(text, 30)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.join(' ')).toContain('First sentence')
    expect(chunks.join(' ')).toContain('Third sentence')
  })
  it('preserves all text content across chunks', () => {
    const text = 'Alpha sentence. Beta sentence. Gamma sentence.'
    const chunks = splitToChunks(text, 30)
    const rejoined = chunks.join(' ')
    expect(rejoined).toContain('Alpha')
    expect(rejoined).toContain('Beta')
    expect(rejoined).toContain('Gamma')
  })
  it('returns non-empty chunks only', () => {
    const chunks = splitToChunks('  .  .  ')
    chunks.forEach(c => expect(c.length).toBeGreaterThan(0))
  })
  it('handles text with no sentence terminators as one chunk', () => {
    const text = 'A plain sentence without terminator'
    const chunks = splitToChunks(text)
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks.join(' ')).toContain('plain sentence')
  })
})

describe('formatDuration', () => {
  it('formats 0 seconds', () => {
    expect(formatDuration(0)).toBe('0:00')
  })
  it('formats 65 seconds as 1:05', () => {
    expect(formatDuration(65)).toBe('1:05')
  })
  it('pads single-digit seconds', () => {
    expect(formatDuration(61)).toBe('1:01')
  })
  it('formats large values', () => {
    expect(formatDuration(3600)).toBe('60:00')
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npx vitest run composables/useTTS.test.js
```

Expected: FAIL — `Cannot find module './useTTS.js'`

- [ ] **Step 3: Create the composable**

Create `composables/useTTS.js`:

```js
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
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npx vitest run composables/useTTS.test.js
```

Expected: PASS — 12 tests, all green

- [ ] **Step 5: Commit**

```bash
git add composables/useTTS.js composables/useTTS.test.js
git commit -m "feat: add useTTS composable with Web Speech and VoxCPM engine"
```

---

### Task 4: Rewrite PlayingBar

**Files:**
- Modify: `components/PlayingBar.vue` (full rewrite)

- [ ] **Step 1: Replace the entire file**

Replace `components/PlayingBar.vue` with:

```vue
<template>
  <div class="playing-bar">

    <!-- Left: Book info -->
    <div class="track-info">
      <template v-if="ttsBook">
        <div class="album-art">
          <img
            :src="resolveBookCover(ttsBook)"
            :alt="ttsBook.title"
            @error="(e) => coverFallback(e, ttsBook.title)"
          />
        </div>
        <div class="track-details">
          <h4 class="track-title">{{ ttsBook.title }}</h4>
          <p class="artist-name">{{ ttsBook.author }}</p>
        </div>
        <button
          class="icon-btn like-btn"
          :title="ttsBook.isFavourite ? 'Unfavourite' : 'Favourite'"
          @click="handleFavourite"
        >
          <i :class="ttsBook.isFavourite ? 'ri-heart-fill' : 'ri-heart-line'"
             :style="{ color: ttsBook.isFavourite ? '#ef4444' : '' }"></i>
        </button>
      </template>
      <template v-else>
        <div class="idle-info">
          <i class="ri-headphone-line"></i>
          <span>Nothing playing</span>
        </div>
      </template>
    </div>

    <!-- Center: Controls + Progress -->
    <div class="player-controls">
      <div class="control-buttons">
        <button class="icon-btn" title="Skip back" :disabled="isIdle" @click="skipChunks(-10)">
          <i class="ri-skip-back-line"></i>
        </button>
        <button class="play-btn" title="Play / Pause" :disabled="isIdle && !ttsBook" @click="handlePlayPause">
          <i v-if="ttsStatus === 'loading'" class="ri-loader-4-line spinner"></i>
          <i v-else-if="ttsStatus === 'playing'" class="ri-pause-fill"></i>
          <i v-else class="ri-play-fill"></i>
        </button>
        <button class="icon-btn" title="Skip forward" :disabled="isIdle" @click="skipChunks(10)">
          <i class="ri-skip-forward-line"></i>
        </button>
        <button class="icon-btn stop-btn" title="Stop" :disabled="isIdle" @click="stop">
          <i class="ri-stop-fill"></i>
        </button>
      </div>

      <div class="progress-container">
        <span class="time">{{ elapsedTime }}</span>
        <div class="progress-bar-wrapper">
          <input
            type="range"
            min="0"
            max="100"
            :value="ttsProgress"
            class="progress-slider"
            :disabled="isIdle"
            @input="seekToProgress(Number($event.target.value))"
          />
          <div class="progress-fill" :style="{ width: ttsProgress + '%' }"></div>
        </div>
        <span class="time">{{ totalTime }}</span>
      </div>
    </div>

    <!-- Right: Speed, Voice, Volume -->
    <div class="extra-controls">
      <button
        class="icon-btn speed-btn"
        :disabled="isIdle"
        title="Playback speed"
        @click="cycleSpeed"
      >{{ speedLabel }}</button>

      <div class="voice-select-wrap" v-if="ttsEngine === 'webspeech' && ttsVoices.length > 0">
        <select
          class="voice-select"
          :value="ttsVoiceName"
          :disabled="isIdle"
          @change="setVoice($event.target.value)"
        >
          <option v-for="v in ttsVoices" :key="v.name" :value="v.name">{{ v.name }}</option>
        </select>
      </div>

      <span class="engine-badge" :class="ttsEngine">
        {{ ttsEngine === 'voxcpm' ? 'VoxCPM' : 'Web Speech' }}
      </span>

      <div class="volume-control">
        <button class="icon-btn volume-btn" title="Mute / Unmute" @click="toggleMute">
          <i :class="isMuted ? 'ri-volume-mute-line' : 'ri-volume-up-line'"></i>
        </button>
        <div class="volume-slider-wrapper">
          <input
            type="range"
            min="0"
            max="100"
            :value="Math.round(ttsVolume * 100)"
            class="volume-slider"
            @input="handleVolume($event.target.value)"
          />
          <div class="volume-fill" :style="{ width: Math.round(ttsVolume * 100) + '%' }"></div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useTTS } from '~/composables/useTTS'
import { useBooks } from '~/composables/useBooks'

const {
  ttsBook, ttsStatus, ttsProgress, ttsSpeed, ttsVolume,
  ttsVoiceName, ttsVoices, ttsEngine, elapsedTime, totalTime,
  togglePlay, stop, skipChunks, setSpeed, setVolume, setVoice,
  seekToProgress, initVoices, checkVoxCPM,
} = useTTS()

const { toggleFavourite } = useBooks()

const isIdle = computed(() => ttsStatus.value === 'idle')
const isMuted = ref(false)
const prevVolume = ref(1.0)

const SPEEDS = [0.75, 1.0, 1.25, 1.5, 2.0]

const speedLabel = computed(() => {
  const s = ttsSpeed.value
  return s === 1.0 ? '1×' : s + '×'
})

const cycleSpeed = () => {
  const idx = SPEEDS.indexOf(ttsSpeed.value)
  setSpeed(SPEEDS[(idx + 1) % SPEEDS.length])
}

const handlePlayPause = () => {
  if (ttsStatus.value === 'loading') return
  togglePlay()
}

const handleFavourite = () => {
  if (ttsBook.value) toggleFavourite(ttsBook.value.id)
}

const handleVolume = (val) => {
  isMuted.value = false
  setVolume(Number(val) / 100)
}

const toggleMute = () => {
  if (isMuted.value) {
    setVolume(prevVolume.value)
    isMuted.value = false
  } else {
    prevVolume.value = ttsVolume.value || 1.0
    setVolume(0)
    isMuted.value = true
  }
}

const generateCoverPlaceholder = (title) => {
  const colors = ['#8A2BE2', '#6A0DAD', '#9370DB', '#BA55D3', '#DDA0DD']
  const hash = [...title].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const color = colors[hash % colors.length]
  const initial = title.trim()[0]?.toUpperCase() || '?'
  const displayTitle = title.length > 18 ? title.substring(0, 18) + '…' : title
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="${color}"/><text x="100" y="130" font-family="serif" font-size="100" fill="rgba(255,255,255,0.25)" text-anchor="middle" dominant-baseline="middle">${initial}</text><text x="100" y="230" font-family="sans-serif" font-size="11" fill="rgba(255,255,255,0.65)" text-anchor="middle">${displayTitle}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const STALE_COVERS = ['/Images/The Boyfriend.jpg']

const resolveBookCover = (book) => {
  if (!book.cover || STALE_COVERS.includes(book.cover)) return generateCoverPlaceholder(book.title)
  return book.cover
}

const coverFallback = (event, title) => {
  event.target.src = generateCoverPlaceholder(title)
}

onMounted(() => {
  initVoices()
  checkVoxCPM()
})
</script>

<style scoped>
.playing-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 90px;
  background: #ffffff;
  border-top: 1px solid #e5e7eb;
  padding: 0 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 1000;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
}

/* ── Shared icon button ── */
.icon-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #6b7280;
  font-size: 1.1rem;
  padding: 8px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}
.icon-btn:hover:not(:disabled) { color: #1f2937; background: #f3f4f6; }
.icon-btn:disabled { opacity: 0.35; cursor: default; }

/* ── Left: Track info ── */
.track-info {
  display: flex;
  align-items: center;
  width: 28%;
  min-width: 180px;
  gap: 0.75rem;
}

.album-art {
  width: 45px;
  height: 63px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
.album-art img { width: 100%; height: 100%; object-fit: cover; }

.track-details { overflow: hidden; flex: 1; }
.track-title {
  font-size: 0.875rem;
  font-weight: 400;
  color: #111827;
  margin: 0 0 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.artist-name {
  font-size: 0.75rem;
  color: #6b7280;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.idle-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #9ca3af;
  font-size: 0.875rem;
}
.idle-info i { font-size: 1.25rem; }

.like-btn:hover:not(:disabled) { color: #ef4444 !important; }

/* ── Center: Controls + progress ── */
.player-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 44%;
  max-width: 560px;
  gap: 0.35rem;
}

.control-buttons {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.play-btn {
  background: #1f2937;
  color: white;
  border: none;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.2rem;
  transition: transform 0.15s, background 0.15s;
  flex-shrink: 0;
}
.play-btn:hover:not(:disabled) { background: #374151; transform: scale(1.05); }
.play-btn:disabled { opacity: 0.4; cursor: default; }

.stop-btn { font-size: 1.2rem; }

.progress-container {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 0.6rem;
}
.time { font-size: 0.7rem; color: #9ca3af; min-width: 32px; text-align: center; }

.progress-bar-wrapper {
  position: relative;
  flex: 1;
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  cursor: pointer;
}
.progress-slider {
  position: absolute;
  top: -8px;
  left: 0;
  width: 100%;
  height: 20px;
  opacity: 0;
  cursor: pointer;
  z-index: 2;
  margin: 0;
}
.progress-slider:disabled { cursor: default; }
.progress-fill {
  position: absolute;
  top: 0; left: 0;
  height: 100%;
  background: #4b5563;
  border-radius: 2px;
  pointer-events: none;
  transition: width 0.3s linear;
}
.progress-bar-wrapper:hover .progress-fill { background: #8A2BE2; }

/* ── Right: Speed / Voice / Volume ── */
.extra-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 28%;
  min-width: 180px;
  gap: 0.4rem;
}

.speed-btn {
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 400;
  min-width: 36px;
  padding: 4px 6px;
  letter-spacing: 0.01em;
}

.voice-select-wrap { max-width: 100px; overflow: hidden; }
.voice-select {
  font-size: 0.7rem;
  color: #6b7280;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  padding: 3px 4px;
  background: white;
  cursor: pointer;
  max-width: 100px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.voice-select:disabled { opacity: 0.4; cursor: default; }

.engine-badge {
  font-size: 0.6rem;
  font-weight: 400;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
  flex-shrink: 0;
}
.engine-badge.webspeech { background: #f3f4f6; color: #9ca3af; }
.engine-badge.voxcpm    { background: #dbeafe; color: #2563eb; }

.volume-control {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.volume-slider-wrapper {
  position: relative;
  width: 70px;
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  cursor: pointer;
}
.volume-slider {
  position: absolute;
  top: -8px; left: 0;
  width: 100%;
  height: 20px;
  opacity: 0;
  cursor: pointer;
  z-index: 2;
  margin: 0;
}
.volume-fill {
  position: absolute;
  top: 0; left: 0;
  height: 100%;
  background: #4b5563;
  border-radius: 2px;
  pointer-events: none;
}
.volume-slider-wrapper:hover .volume-fill { background: #8A2BE2; }

.spinner { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Responsive ── */
@media (max-width: 768px) {
  .extra-controls { display: none; }
  .track-info { width: 38%; }
  .player-controls { width: 62%; }
}
@media (max-width: 500px) {
  .album-art { display: none; }
  .track-info { width: auto; flex: 1; }
  .player-controls { width: auto; }
}
</style>
```

- [ ] **Step 2: Verify visually**

With dev server running, open the app. Confirm:
- PlayingBar shows "Nothing playing" with headphone icon
- All buttons are visibly dimmed (disabled state)
- No console errors

- [ ] **Step 3: Commit**

```bash
git add components/PlayingBar.vue
git commit -m "feat: rewrite PlayingBar with full TTS controls wired to useTTS"
```

---

### Task 5: Wire play buttons in BooksComp

**Files:**
- Modify: `components/BooksComp.vue`

- [ ] **Step 1: Import useTTS in the script block**

In `components/BooksComp.vue`, find this line (around line 328):

```js
const { books, loading, updateBook, deleteBook: removeBookFromStore, addBook, toggleFavourite, fetchAllData } = useBooks();
```

Add directly after it:

```js
const { play: playTTS, ttsBook, ttsStatus } = useTTS()
import { useTTS } from '~/composables/useTTS'
```

Wait — in Vue 3 `<script setup>` you can't use `import` after statements. Place the import at the top of the script block, after the existing imports. Find:

```js
import { useBooks } from "~/composables/useBooks";
```

Add on the next line:

```js
import { useTTS } from "~/composables/useTTS";
```

Then add after the `useBooks()` destructuring line:

```js
const { play: playTTS, ttsBook, ttsStatus } = useTTS()

const isBookActive = (book) =>
  ttsBook.value?.id === book.id && ttsStatus.value !== 'idle'

const handlePlay = (book) => {
  playTTS(book)
}
```

- [ ] **Step 2: Wire the play button in the grid card (line ~212)**

Find:

```html
<button class="play-btn" title="Play" @click.stop>
  <i class="ri-play-fill"></i>
</button>
```

Replace with:

```html
<button
  class="play-btn"
  :class="{ active: isBookActive(book) }"
  title="Read aloud"
  @click.stop="handlePlay(book)"
>
  <i :class="isBookActive(book) ? 'ri-pause-fill' : 'ri-play-fill'"></i>
</button>
```

- [ ] **Step 3: Add active state style for play-btn**

Find `.play-btn:hover` in the `<style scoped>` block and add after it:

```css
.play-btn.active {
  opacity: 1;
  transform: translateY(0);
  background: #8A2BE2;
}
```

- [ ] **Step 4: Verify end-to-end flow**

With dev server running:
1. Hover over any book card — confirm play button appears
2. Click the play button — confirm PlayingBar shows the book title/cover and status changes to playing (or loading briefly)
3. Web Speech should start reading within 1–2 seconds
4. Confirm pause/stop buttons in PlayingBar work
5. Confirm progress bar advances as reading continues

- [ ] **Step 5: Commit**

```bash
git add components/BooksComp.vue
git commit -m "feat: wire book card play buttons to TTS engine"
```
