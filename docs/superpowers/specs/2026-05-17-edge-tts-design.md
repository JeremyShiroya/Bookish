# edge-tts Audiobook Player — Design Spec
_Date: 2026-05-17_

## Goal

Replace the browser's Web Speech API with Microsoft Edge TTS (`msedge-tts` npm package) as the single TTS engine. Remove all traces of VoxCPM from the codebase and documentation. The result is a neural-quality audiobook player that runs entirely in Node.js — no Python, no sidecar process, no external server to manage.

---

## Architecture

```
PlayingBar (Vue)
    ↓ user presses play
useTTS.js
    ↓ POST /api/tts  { text, voice, speed }
server/api/tts/index.post.ts
    ↓ msedge-tts (Node.js) → Microsoft Edge TTS WebSocket
    ↑ { audio: 'data:audio/mp3;base64,...' }
useTTS.js
    ↑ new Audio(base64url).play()
```

---

## New Dependency

**`msedge-tts`** (npm) — TypeScript-native package that opens a WebSocket to Microsoft's Edge TTS backend, streams MP3 audio, and collects it into a Buffer. No Python, no GPU, no model download.

Install: `npm install msedge-tts`

---

## Server: `server/api/tts/index.post.ts` (new file)

**Request body:**
```ts
{ text: string, voice: string, speed: number }
```

**Response:**
```ts
{ audio: string }  // data:audio/mp3;base64,...
```

**Speed mapping** (Web Speech rate → Edge TTS SSML prosody rate):
| Composable value | Edge TTS rate string |
|---|---|
| 0.75 | `-25%` |
| 1.0  | `+0%`  |
| 1.25 | `+25%` |
| 1.5  | `+50%` |
| 2.0  | `+100%` |

**Implementation notes:**
- Use `MsEdgeTTS` from `msedge-tts`, set metadata to `OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3`
- Call `toStream(text)` and pipe into a Buffer via `stream.read()` chunks
- Base64-encode the buffer and prefix with `data:audio/mp3;base64,`
- Return 500 with `{ error }` message on failure so the client can surface a toast

---

## Composable: `composables/useTTS.js` (rewrite playback engine)

### State — no changes to shape

All existing `useState` keys are preserved with the same names. `ttsVoices` now holds the hardcoded edge-tts voice list instead of browser voices.

Remove: `tts:engine` (was only needed for VoxCPM/WebSpeech switching).

### Voice list (hardcoded)

Eight curated English neural voices covering both genders and accents:

```js
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
```

Default voice: `en-US-ChristopherNeural`.

### Chunk size

Increase from `180` → `400` characters. Fewer API round-trips, and edge-tts handles longer text naturally.

### Playback engine — `_speakNextEdge()`

Replaces `_speakNext()` (Web Speech). Per-chunk flow:

1. POST `/api/tts` with `{ text: _chunks[_chunkIdx], voice: ttsVoiceId, speed: ttsSpeed }`
2. On success: `const audio = new Audio(data.audio); audio.volume = ttsVolume.value`
3. `audio.onended` → if still playing: `_chunkIdx++; _speakNextEdge()`
4. `audio.onerror` → show toast error, set status to `'idle'`
5. `audio.play()`
6. Store reference in `_currentAudio` for pause/resume/stop

### Pause / Resume

Web Speech API's pause is unreliable across browsers. HTMLAudioElement is clean:
- `pause()` → `_currentAudio?.pause()`
- `resume()` → `_currentAudio?.play()`

### Stop / Cancel

```js
_currentAudio?.pause()
_currentAudio = null
```

No stale-callback protection needed (HTMLAudioElement events don't fire after `.pause()`).

### Pre-fetch next chunk

While current chunk audio plays, fire the next chunk's API call in the background and cache the resulting base64 string. When `onended` fires, if the next audio is ready, play it immediately (zero gap). If not ready yet, wait for the in-flight request.

This hides the ~200–400ms network round-trip between chunks.

### Volume

`_currentAudio.volume = vol` — live, no restart needed.

### Speed / Voice changes

Both require re-fetching audio for the current chunk from the API (the audio blob changes). Cancel current audio, re-call `_speakNextEdge()` from the same `_chunkIdx`.

### Remove entirely

- `_getSynth()`, `_getVoice()`, `loadVoices()`
- All `speechSynthesis` / `SpeechSynthesisUtterance` usage
- The Firefox resume workaround (`synth.speaking` check)
- The Chrome interrupted-error re-queue logic

### Keep entirely

- `stripHtml()`, `splitToChunks()`, `findContentStart()`, `formatDuration()`
- All frontmatter / copyright detection
- `seekToProgress()`, `skipChunks()`
- Progress tracking (`_updateProgress`)
- `setSpeed`, `setVoice`, `setVolume` — same public signatures, different internals

---

## Component: `components/PlayingBar.vue`

**Remove:**
- `loadVoices()` call in `onMounted`

**Keep unchanged:**
- Voice `<select>` dropdown — already driven by `ttsVoices` state, which now contains the hardcoded edge-tts list
- All controls, layout, styles

---

## Cleanup

| Location | Action |
|---|---|
| `.env` | Remove `VOXCPM_URL`, `VOXCPM_SPEAKER`, `VOXCPM_API_KEY` lines |
| `docs/superpowers/specs/2026-05-04-tts-audiobook-design.md` | Delete (superseded by this doc) |
| Any plan files referencing VoxCPM | Remove or replace references |

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| `/api/tts` returns 500 | Toast error: "TTS failed — check your connection", status → `'idle'` |
| Book has no text content | Existing toast: "This book has no readable text content", no change |
| Microsoft servers unreachable | Same as above (500 path) |

---

## Not in scope

- Offline fallback (Web Speech API removed entirely)
- Streaming audio (buffer-and-play is simpler and sufficient for 400-char chunks)
- Caching audio blobs across sessions
- Adding new voices beyond the hardcoded 8
