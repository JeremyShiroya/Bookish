import { describe, expect, test } from 'vitest'
import {
  appendEdgeWordBoundaries,
  buildEdgeSsml,
  edgeRateForSpeed,
  extractEdgeAudioPayload,
  generateSecMsGec,
} from '../composables/useEdgeSpeechClient.js'

describe('browser Edge TTS client', () => {
  test('maps playback speeds to Edge prosody rates like the server endpoint', () => {
    expect(edgeRateForSpeed(1)).toBe('+0%')
    expect(edgeRateForSpeed('1.0')).toBe('+0%')
    expect(edgeRateForSpeed(0.75)).toBe('-25%')
    expect(edgeRateForSpeed(1.5)).toBe('+50%')
    expect(edgeRateForSpeed(2)).toBe('+100%')
    expect(edgeRateForSpeed(999)).toBe('+0%')
  })

  test('builds SSML with escaped text and voice', () => {
    const ssml = buildEdgeSsml({
      text: `Tom & Jerry's <"quotes">`,
      voice: 'en-US-ChristopherNeural',
      rate: '+25%',
    })

    expect(ssml).toContain("<voice name='en-US-ChristopherNeural'>")
    expect(ssml).toContain("<prosody rate='+25%'>")
    expect(ssml).toContain('Tom &amp; Jerry&apos;s &lt;&quot;quotes&quot;&gt;')
    expect(ssml).not.toContain('<"')
  })

  test('extracts mp3 bytes after the Path:audio header delimiter', () => {
    const encoder = new TextEncoder()
    const header = encoder.encode('X-RequestId:abc\r\nContent-Type:audio/mpeg\r\nPath:audio\r\n')
    const audio = new Uint8Array([0xff, 0xf3, 0x44, 0x00, 0x99])
    const frame = new Uint8Array(header.length + audio.length)
    frame.set(header, 0)
    frame.set(audio, header.length)

    expect(Array.from(extractEdgeAudioPayload(frame))).toEqual(Array.from(audio))
    expect(extractEdgeAudioPayload(encoder.encode('Path:turn.end\r\n'))).toBeNull()
  })

  test('parses WordBoundary metadata into second-based boundaries with char indexes', () => {
    const boundaries = []
    const searchState = { lowerText: 'hello brave world'.toLowerCase(), searchFrom: 0 }

    appendEdgeWordBoundaries(
      boundaries,
      JSON.stringify({
        Metadata: [
          { Type: 'WordBoundary', Data: { Offset: 10_000_000, Duration: 5_000_000, text: { Text: 'Hello', Length: 5 } } },
          { Type: 'SentenceBoundary', Data: { Offset: 0, Duration: 0, text: { Text: 'ignored' } } },
        ],
      }),
      searchState,
    )
    appendEdgeWordBoundaries(
      boundaries,
      JSON.stringify({
        Metadata: [
          { Type: 'WordBoundary', Data: { Offset: 20_000_000, Duration: 2_500_000, text: { Text: 'world', Length: 5 } } },
        ],
      }),
      searchState,
    )

    expect(boundaries).toEqual([
      { word: 'Hello', offset: 1, duration: 0.5, charIndex: 0 },
      { word: 'world', offset: 2, duration: 0.25, charIndex: 12 },
    ])
  })

  test('ignores malformed metadata payloads', () => {
    const boundaries = []
    appendEdgeWordBoundaries(boundaries, '<html>not json</html>', { lowerText: '', searchFrom: 0 })
    expect(boundaries).toEqual([])
  })

  test('generates the DRM token from the 5-minute clock window', async () => {
    const now = 1750000000000
    const tokenA = await generateSecMsGec(now)
    const tokenB = await generateSecMsGec(now + 1000)

    expect(tokenA).toMatch(/^[0-9A-F]{64}$/)
    expect(tokenA).toBe(tokenB)
  })
})
