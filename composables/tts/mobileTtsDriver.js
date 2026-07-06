// Mobile TTS synthesis pipeline — INDEPENDENT from the desktop pipeline.
//
// The native app has no bundled Nuxt server, so it synthesizes Edge Read Aloud
// speech straight from the WebView (useEdgeSpeechClient). If Edge fails for any
// reason — offline, or Microsoft rejecting the handshake — it disables the
// cloud path for the session and signals the shared engine to speak with the
// phone's built-in voice (a `{ native: true }` marker the engine plays live via
// composables/tts/nativeSpeech.js).
//
// Isolated from composables/tts/desktopTtsDriver.js on purpose: changes here
// must never affect desktop synthesis, and vice-versa.

import { synthesizeEdgeSpeechInBrowser } from '~/composables/useEdgeSpeechClient'
import { nativeSpeechSupported } from '~/composables/tts/nativeSpeech'

// Once Edge fails we stop retrying it for the session so every subsequent chunk
// falls straight through to the device voice with no network wait.
let _edgeDisabled = false

export function mobileTtsEdgeDisabled() {
  return _edgeDisabled
}

// Re-enable the cloud path (e.g. the user reconnects / restarts narration).
export function resetMobileTtsDriver() {
  _edgeDisabled = false
}

export async function synthesizeMobileSpeech({ text, voice, speed, apiUrl, apiBaseUrl }) {
  if (!_edgeDisabled) {
    try {
      // Fail fast to the device voice: one attempt, shorter timeout. A rejected
      // handshake errors near-instantly; only a hung socket hits the timeout.
      return await synthesizeEdgeSpeechInBrowser({ text, voice, speed, attempts: 1, timeoutMs: 12000 })
    } catch (error) {
      console.warn('[TTS] Edge synth failed on device; switching to device voice:', error?.message || error)

      // If a Bookish server is configured, give it one shot before giving up on
      // cloud TTS entirely.
      if (apiBaseUrl) {
        try {
          return await $fetch(apiUrl('/api/tts'), { method: 'POST', body: { text, voice, speed } })
        } catch {
          // fall through to the native device voice
        }
      }

      _edgeDisabled = true
    }
  }

  // Native device-voice fallback. The engine plays this live (no pre-synth
  // audio), so we just hand back a marker describing what to speak.
  if (nativeSpeechSupported()) {
    return { native: true, text, voice, speed }
  }

  throw new Error('No TTS available: Edge synthesis failed and device speech is unsupported')
}
