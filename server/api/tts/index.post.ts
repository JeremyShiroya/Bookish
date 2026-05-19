import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'

const RATE_MAP: Record<string, string> = {
  '0.75': '-25%',
  '1':    '+0%',
  '1.0':  '+0%',
  '1.25': '+25%',
  '1.5':  '+50%',
  '2':    '+100%',
  '2.0':  '+100%',
}

const ALLOWED_VOICES = new Set([
  'en-US-ChristopherNeural', 'en-US-JennyNeural', 'en-US-AriaNeural',
  'en-US-GuyNeural', 'en-US-DavisNeural', 'en-GB-SoniaNeural',
  'en-GB-RyanNeural', 'en-AU-NatashaNeural',
])

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

interface WordBoundary {
  word: string
  offset: number    // seconds from audio start
  duration: number  // seconds
  charIndex: number // character offset within the chunk text
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { text, voice = 'en-US-ChristopherNeural', speed = 1.0 } = body ?? {}

  if (!text?.trim()) {
    throw createError({ statusCode: 400, message: 'text is required' })
  }
  if (text.length > 5000) {
    throw createError({ statusCode: 400, message: 'text too long (max 5000 chars)' })
  }
  if (!ALLOWED_VOICES.has(voice)) {
    throw createError({ statusCode: 400, message: 'unknown voice' })
  }

  const rate = RATE_MAP[String(speed)] ?? '+0%'
  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${escapeXml(voice)}'><prosody rate='${rate}'>${escapeXml(text)}</prosody></voice></speak>`

  const tts = new MsEdgeTTS()
  try {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3)

    const streamResult = tts.rawToStream(ssml)
    const audioStream    = streamResult.audioStream
    const metadataStream = (streamResult as any).metadataStream ?? null

    const boundaries: WordBoundary[] = []
    const audioBuffers: Buffer[] = []

    if (metadataStream) {
      // Consume audio and metadata concurrently
      await Promise.all([
        (async () => {
          for await (const chunk of audioStream) {
            audioBuffers.push(Buffer.from(chunk))
          }
        })(),
        (async () => {
          try {
            // Build a lookup map from word text → char offset in the original text
            const lowerText = text.toLowerCase()
            let searchFrom = 0

            for await (const meta of metadataStream) {
              // msedge-tts emits objects: { type: 'WordBoundary', Data: { Offset, Duration, text: { Text, Length } } }
              if (meta?.type !== 'WordBoundary') continue
              const word     = meta.Data?.text?.Text ?? ''
              const offsetNs = meta.Data?.Offset  ?? 0  // 100-nanosecond units
              const durNs    = meta.Data?.Duration ?? 0

              // Find the character index of this word in the original chunk text
              const wordLower = word.toLowerCase()
              const charIdx   = lowerText.indexOf(wordLower, searchFrom)
              if (charIdx !== -1) searchFrom = charIdx + word.length

              boundaries.push({
                word,
                offset:    offsetNs / 10_000_000,  // → seconds
                duration:  durNs    / 10_000_000,
                charIndex: charIdx,
              })
            }
          } catch {
            // Non-fatal — metadata is enhancement only
          }
        })(),
      ])
    } else {
      // Older msedge-tts version — audio only
      for await (const chunk of audioStream) {
        audioBuffers.push(Buffer.from(chunk))
      }
    }

    const audio = `data:audio/mp3;base64,${Buffer.concat(audioBuffers).toString('base64')}`
    return { audio, boundaries }

  } catch (err: any) {
    throw createError({ statusCode: 500, message: err?.message ?? 'TTS generation failed' })
  } finally {
    tts.close()
  }
})
