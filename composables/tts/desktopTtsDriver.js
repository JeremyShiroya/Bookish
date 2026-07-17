// Desktop TTS synthesis pipeline — INDEPENDENT from the mobile pipeline.
//
// The desktop/web build has a Nuxt server available, so it synthesizes Edge
// Read Aloud speech server-side (server/api/tts → msedge-tts) and receives an
// mp3 data URL + word boundaries for highlighting. If the server can't
// synthesize (e.g. it can't reach Microsoft), it falls back to the browser's
// built-in voices — desktop browsers implement the Web Speech API that the
// @capacitor-community/text-to-speech web layer uses — so narration still works.
//
// This file is intentionally isolated from composables/tts/mobileTtsDriver.js:
// changes to desktop synthesis must never affect mobile, and vice-versa.

import { nativeSpeechSupported } from '~/composables/tts/nativeSpeech'

// A usable reply carries an mp3 data URL in `audio`. Anything else means the
// endpoint didn't synthesize: most often there is no Nuxt server behind this
// build (a static/exported host answers /api/tts with the SPA's index.html and
// a cheerful 200), so $fetch resolves instead of throwing and the failure would
// otherwise sail through as a silent chunk.
function hasUsableAudio(result) {
  return typeof result?.audio === 'string' && result.audio.startsWith('data:audio')
}

// Returns { audio, boundaries } for <audio> playback, or a { native: true }
// marker the shared engine speaks live with the device voice.
export async function synthesizeDesktopSpeech({ text, voice, speed, apiUrl }) {
  let result
  try {
    result = await $fetch(apiUrl('/api/tts'), {
      method: 'POST',
      body: { text, voice, speed },
    })
  } catch (error) {
    console.warn('[TTS] Desktop server synth failed; trying browser voice:', error?.message || error)
    if (nativeSpeechSupported()) {
      return { native: true, text, voice, speed }
    }
    throw error
  }

  if (hasUsableAudio(result)) return result

  console.warn('[TTS] Desktop server returned no audio; trying browser voice.')
  if (nativeSpeechSupported()) {
    return { native: true, text, voice, speed }
  }
  throw new Error('TTS endpoint returned no audio')
}
