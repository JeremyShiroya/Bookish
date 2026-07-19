// Mobile TTS synthesis pipeline — INDEPENDENT from the desktop pipeline.
//
// The native app has no bundled Nuxt server, so it synthesizes Edge Read Aloud
// speech straight from the WebView (useEdgeSpeechClient). If Edge fails
// repeatedly — offline, or Microsoft rejecting the handshake — it disables the
// cloud path for the session and signals the shared engine to speak with the
// phone's built-in voice (a `{ native: true }` marker the engine plays live via
// composables/tts/nativeSpeech.js).
//
// Isolated from composables/tts/desktopTtsDriver.js on purpose: changes here
// must never affect desktop synthesis, and vice-versa.

import { synthesizeEdgeSpeechInBrowser } from '~/composables/useEdgeSpeechClient'
import { nativeSpeechSupported } from '~/composables/tts/nativeSpeech'

// Edge is only abandoned after this many CONSECUTIVE failures. A single failure
// used to switch the narrator's voice mid-book for the rest of the session —
// most often because the app was backgrounded and Android throttled the socket,
// not because Edge was actually unreachable.
const EDGE_FAILURE_LIMIT = 3

// Falling back to the device voice is a temporary degradation, not a verdict.
// It used to latch for the whole session, so one hiccup on a train left the
// narrator on the phone's voice until the app was restarted — even after the
// connection came back. Edge is re-probed once the cooldown expires.
const EDGE_COOLDOWN_MS = 60_000

let _edgeDisabledUntil = 0
let _consecutiveEdgeFailures = 0

// The engine keeps up to three synthesis requests in flight at once (the
// playing chunk plus two prefetches). A single network blip therefore fails all
// three at the same instant, which used to count as three "consecutive"
// failures and trip the limit immediately — the unprovoked mid-sentence switch
// to the device voice. Requests are numbered so only a failure from a request
// that STARTED AFTER the previous failure was already known counts as a new
// one; everything already in flight is the same blip.
let _requestSeq = 0
let _lastCountedFailureSeq = -1

export function mobileTtsEdgeDisabled() {
  return _edgeDisabledUntil > 0 && Date.now() < _edgeDisabledUntil
}

// Re-enable the cloud path (e.g. the user reconnects / restarts narration).
export function resetMobileTtsDriver() {
  _edgeDisabledUntil = 0
  _consecutiveEdgeFailures = 0
  _requestSeq = 0
  _lastCountedFailureSeq = -1
}

// Count this failure unless it belongs to a burst already accounted for.
function noteEdgeFailure(requestSeq) {
  if (requestSeq <= _lastCountedFailureSeq) return false
  _lastCountedFailureSeq = _requestSeq - 1
  _consecutiveEdgeFailures += 1
  return true
}

const documentHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden'

export async function synthesizeMobileSpeech({ text, voice, speed, apiUrl, apiBaseUrl }) {
  if (!mobileTtsEdgeDisabled()) {
    // Backgrounded WebViews get their timers and sockets throttled by Android,
    // so a handshake that would take 2s in the foreground can take much longer.
    // Give it room instead of mistaking the throttle for a dead endpoint.
    const hidden = documentHidden()
    const requestSeq = _requestSeq++
    try {
      const result = await synthesizeEdgeSpeechInBrowser({
        text,
        voice,
        speed,
        // Foreground: two short attempts rather than one long one. A single
        // stalled handshake used to hold the sentence for a full 12s before
        // anything retried — the "long load" mid-book.
        attempts: 2,
        timeoutMs: hidden ? 30000 : 6000,
      })
      _consecutiveEdgeFailures = 0
      _lastCountedFailureSeq = -1
      return result
    } catch (error) {
      console.warn('[TTS] Edge synth failed on device:', error?.message || error)

      // If a Bookish server is configured, give it one shot before giving up on
      // cloud TTS entirely — it keeps the same voice.
      if (apiBaseUrl) {
        try {
          const result = await $fetch(apiUrl('/api/tts'), { method: 'POST', body: { text, voice, speed } })
          _consecutiveEdgeFailures = 0
          _lastCountedFailureSeq = -1
          return result
        } catch {
          // fall through
        }
      }

      // While backgrounded, never give up on Edge: switching the narrator's
      // voice mid-sentence is far worse than one retried chunk, and the failure
      // is usually the OS throttling us rather than Edge being unavailable.
      // Surface the error so the engine retries this chunk instead.
      if (hidden) {
        throw error instanceof Error ? error : new Error(String(error))
      }

      noteEdgeFailure(requestSeq)
      if (_consecutiveEdgeFailures >= EDGE_FAILURE_LIMIT) {
        console.warn(`[TTS] Edge failed ${_consecutiveEdgeFailures}× in a row; using the device voice for ${EDGE_COOLDOWN_MS / 1000}s.`)
        _edgeDisabledUntil = Date.now() + EDGE_COOLDOWN_MS
        _consecutiveEdgeFailures = 0
        _lastCountedFailureSeq = -1
      } else {
        // Not yet conclusive — let the engine retry this chunk with Edge.
        throw error instanceof Error ? error : new Error(String(error))
      }
    }
  }

  // Native device-voice fallback. The engine plays this live (no pre-synth
  // audio), so we just hand back a marker describing what to speak.
  if (nativeSpeechSupported()) {
    return { native: true, text, voice, speed }
  }

  throw new Error('No TTS available: Edge synthesis failed and device speech is unsupported')
}
