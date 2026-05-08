# TTS Audiobook Feature Design

**Date:** 2026-05-04  
**Status:** Approved

---

## Goal

Make the PlayingBar functional for audiobook playback using VoxCPM (OpenBMB) as the primary TTS engine, with the browser's Web Speech API as an automatic fallback. Clicking the play button on any book card starts reading that book aloud. The PlayingBar shows live playback state and controls.

---

## Architecture

Five pieces with clear boundaries:

```
Book card play btn
       ↓
composables/useTTS.js          ← singleton state + engine logic
       ↓
server/api/tts/index.post.ts   ← VoxCPM proxy (returns base64 audio)
server/api/tts/status.get.ts   ← health check → chooses engine
       ↑
components/PlayingBar.vue      ← reads/writes useTTS state
components/BooksComp.vue       ← wires play buttons to useTTS.play()
```

---

## Files

| File | Action |
|---|---|
| `composables/useTTS.js` | Create |
| `server/api/tts/index.post.ts` | Create |
| `server/api/tts/status.get.ts` | Create |
| `components/PlayingBar.vue` | Rewrite |
| `components/BooksComp.vue` | Minor: wire play buttons |

---

## composables/useTTS.js

### Shared state (Nuxt `useState` — survives navigation, accessible anywhere)

| Key | Type | Default |
|---|---|---|
| `tts:book` | `BookObject \| null` | `null` |
| `tts:status` | `'idle' \| 'loading' \| 'playing' \| 'paused'` | `'idle'` |
| `tts:progress` | `number` (0–100) | `0` |
| `tts:chunkIdx` | `number` | `0` |
| `tts:totalChunks` | `number` | `0` |
| `tts:speed` | `number` | `1.0` |
| `tts:volume` | `number` (0–1) | `1.0` |
| `tts:voice` | `string` | `''` |
| `tts:voices` | `{name,lang}[]` | `[]` |
| `tts:engine` | `'webspeech' \| 'voxcpm'` | `'webspeech'` |
| `tts:voxcpm` | `boolean` | `false` |

### Module-level internal vars (not reactive, singleton)

- `_chunks: string[]` — current book split into sentence chunks
- `_chunkIdx: number` — current position in chunks array
- `_synth: SpeechSynthesis | null` — Web Speech API handle
- `_currentAudio: HTMLAudioElement | null` — VoxCPM audio element

### Public API

```js
play(book)           // load book, fetch content if absent, start playback
pause()              // pause current chunk
resume()             // resume from pause
stop()               // cancel everything, reset state
togglePlay()         // play↔pause shortcut for the play button
setSpeed(rate)       // change rate; restarts current chunk if playing
setVolume(vol)       // 0–1; live update to current audio element
setVoice(name)       // Web Speech only; restarts current chunk if playing
seekToProgress(pct)  // jump to % position in chunk array
initVoices()         // populate tts:voices from speechSynthesis.getVoices()
checkVoxCPM()        // ping /api/tts/status, set engine + voxcpmOnline
```

### Text pipeline

1. Strip HTML (remove `<style>`, `<script>`, tags, decode HTML entities)
2. Split at sentence boundaries (`[^.!?]+[.!?]*`) into ~180-char chunks
3. Feed chunks sequentially; each chunk's `onend` triggers the next
4. `tts:progress` = `Math.round((chunkIdx / totalChunks) * 100)`

### Engine selection

- `checkVoxCPM()` called once on `PlayingBar` mount
- If `/api/tts/status` returns `{ available: true }` → engine = `'voxcpm'`
- If VoxCPM call fails mid-playback → automatically continue with Web Speech from current chunk

### VoxCPM path (chunk loop)

```
POST /api/tts { text, speed, voice }
  → { engine: 'voxcpm', audio: 'data:audio/wav;base64,...' }
  → new Audio(res.audio) → play → onended → next chunk
  → on error → fall back to Web Speech for remaining chunks
```

### Web Speech path (chunk loop)

```
new SpeechSynthesisUtterance(chunk)
  set .rate, .volume, .voice
  onend → next chunk
  onerror (not 'interrupted') → log, continue
```

