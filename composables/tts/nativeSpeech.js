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

// The only device locales the picker offers. The OS ships dozens, most of them
// languages this reader will never use, which buried the handful that matter.
export const DEVICE_VOICE_LOCALES = ['en-AU', 'en-GB', 'en-US']

const LOCALE_LABELS = {
  'en-au': 'English (Australia)',
  'en-gb': 'English (UK)',
  'en-us': 'English (US)',
}

const normalizeLocale = (value) => String(value || '').replace('_', '-').toLowerCase()

export function isOfferedDeviceLocale(voice) {
  const lang = normalizeLocale(voice?.lang)
  return DEVICE_VOICE_LOCALES.some((locale) => lang === locale.toLowerCase())
}

// WHICH FIELD CARRIES THE VOICE'S IDENTITY.
//
// The Capacitor plugin does NOT put the OS voice name in `name`. On Android it
// builds `name` from the locale —
//   obj.put("voiceURI", voice.getName());
//   obj.put("name", locale.getDisplayLanguage() + " " + locale.getDisplayCountry());
// — so every en-US voice arrives called "English United States", and only
// `voiceURI` holds the real "en-us-x-sfg#female_1-local".
//
// Reading `name` therefore made every voice in a locale look identical: gender
// could never be detected, and deduping collapsed each locale to a single voice
// (which is why the picker showed four entries that were all female — the
// survivor was whichever sorted first). Identity and gender both come from
// voiceURI, with `name` as the fallback for platforms that do fill it in.
const voiceKey = (voice) => String(voice?.voiceURI || voice?.name || '')

// Android's Google voices are named like "en-us-x-sfg#female_1-local": the
// gender and its ordinal live in a `#gender_n` token. Matching that token has to
// come FIRST and without a trailing \b — `_` is a word character, so
// /\bfemale\b/ never matches "#female_1" and every voice used to fall through to
// the unlabelled "Voice N" branch. Older Google names ("en-us-x-tpf-local") and
// most OEM engines carry no token, so the word hints are the second pass and
// anything still unknown is offered unlabelled rather than guessed at.
const GENDER_TOKEN = /#(female|male)_?(\d*)/i
const FEMALE_NAME_HINT = /female|woman|zira|jenny|aria|sonia|natasha|samantha|karen|moira|tessa|fiona/i
const MALE_NAME_HINT = /male|man|david|guy|ryan|christopher|davis|daniel|alex|fred|oliver|arthur|william/i

// 'Female' | 'Male' | '' — plus the ordinal the OS itself assigned, when it
// names one. Order matters: FEMALE_NAME_HINT would match the "male" inside
// "female", so the female test always runs first.
export function deviceVoiceGender(voice) {
  const raw = voiceKey(voice)
  const token = GENDER_TOKEN.exec(raw)
  if (token) {
    return {
      gender: token[1].toLowerCase() === 'female' ? 'Female' : 'Male',
      ordinal: Number(token[2]) || 0,
    }
  }
  if (FEMALE_NAME_HINT.test(raw)) return { gender: 'Female', ordinal: 0 }
  if (MALE_NAME_HINT.test(raw)) return { gender: 'Male', ordinal: 0 }
  return { gender: '', ordinal: 0 }
}

export function describeDeviceVoice(voice, indexWithinGroup = 0) {
  const lang = normalizeLocale(voice?.lang)
  const localeLabel = LOCALE_LABELS[lang] || voice?.lang || 'Device voice'
  const { gender, ordinal } = deviceVoiceGender(voice)
  const number = ordinal || indexWithinGroup + 1
  const variant = gender ? `${gender} ${number}` : `Voice ${number}`
  return `${localeLabel} · ${variant}`
}

// Google ships each voice twice — "…-local" and "…-network" — which sound
// identical. The network twin is useless to a picker that exists precisely
// because the device is offline, so a local voice always wins its pair.
const VOICE_INSTALL_SUFFIX = /-(?:local|network)$/i

const voiceIdentity = (voice) => (
  `${normalizeLocale(voice?.lang)}|${voiceKey(voice).replace(VOICE_INSTALL_SUFFIX, '').toLowerCase()}`
)

