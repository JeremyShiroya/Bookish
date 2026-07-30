import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { resolvePlaybackChunks } from '../composables/useTTS.js'
import { buildPdfManifest } from '../composables/usePdfManifest.js'
import {
  describeDeviceVoice,
  deviceVoiceGender,
  offeredDeviceVoices,
  DEVICE_VOICE_LOCALES,
} from '../composables/tts/nativeSpeech.js'
import { mergeInstallments, rotateSeeds } from '../composables/useSeriesSuggestions.js'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')

describe('PDF narration highlights the sentence being read', () => {
  test('playback chunks stay index-aligned with the manifest', () => {
    // The reader highlights by manifest chunk id, and that id IS the array
    // index. Dropping blank chunks re-indexed everything after the first one,
    // so the overlay lit the sentence BEFORE the one being spoken.
    const manifestChunks = ['First sentence.', '   ', 'Third sentence.', '', 'Fifth sentence.']
    const playback = resolvePlaybackChunks({ format: 'pdf', explicitChunks: manifestChunks })

    expect(playback).toHaveLength(manifestChunks.length)
    expect(playback[0]).toBe('First sentence.')
    expect(playback[2]).toBe('Third sentence.')
    expect(playback[4]).toBe('Fifth sentence.')
    // Blanks are kept as positional holes.
    expect(playback[1]).toBe('')
    expect(playback[3]).toBe('')
  })

  test('a real manifest numbers its chunks by position', () => {
    const manifest = buildPdfManifest([
      {
        page: 1,
        width: 100,
        height: 100,
        items: [{ str: 'One. Two. Three.', transform: [1, 0, 0, 1, 0, 90], width: 80, height: 10 }],
      },
    ])
    manifest.chunks.forEach((chunk, index) => {
      expect(chunk.id, `chunk ${index}`).toBe(index)
    })
  })

  test('the playback loop steps over the blanks it keeps', () => {
    const tts = read('composables/useTTS.js')
    expect(tts).toMatch(/while \(_chunkIdx < _chunks\.length && !String\(_chunks\[_chunkIdx\] \|\| ''\)\.trim\(\)\)/)
    // And the filter that caused the drift is gone.
    expect(tts).not.toMatch(/\.map\(chunk => String\(chunk \|\| ''\)\.trim\(\)\)\s*\n\s*\.filter\(Boolean\)/)
  })

  test('the PDF pane can summon the reader chrome like the EPUB panes', () => {
    const reader = read('components/mobile/ReaderMobile.vue')
    const pdfPane = reader.slice(
      reader.indexOf('class="reader-mobile-pdf"'),
      reader.indexOf('<PdfViewer'),
    )
    // Read mode starts with the chrome hidden; without a tap handler here a PDF
    // had no way to bring it back at all.
    expect(pdfPane).toContain('@click="onScrollTap"')
  })
})

describe('reader chrome retires on its own', () => {
  const reader = read('components/mobile/ReaderMobile.vue')

  test('showing it starts a countdown', () => {
    expect(reader).toContain('CHROME_AUTOHIDE_MS')
    expect(reader).toContain('scheduleChromeAutoHide')
  })

  test('it never disappears mid-task', () => {
    const fn = reader.slice(
      reader.indexOf('const scheduleChromeAutoHide'),
      reader.indexOf('const toggleChrome'),
    )
    for (const guard of ['selectionMenu', 'noteEditor', 'mediaOpen', 'resumeChoice']) {
      expect(fn, guard).toContain(guard)
    }
  })
})

