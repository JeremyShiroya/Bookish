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

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
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

  const rate = RATE_MAP[String(speed)] ?? '+0%'
  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${escapeXml(voice)}'><prosody rate='${rate}'>${escapeXml(text)}</prosody></voice></speak>`

  const tts = new MsEdgeTTS()
  try {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3)
    const { audioStream } = tts.rawToStream(ssml)

    const buffers: Buffer[] = []
    for await (const chunk of audioStream) {
      buffers.push(Buffer.from(chunk))
    }
    const audio = `data:audio/mp3;base64,${Buffer.concat(buffers).toString('base64')}`

    return { audio }
  } catch (err: any) {
    throw createError({ statusCode: 500, message: err?.message ?? 'TTS generation failed' })
  } finally {
    tts.close()
  }
})