// `localService` is the plugin's own answer to "does this voice need the
// network" (!voice.isNetworkConnectionRequired() on Android), so it is trusted
// ahead of guessing from the name suffix.
const isNetworkVoice = (voice) => (
  voice?.localService === false || /-network$/i.test(voiceKey(voice))
)

// Every distinct offered voice, in locale order, keyed by its ORIGINAL index so
// the engine can still select it.
//
// Deduping is only safe when the platform gives something that actually tells
// voices apart. If no voice carries a voiceURI, the only key available is the
// locale-derived display name, which is IDENTICAL for every voice in a locale —
// deduping on that collapsed the whole list to one voice per locale. In that
// case every voice is kept, since listing a few duplicates is far better than
// hiding the real ones.
export function offeredDeviceVoices(voices) {
  const list = Array.isArray(voices) ? voices : []
  const canDedupe = list.some((voice) => !!voice?.voiceURI)
  const out = []

  for (const locale of DEVICE_VOICE_LOCALES) {
    const target = locale.toLowerCase()
    const byIdentity = new Map()

    list.forEach((voice, index) => {
      if (normalizeLocale(voice?.lang) !== target) return
      if (!canDedupe) {
        byIdentity.set(`${index}`, { voice, index })
        return
      }
      const key = voiceIdentity(voice)
      const existing = byIdentity.get(key)
      // First one wins, unless it is the network twin of a local voice.
      if (existing && !(isNetworkVoice(existing.voice) && !isNetworkVoice(voice))) return
      byIdentity.set(key, { voice, index })
    })

    // Female before male before unlabelled, so the list reads as a roster rather
    // than as whatever order the OS happened to enumerate in.
    const rank = { Female: 0, Male: 1, '': 2 }
    const entries = [...byIdentity.values()].sort((a, b) => (
      rank[deviceVoiceGender(a.voice).gender] - rank[deviceVoiceGender(b.voice).gender]
    ))

    // Two different variants can both call themselves "#female_1", so a label
    // already taken falls back to the next free number. Duplicate LABELS are
    // what the picker looked broken for, whatever the OS calls things.
    const usedLabels = new Set()
    const seenPerGroup = new Map()
    for (const { voice, index } of entries) {
      const { gender } = deviceVoiceGender(voice)
      const seen = seenPerGroup.get(gender) || 0
      seenPerGroup.set(gender, seen + 1)

      let name = describeDeviceVoice(voice, seen)
      for (let bump = seen; usedLabels.has(name); bump += 1) {
        name = describeDeviceVoice({ ...voice, voiceURI: '', name: '' }, bump)
          .replace('Voice', gender || 'Voice')
      }
      usedLabels.add(name)
      out.push({ index, name, lang: voice?.lang })
    }
  }

  return out
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
  // Same gender detection the picker uses, so "matches the Edge voice" and
  // "labelled Female in the list" can never disagree.
  const wantsGender = FEMALE_EDGE_VOICES.has(String(edgeVoiceId)) ? 'Female' : 'Male'

  const lang = (v) => String(v?.lang || '').replace('_', '-').toLowerCase()
  const exact = voices.map((v, i) => ({ v, i })).filter(({ v }) => lang(v) === fullLang.toLowerCase())
  const base = voices.map((v, i) => ({ v, i })).filter(({ v }) => lang(v).startsWith(baseLang))
  const pool = exact.length ? exact : base

  if (!pool.length) return -1
  const gendered = pool.find(({ v }) => deviceVoiceGender(v).gender === wantsGender)
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
export function createNativeSpeechAudio({ text, voice, speed = 1, volume = 1, voices = [], nativeVoiceIndex = -1 }) {
  const lang = langForEdgeVoice(voice)
  // An explicit device-voice choice (the offline narrator picker) wins; other-
  // wise map the selected Edge voice onto the closest device voice.
  const explicit = Number.isInteger(nativeVoiceIndex) && nativeVoiceIndex >= 0 && nativeVoiceIndex < voices.length
  const voiceIndex = explicit ? nativeVoiceIndex : pickNativeVoiceIndex(voices, voice)
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