describe('device voices', () => {
  const voices = [
    { name: 'en-us-x-tpf-local', lang: 'en-US' },
    { name: 'en-us-x-tpd-local', lang: 'en-US' },
    { name: 'en-gb-x-gba-local', lang: 'en_GB' },
    { name: 'en-au-x-aua-local', lang: 'en-AU' },
    { name: 'fr-fr-x-frd-local', lang: 'fr-FR' },
    { name: 'de-de-x-ded-local', lang: 'de-DE' },
  ]

  test('only the three English locales are offered', () => {
    expect(DEVICE_VOICE_LOCALES).toEqual(['en-AU', 'en-GB', 'en-US'])
    const offered = offeredDeviceVoices(voices)
    expect(offered.map((v) => v.lang)).toEqual(['en-AU', 'en_GB', 'en-US', 'en-US'])
  })

  test('every variant survives — they are no longer collapsed by name', () => {
    // Deduping by display name left one voice per locale, which is why only a
    // single (seemingly always female) option ever appeared.
    const offered = offeredDeviceVoices(voices)
    const usVoices = offered.filter((v) => v.lang === 'en-US')
    expect(usVoices).toHaveLength(2)
    expect(new Set(usVoices.map((v) => v.name)).size).toBe(2)
  })

  test('each option keeps the index the engine selects by', () => {
    const offered = offeredDeviceVoices(voices)
    for (const option of offered) {
      expect(voices[option.index].lang.replace('_', '-')).toBe(option.lang.replace('_', '-'))
    }
  })

  test('gender is labelled only when the OS voice name actually says so', () => {
    expect(describeDeviceVoice({ name: 'English Male 2', lang: 'en-GB' }, 0)).toContain('Male')
    expect(describeDeviceVoice({ name: 'Sonia', lang: 'en-GB' }, 0)).toContain('Female')
    // Google's older variant codes carry no documented gender, so none is claimed.
    const unlabelled = describeDeviceVoice({ name: 'en-us-x-tpf-local', lang: 'en-US' }, 0)
    expect(unlabelled).toBe('English (US) · Voice 1')
  })

  // What the Capacitor plugin ACTUALLY returns on Android:
  //   voiceURI = voice.getName()                    → "en-us-x-sfg#female_1-local"
  //   name     = displayLanguage + displayCountry   → "English United States"
  // The identity lives in voiceURI; `name` is the same for every voice in a
  // locale. Reading `name` is what made the picker show four voices that were
  // all female — each locale collapsed to whichever entry sorted first.
  const androidVoice = (voiceURI, lang, localService = true) => ({
    voiceURI,
    name: lang.startsWith('en-US') ? 'English United States' : 'English United Kingdom',
    lang,
    localService,
  })

  test('gender comes from voiceURI, not the locale-derived name', () => {
    // `_` is a word character, so /\bfemale\b/ does NOT match "#female_1" — the
    // second half of the same bug.
    expect(deviceVoiceGender(androidVoice('en-us-x-sfg#female_1-local', 'en-US')).gender).toBe('Female')
    expect(deviceVoiceGender(androidVoice('en-us-x-iom#male_2-local', 'en-US')).gender).toBe('Male')
    // "female" contains "male" — the female test has to win.
    expect(deviceVoiceGender(androidVoice('en-gb-x-gba#female_3-local', 'en-GB')).gender).toBe('Female')
    expect(describeDeviceVoice(androidVoice('en-us-x-sfg#female_1-local', 'en-US'), 0))
      .toBe('English (US) · Female 1')
  })

  test('every real Android voice survives, male ones included', () => {
    // The regression: all four locales' voices shared the name "English United
    // States", so deduping on `name` left one voice per locale.
    const offered = offeredDeviceVoices([
      androidVoice('en-us-x-sfg#female_1-local', 'en-US'),
      androidVoice('en-us-x-tpf#female_2-local', 'en-US'),
      androidVoice('en-us-x-iom#male_1-local', 'en-US'),
      androidVoice('en-us-x-tpd#male_2-local', 'en-US'),
    ])
    expect(offered).toHaveLength(4)
    expect(offered.filter((v) => v.name.includes('Male'))).toHaveLength(2)
    expect(offered.filter((v) => v.name.includes('Female'))).toHaveLength(2)
  })

  test('the network twin of a local voice is dropped', () => {
    // Google lists every voice twice. They sound identical, and the network one
    // cannot play on the offline picker that exists for exactly this case.
    const dupes = [
      androidVoice('en-us-x-sfg#female_1-local', 'en-US', true),
      androidVoice('en-us-x-sfg#female_1-network', 'en-US', false),
      androidVoice('en-us-x-iom#male_1-network', 'en-US', false),
    ]
    const offered = offeredDeviceVoices(dupes)
    expect(offered).toHaveLength(2)
    expect(offered.map((v) => v.name)).toEqual([
      'English (US) · Female 1',
      'English (US) · Male 1',
    ])
    // The surviving female entry is the LOCAL one, not the network twin.
    expect(dupes[offered[0].index].voiceURI).toBe('en-us-x-sfg#female_1-local')
  })

  test('voices are never collapsed when the platform gives nothing to tell them apart', () => {
    // No voiceURI anywhere: the only key is the shared display name, so deduping
    // would hide every voice but one. Listing duplicates beats hiding real ones.
    const offered = offeredDeviceVoices([
      { name: 'English United States', lang: 'en-US' },
      { name: 'English United States', lang: 'en-US' },
      { name: 'English United States', lang: 'en-US' },
    ])
    expect(offered).toHaveLength(3)
  })

  test('no two offered voices share a label', () => {
    const offered = offeredDeviceVoices([
      // Two different variants both calling themselves "#female_1".
      androidVoice('en-us-x-sfg#female_1-local', 'en-US'),
      androidVoice('en-us-x-tpf#female_1-local', 'en-US'),
      androidVoice('en-us-x-iom#male_1-local', 'en-US'),
      androidVoice('en-us-x-tpd-local', 'en-US'),
    ])
    expect(new Set(offered.map((v) => v.name)).size).toBe(offered.length)
  })
})

