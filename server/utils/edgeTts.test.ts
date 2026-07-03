import { Readable } from 'node:stream'
import { describe, expect, test } from 'vitest'
import { synthesizeEdgeSpeech } from './edgeTts'

class FakeEdgeTts {
  shouldFail: boolean
  closed = false

  constructor(shouldFail = false) {
    this.shouldFail = shouldFail
  }

  async setMetadata() {
    if (!this.shouldFail) return
    const error = new Error('Edge TTS WebSocket error: connect ETIMEDOUT')
    ;(error as Error & { code?: string }).code = 'ETIMEDOUT'
    throw error
  }

  rawToStream() {
    return {
      audioStream: Readable.from([Buffer.from('audio bytes')]),
      metadataStream: Readable.from([
        {
          type: 'WordBoundary',
          Data: {
            Offset: 10_000_000,
            Duration: 5_000_000,
            text: { Text: 'Hello', Length: 5 },
          },
        },
      ]),
    }
  }

  close() {
    this.closed = true
  }
}

class BufferMetadataEdgeTts {
  closed = false

  async setMetadata() {}

  rawToStream() {
    return {
      audioStream: Readable.from([Buffer.from('audio bytes')]),
      // msedge-tts pushes raw JSON buffers, not parsed objects.
      metadataStream: Readable.from([
        Buffer.from(JSON.stringify({
          Metadata: [
            {
              Type: 'WordBoundary',
              Data: {
                Offset: 10_000_000,
                Duration: 5_000_000,
                text: { Text: 'Hello', Length: 5 },
              },
            },
            {
              Type: 'WordBoundary',
              Data: {
                Offset: 20_000_000,
                Duration: 2_500_000,
                text: { Text: 'world', Length: 5 },
              },
            },
          ],
        })),
      ]),
    }
  }

  close() {
    this.closed = true
  }
}

describe('Edge TTS synthesis', () => {
  test('parses word boundaries from raw JSON metadata buffers', async () => {
    const result = await synthesizeEdgeSpeech({
      ssml: '<speak>Hello world</speak>',
      text: 'Hello world',
      voice: 'en-US-ChristopherNeural',
      createTts: () => new BufferMetadataEdgeTts(),
      retryDelayMs: 0,
    })

    expect(result.boundaries).toEqual([
      { word: 'Hello', offset: 1, duration: 0.5, charIndex: 0 },
      { word: 'world', offset: 2, duration: 0.25, charIndex: 6 },
    ])
  })

  test('retries transient websocket failures before returning generated audio', async () => {
    const created: FakeEdgeTts[] = []
    let attempts = 0

    const result = await synthesizeEdgeSpeech({
      ssml: '<speak>Hello world</speak>',
      text: 'Hello world',
      voice: 'en-US-ChristopherNeural',
      createTts: () => {
        const instance = new FakeEdgeTts(attempts++ === 0)
        created.push(instance)
        return instance
      },
      retryDelayMs: 0,
    })

    expect(attempts).toBe(2)
    expect(created.every((instance) => instance.closed)).toBe(true)
    expect(result.audio).toBe(`data:audio/mp3;base64,${Buffer.from('audio bytes').toString('base64')}`)
    expect(result.boundaries).toEqual([
      {
        word: 'Hello',
        offset: 1,
        duration: 0.5,
        charIndex: 0,
      },
    ])
  })
})
