import { describe, it, expect, vi, beforeEach } from 'vitest'

const $fetch = vi.fn()
const nativeSpeechSupported = vi.fn(() => true)

vi.stubGlobal('$fetch', (...args) => $fetch(...args))

vi.mock('~/composables/tts/nativeSpeech', () => ({
  nativeSpeechSupported: () => nativeSpeechSupported(),
}))

const { synthesizeDesktopSpeech } = await import('~/composables/tts/desktopTtsDriver')

const SERVER_AUDIO = { audio: 'data:audio/mp3;base64,AAA', boundaries: [{ word: 'A', offset: 0 }] }
const speak = () => synthesizeDesktopSpeech({
  text: 'A sentence.',
  voice: 'en-US-ChristopherNeural',
  speed: 1,
  apiUrl: (path) => path,
})

describe('desktopTtsDriver device-voice fallback', () => {
  beforeEach(() => {
    $fetch.mockReset()
    nativeSpeechSupported.mockReturnValue(true)
  })

  it('returns server audio untouched when synthesis works', async () => {
    $fetch.mockResolvedValue(SERVER_AUDIO)
    await expect(speak()).resolves.toEqual(SERVER_AUDIO)
  })

  it('falls back to the device voice when the server is unreachable', async () => {
    $fetch.mockRejectedValue(new Error('fetch failed'))
    await expect(speak()).resolves.toEqual({
      native: true,
      text: 'A sentence.',
      voice: 'en-US-ChristopherNeural',
      speed: 1,
    })
  })

  // Regression: a build with no Nuxt server behind it answers /api/tts with the
  // SPA's index.html and a 200, so $fetch RESOLVES with a string. That sailed
  // past the catch, handing the engine a chunk with no audio and no device-voice
  // marker — narration died with "TTS failed — check your connection" instead of
  // falling back to the device voice.
  it('falls back when the endpoint answers 200 with HTML instead of audio', async () => {
    $fetch.mockResolvedValue('<!DOCTYPE html><html><body>Bookish</body></html>')
    await expect(speak()).resolves.toMatchObject({ native: true, text: 'A sentence.' })
  })

  it('falls back when the reply carries no usable audio payload', async () => {
    $fetch.mockResolvedValue({ boundaries: [] })
    await expect(speak()).resolves.toMatchObject({ native: true })
  })

  it('surfaces the failure when there is no device voice to fall back to', async () => {
    nativeSpeechSupported.mockReturnValue(false)
    $fetch.mockResolvedValue('<!DOCTYPE html>')
    await expect(speak()).rejects.toThrow(/no audio/i)

    $fetch.mockRejectedValue(new Error('fetch failed'))
    await expect(speak()).rejects.toThrow('fetch failed')
  })
})
