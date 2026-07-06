// Native (on-device) speech — the offline/fallback pipeline for the MOBILE TTS
// driver. It drives the phone's built-in voices via the OS text-to-speech
// engine, so narration keeps working with no network and no cloud endpoint.
//
// The Android System WebView does NOT implement the Web Speech API
// (window.speechSynthesis is undefined), so this uses the native
// @capacitor-community/text-to-speech plugin instead. The player mimics just
// enough of the HTMLAudioElement surface the TTS engine uses (`play()`→Promise,
// `pause()`, `stop()`, `volume`, `currentTime`, `onended`, `onerror`) so the
// shared engine drives device voices through the exact same code path it uses
// for <audio> playback. There are no word boundaries here, so highlighting is
// skipped in this mode.

import { Capacitor } from '@capacitor/core'
import { TextToSpeech } from '@capacitor-community/text-to-speech'

export function nativeSpeechSupported() {
  try {
    return Capacitor.isPluginAvailable('TextToSpeech')
  } catch {
    return false
  }
}

let _voicesCache = null

// The plugin's getSupportedVoices() returns the OS voice list. Cache it — the
// list is stable for the app session.
export async function loadNativeVoices() {
  if (_voicesCache) return _voicesCache
  try {
    const result = await TextToSpeech.getSupportedVoices()
    _voicesCache = Array.isArray(result?.voices) ? result.voices : []
  } catch {
    _voicesCache = []
  }
  return _voicesCache
}

const FEMALE_EDGE_VOICES = new Set([
  'en-US-JennyNeural', 'en-US-AriaNeural', 'en-GB-SoniaNeural', 'en-AU-NatashaNeural',
])

function langForEdgeVoice(edgeVoiceId) {
  const match = /^([a-z]{2}-[A-Z]{2})/.exec(String(edgeVoiceId || 'en-US-ChristopherNeural'))
  return match ? match[1] : 'en-US'
}

// Choose the index of the device voice that best matches the selected Edge
// voice: prefer an exact BCP-47 language match, then the base language, biasing
// toward a matching gender when the OS voice name hints at one. Returns -1 to
// let the engine use the platform default for the language.
export function pickNativeVoiceIndex(voices, edgeVoiceId) {
  if (!Array.isArray(voices) || !voices.length) return -1

  const fullLang = langForEdgeVoice(edgeVoiceId)
  const baseLang = fullLang.slice(0, 2)
  const wantsFemale = FEMALE_EDGE_VOICES.has(String(edgeVoiceId))
  const femaleHint = /female|woman|zira|jenny|aria|sonia|natasha|samantha|karen|moira|tessa|fiona/i
  const maleHint = /male|man|david|guy|ryan|christopher|davis|daniel|alex|fred|oliver/i
  const genderTest = wantsFemale ? femaleHint : maleHint

  const lang = (v) => String(v?.lang || '').replace('_', '-').toLowerCase()
  const exact = voices.map((v, i) => ({ v, i })).filter(({ v }) => lang(v) === fullLang.toLowerCase())
  const base = voices.map((v, i) => ({ v, i })).filter(({ v }) => lang(v).startsWith(baseLang))
  const pool = exact.length ? exact : base

  if (!pool.length) return -1
  const gendered = pool.find(({ v }) => genderTest.test(v?.name || ''))
  return (gendered || pool[0]).i
}

function clampRate(speed) {
  const rate = Number(speed) || 1
  return Math.min(2, Math.max(0.1, rate))
}

function clamp01(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 1
  return Math.min(1, Math.max(0, n))
}

// Rough spoken duration (ms), used only to arm a safety watchdog in case the
// plugin's speak() promise never settles.
function estimateDurationMs(text, rate) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length || 1
  const wordsPerMin = 165 * clampRate(rate)
  return (words / wordsPerMin) * 60_000
}

// Build an <audio>-lookalike backed by the native TTS plugin. The plugin's
// speak() resolves when the utterance FINISHES, which we translate into the
// engine's `onended` so it advances to the next chunk.
export function createNativeSpeechAudio({ text, voice, speed = 1, volume = 1, voices = [] }) {
  const lang = langForEdgeVoice(voice)
  const voiceIndex = pickNativeVoiceIndex(voices, voice)
  const rate = clampRate(speed)
  const vol = clamp01(volume)
  const utterance = String(text || '')

  let watchdog = null
  let ended = false
  let paused = false
  let stopped = false
  const clearWatchdog = () => { if (watchdog) { clearTimeout(watchdog); watchdog = null } }

  const armWatchdog = () => {
    clearWatchdog()
    const budget = estimateDurationMs(text, speed) * 1.8 + 4000
    watchdog = setTimeout(() => {
      if (ended || paused || stopped) return
      ended = true
      TextToSpeech.stop().catch(() => {})
      player.onended?.()
    }, budget)
  }

  const player = {
    onended: null,
    onerror: null,
    volume,
    currentTime: 0, // no timing signal; keeps the (skipped) word-highlight loop inert
    _started: false,
    _native: true,

    play() {
      return new Promise((resolve) => {
        // The plugin can't resume mid-utterance, so a resume re-speaks the
        // current chunk from the start.
        paused = false
        stopped = false
        ended = false
        player._started = true

        const options = {
          text: utterance,
          lang,
          rate,
          pitch: 1,
          volume: vol,
        }
        if (voiceIndex >= 0) options.voice = voiceIndex

        armWatchdog()
        TextToSpeech.speak(options)
          .then(() => {
            if (stopped || paused || ended) return
            ended = true
            clearWatchdog()
            player.onended?.()
          })
          .catch((error) => {
            // stop() during a normal pause / chunk-switch settles speak() — not
            // a real failure.
            if (stopped || paused || ended) return
            ended = true
            clearWatchdog()
            player.onerror?.(error)
          })
        resolve()
      })
    },

    pause() {
      paused = true
      clearWatchdog()
      TextToSpeech.stop().catch(() => {})
    },

    stop() {
      stopped = true
      ended = true
      clearWatchdog()
      TextToSpeech.stop().catch(() => {})
    },
  }

  return player
}
