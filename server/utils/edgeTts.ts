import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'

interface WordBoundary {
  word: string
  offset: number
  duration: number
  charIndex: number
}

interface EdgeTtsClient {
  setMetadata: (voice: string, outputFormat: string, metadataOptions?: Record<string, unknown>) => Promise<void>
  rawToStream: (ssml: string) => {
    audioStream: AsyncIterable<Buffer | Uint8Array | string>
    metadataStream?: AsyncIterable<any> | null
  }
  close: () => void
}

export interface SynthesizeEdgeSpeechOptions {
  ssml: string
  text: string
  voice: string
  attempts?: number
  retryDelayMs?: number
  createTts?: () => EdgeTtsClient
}

const DEFAULT_ATTEMPTS = 3
const DEFAULT_RETRY_DELAY_MS = 350

function delay(ms: number) {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function isRetriableEdgeTtsError(error: unknown) {
  const code = String((error as any)?.code || (error as any)?.cause?.code || '')
  const message = String((error as any)?.message || error || '')

  return (
    ['ETIMEDOUT', 'EACCES', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(code)
    || /websocket|timed?\s*out|socket hang up|network|failed to connect/i.test(message)
  )
}

async function synthesizeOnce(options: SynthesizeEdgeSpeechOptions) {
  const createTts = options.createTts ?? (() => new MsEdgeTTS() as EdgeTtsClient)
  const tts = createTts()

  try {
    // Word boundaries default to off in msedge-tts — without this the API
    // returns no metadata stream and word highlighting silently breaks.
    await tts.setMetadata(options.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {
      wordBoundaryEnabled: true,
    })

    const streamResult = tts.rawToStream(options.ssml)
    const audioStream = streamResult.audioStream
    const metadataStream = streamResult.metadataStream ?? null
    const boundaries: WordBoundary[] = []
    const audioBuffers: Buffer[] = []

    if (metadataStream) {
      await Promise.all([
        (async () => {
          for await (const chunk of audioStream) {
            audioBuffers.push(Buffer.from(chunk))
          }
        })(),
        (async () => {
          try {
            const lowerText = options.text.toLowerCase()
            let searchFrom = 0

            const pushBoundary = (meta: any) => {
              const word = meta?.Data?.text?.Text ?? ''
              const offsetNs = meta?.Data?.Offset ?? 0
              const durNs = meta?.Data?.Duration ?? 0
              const wordLower = word.toLowerCase()
              const charIdx = word ? lowerText.indexOf(wordLower, searchFrom) : -1

              if (charIdx !== -1) searchFrom = charIdx + word.length

              boundaries.push({
                word,
                offset: offsetNs / 10_000_000,
                duration: durNs / 10_000_000,
                charIndex: charIdx,
              })
            }

            for await (const chunk of metadataStream) {
              // msedge-tts pushes raw JSON buffers shaped
              // {"Metadata":[{"Type":"WordBoundary","Data":{...}}]}; older
              // versions emitted parsed objects with a lowercase `type`.
              if (Buffer.isBuffer(chunk) || chunk instanceof Uint8Array || typeof chunk === 'string') {
                let payload: any
                try {
                  payload = JSON.parse(Buffer.from(chunk as any).toString())
                } catch {
                  continue
                }
                const items = Array.isArray(payload?.Metadata) ? payload.Metadata : []
                for (const meta of items) {
                  if (meta?.Type === 'WordBoundary') pushBoundary(meta)
                }
              } else if ((chunk as any)?.type === 'WordBoundary') {
                pushBoundary(chunk)
              }
            }
          } catch {
            // Metadata is optional; audio playback should still succeed.
          }
        })(),
      ])
    } else {
      for await (const chunk of audioStream) {
        audioBuffers.push(Buffer.from(chunk))
      }
    }

    return {
      audio: `data:audio/mp3;base64,${Buffer.concat(audioBuffers).toString('base64')}`,
      boundaries,
    }
  } finally {
    tts.close()
  }
}

export async function synthesizeEdgeSpeech(options: SynthesizeEdgeSpeechOptions) {
  const attempts = Math.max(1, options.attempts ?? DEFAULT_ATTEMPTS)
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await synthesizeOnce(options)
    } catch (error) {
      lastError = error
      if (attempt >= attempts || !isRetriableEdgeTtsError(error)) throw error
      await delay(retryDelayMs * attempt)
    }
  }

  throw lastError
}