describe('recovering the natural voices', () => {
  test('the engine can be told to stop using the fallback', () => {
    const tts = read('composables/useTTS.js')
    expect(tts).toContain('const retryOnlineVoices')
    // Clears the fallback flag and the device audio it cached.
    expect(tts).toMatch(/ttsUsingDeviceVoice\.value = false\s*\n\s*_clearAudioCache\(\)/)
    // Reports whether it actually worked.
    expect(tts).toContain('return !ttsUsingDeviceVoice.value')
  })

  test('the narrator sheet offers it while the fallback is in force', () => {
    const reader = read('components/mobile/ReaderMobile.vue')
    expect(reader).toContain('retry-online-voices')
    expect(reader).toContain('Use natural voices again')
    expect(reader).toContain('retryNaturalVoices')
    expect(reader).toMatch(/v-if="useOfflineVoice"[\s\S]{0,220}retry-online-voices/)
  })
})

describe('series suggestions complete themselves over time', () => {
  test('a later thinner roster never erases what was already resolved', () => {
    const existing = { 1: { title: 'One', cover: 'c1', author: 'A', year: 2001 } }
    const incoming = { 2: { title: 'Two', cover: null, author: null, year: null } }
    const merged = mergeInstallments(existing, incoming)
    expect(merged[1].cover).toBe('c1')
    expect(merged[2].title).toBe('Two')
  })

  test('merging tops up fields without overwriting good ones', () => {
    const merged = mergeInstallments(
      { 3: { title: 'Three', cover: null, author: 'A', year: null } },
      { 3: { title: 'Three', cover: 'c3', author: 'Wrong', year: 2003 } },
    )
    expect(merged[3]).toMatchObject({ title: 'Three', cover: 'c3', author: 'A', year: 2003 })
  })

  test('a partial roster is retried instead of being frozen for a month', () => {
    const suggestions = read('composables/useSeriesSuggestions.js')
    // "resolved at least one" used to earn the 30-day TTL, so a series showing
    // 28 of 30 stayed that way. Only a complete answer earns it now.
    expect(suggestions).toMatch(/needed\.every\(\(installment\) => installments\[installment\]\)/)
    expect(suggestions).not.toMatch(/needed\.some\(\(installment\) => installments\[installment\]\)/)
  })

  test('every owned book gets a turn as the seed, rotating between attempts', () => {
    const seeds = [{ title: 'A' }, { title: 'B' }, { title: 'C' }]
    expect(rotateSeeds(seeds, 'S', 0).map((s) => s.title)).toEqual(['A', 'B', 'C'])
    expect(rotateSeeds(seeds, 'S', 1).map((s) => s.title)).toEqual(['B', 'C', 'A'])
    expect(rotateSeeds(seeds, 'S', 2).map((s) => s.title)).toEqual(['C', 'A', 'B'])
  })

  test('a single seed is still fine', () => {
    expect(rotateSeeds([{ title: 'Only' }], 'S', 3).map((s) => s.title)).toEqual(['Only'])
    expect(rotateSeeds([], 'S', 0)).toEqual([])
  })

  test('the fetch accumulates across seeds instead of stopping at the first', () => {
    const suggestions = read('composables/useSeriesSuggestions.js')
    expect(suggestions).toContain('mergeInstallments(installments, indexRoster(roster, seriesName))')
    // It starts from whatever is already on disk.
    expect(suggestions).toContain('readCacheRaw(seriesName) || {}')
  })
})

describe('scan progress in Settings → Storage', () => {
  test('the scheduler reports what it is doing', () => {
    const auto = read('composables/useAutoMetadata.js')
    for (const field of ['batchTotal', 'batchDone', 'nextRunAt', 'lastRunAt']) {
      expect(auto, field).toContain(field)
    }
  })

  test('the page turns that into plain words that keep ticking', () => {
    const storage = read('components/mobile/SettingsStorageMobile.vue')
    expect(storage).toContain('scanNowLabel')
    expect(storage).toContain('lastScanLabel')
    expect(storage).toContain('nextScanLabel')
    // A live clock, so "next scan in x" counts down.
    expect(storage).toContain('nowTick')
    expect(storage).toContain('setInterval')
  })
})
