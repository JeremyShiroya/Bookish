import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const synthesizeEdgeSpeechInBrowser = vi.fn()
const nativeSpeechSupported = vi.fn(() => true)

vi.mock('~/composables/useEdgeSpeechClient', () => ({
  synthesizeEdgeSpeechInBrowser: (...args) => synthesizeEdgeSpeechInBrowser(...args),
}))

vi.mock('~/composables/tts/nativeSpeech', () => ({
  nativeSpeechSupported: () => nativeSpeechSupported(),
}))

const { synthesizeMobileSpeech, resetMobileTtsDriver, mobileTtsEdgeDisabled } =
  await import('~/composables/tts/mobileTtsDriver')

const EDGE_AUDIO = { audio: 'data:audio/mp3;base64,AAA', boundaries: [] }
const speak = () => synthesizeMobileSpeech({ text: 'A sentence.', voice: 'en-US-ChristopherNeural', speed: 1 })

const setHidden = (hidden) => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (hidden ? 'hidden' : 'visible'),
  })
}

describe('mobileTtsDriver Edge resilience', () => {
  beforeEach(() => {
    resetMobileTtsDriver()
    synthesizeEdgeSpeechInBrowser.mockReset()
    nativeSpeechSupported.mockReturnValue(true)
    setHidden(false)
  })

  afterEach(() => setHidden(false))

  it('returns Edge audio and keeps the cloud path enabled', async () => {
    synthesizeEdgeSpeechInBrowser.mockResolvedValue(EDGE_AUDIO)
    await expect(speak()).resolves.toEqual(EDGE_AUDIO)
    expect(mobileTtsEdgeDisabled()).toBe(false)
  })

  // Regression: ONE failure used to permanently switch the narrator to the
  // device voice for the rest of the session.
  it('retries the chunk instead of switching voice on a single failure', async () => {
    synthesizeEdgeSpeechInBrowser.mockRejectedValueOnce(new Error('socket timeout'))
    await expect(speak()).rejects.toThrow('socket timeout')
    expect(mobileTtsEdgeDisabled()).toBe(false)
  })

  it('falls back to the device voice only after repeated consecutive failures', async () => {
    synthesizeEdgeSpeechInBrowser.mockRejectedValue(new Error('handshake 403'))
    await expect(speak()).rejects.toThrow()
    await expect(speak()).rejects.toThrow()
    expect(mobileTtsEdgeDisabled()).toBe(false)

    // Third consecutive failure crosses the limit → device voice.
    const result = await speak()
    expect(result).toMatchObject({ native: true })
    expect(mobileTtsEdgeDisabled()).toBe(true)
  })

  it('a success resets the failure streak', async () => {
    synthesizeEdgeSpeechInBrowser.mockRejectedValueOnce(new Error('blip'))
    await expect(speak()).rejects.toThrow()
    synthesizeEdgeSpeechInBrowser.mockResolvedValueOnce(EDGE_AUDIO)
    await expect(speak()).resolves.toEqual(EDGE_AUDIO)

    synthesizeEdgeSpeechInBrowser.mockRejectedValue(new Error('blip'))
    await expect(speak()).rejects.toThrow()
    await expect(speak()).rejects.toThrow()
    // Streak restarted after the success, so Edge is still enabled.
    expect(mobileTtsEdgeDisabled()).toBe(false)
  })

  // Regression: backgrounding the app throttles the socket; that must never be
  // read as "Edge is dead" and change the narrator's voice mid-book.
  it('never disables Edge while the app is backgrounded, however many failures', async () => {
    setHidden(true)
    synthesizeEdgeSpeechInBrowser.mockRejectedValue(new Error('throttled'))
    for (let i = 0; i < 6; i += 1) {
      await expect(speak()).rejects.toThrow('throttled')
    }
    expect(mobileTtsEdgeDisabled()).toBe(false)
  })

  it('gives the backgrounded socket longer to answer', async () => {
    setHidden(true)
    synthesizeEdgeSpeechInBrowser.mockResolvedValue(EDGE_AUDIO)
    await speak()
    expect(synthesizeEdgeSpeechInBrowser).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 30000, attempts: 2 }),
    )

    setHidden(false)
    await speak()
    expect(synthesizeEdgeSpeechInBrowser).toHaveBeenLastCalledWith(
      expect.objectContaining({ timeoutMs: 12000, attempts: 1 }),
    )
  })

  it('once disabled, keeps using the device voice without calling Edge again', async () => {
    synthesizeEdgeSpeechInBrowser.mockRejectedValue(new Error('dead'))
    await expect(speak()).rejects.toThrow()
    await expect(speak()).rejects.toThrow()
    await speak()
    expect(mobileTtsEdgeDisabled()).toBe(true)

    synthesizeEdgeSpeechInBrowser.mockClear()
    const result = await speak()
    expect(result).toMatchObject({ native: true })
    expect(synthesizeEdgeSpeechInBrowser).not.toHaveBeenCalled()
  })
})