---

## server/api/tts/status.get.ts

Pings `${VOXCPM_URL}/health` with a 2-second timeout.

```
GET /api/tts/status
Response: { available: boolean, engine: 'voxcpm' | 'webspeech' }
```

If `VOXCPM_URL` is not set → returns `{ available: false, engine: 'webspeech' }` immediately.

---

## server/api/tts/index.post.ts

```
POST /api/tts
Body: { text: string, speed?: number, voice?: string }
Response: { engine: 'voxcpm', audio: 'data:<mime>;base64,...' }
       or { engine: 'webspeech' }  (when VOXCPM_URL unset or VoxCPM errors)
```

**VoxCPM request format** (based on OpenBMB/VoxCPM repo):

```json
POST ${VOXCPM_URL}/tts
{
  "text": "...",
  "speaker": "<VOXCPM_SPEAKER env var, default 'default'>",
  "speed": 1.0
}
```

VoxCPM returns raw audio bytes. Server converts to base64 data URL and returns JSON. `Content-Type` of VoxCPM response determines MIME type (`audio/wav` assumed if not set).

**Environment variables:**

| Var | Required | Description |
|---|---|---|
| `VOXCPM_URL` | No | Base URL of VoxCPM server e.g. `http://localhost:8000` |
| `VOXCPM_SPEAKER` | No | Speaker/voice ID to pass to VoxCPM (default: `'default'`) |
| `VOXCPM_API_KEY` | No | Bearer token for VoxCPM if auth is enabled |
| `VOXCPM_TTS_PATH` | No | Override TTS endpoint path (default: `/tts`) |

All are optional. Without `VOXCPM_URL` the feature works via Web Speech immediately.

---

## components/PlayingBar.vue

### Layout (3 columns, 90px bar)

**Left — Track info (30%)**
- Book cover (from `ttsBook.cover`; uses existing `resolveBookCover` pattern)
- Title + author (truncated)
- Heart button (toggles favourite via `useBooks().toggleFavourite`)
- Idle state: book icon + "Nothing playing" text

**Center — Controls (40%)**
- Row 1: `[⏮ -10 chunks]` `[⏸/▶]` `[⏭ +10 chunks]` `[■ stop]`
- Row 2: Progress slider (0–100, draggable → `seekToProgress`) + elapsed/total time
- Loading state: spinner in place of play button
- Estimated time from chunk count × (WORDS_PER_CHUNK / WORDS_PER_MIN / speed)

**Right — Settings (30%)**
- Speed button: cycles `0.75→1→1.25→1.5→2→0.75`, displays current as `1x`, `1.25x` etc.
- Voice dropdown: shows available English Web Speech voices; hidden when engine = `'voxcpm'`
- Volume slider (functional, live)
- Engine badge: `WEB SPEECH` (gray) or `VoxCPM` (purple) — updates automatically

### States

| Status | Play button | Progress | Controls |
|---|---|---|---|
| `idle` | disabled gray | 0% | most disabled |
| `loading` | spinner | 0% | disabled |
| `playing` | pause icon | live | all active |
| `paused` | play icon | frozen | all active |

---

## components/BooksComp.vue changes

- Import `useTTS` 
- Grid card play button: `@click.stop="useTTS().play(book)"`
- Table row: no change needed (table doesn't have a play button currently)
- If `ttsBook.id === book.id && ttsStatus !== 'idle'`: play button shows pause icon and purple tint

---

## Error handling

- **Book has no content:** `play()` shows a brief alert — "No readable content for audio playback"
- **VoxCPM times out/errors:** silent fallback to Web Speech for remaining chunks; engine badge updates to `WEB SPEECH`
- **Web Speech not supported:** `play()` alerts "Audio playback not supported in this browser"

---

## Not in scope

- Audiobook queue / playlist
- Chapter-level navigation (chunks are sentence-level, not chapter-level)
- Progress persistence (reading progress is already persisted separately by the reader page)
- Mobile PlayingBar redesign
