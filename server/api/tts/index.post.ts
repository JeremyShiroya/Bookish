import { synthesizeEdgeSpeech } from '../../utils/edgeTts'

const RATE_MAP: Record<string, string> = {
  '0.75': '-25%',
  '1': '+0%',
  '1.0': '+0%',
  '1.25': '+25%',
  '1.5': '+50%',
  '2': '+100%',
  '2.0': '+100%',
}

const ALLOWED_VOICES = new Set([
  'en-US-ChristopherNeural',
  'en-US-JennyNeural',
  'en-US-AriaNeural',
  'en-US-GuyNeural',
  'en-US-DavisNeural',
  'en-GB-SoniaNeural',
  'en-GB-RyanNeural',
  'en-AU-NatashaNeural',
])

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
  if (!ALLOWED_VOICES.has(voice)) {
    throw createError({ statusCode: 400, message: 'unknown voice' })
  }

  const rate = RATE_MAP[String(speed)] ?? '+0%'
  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${escapeXml(voice)}'><prosody rate='${rate}'>${escapeXml(text)}</prosody></voice></speak>`

  try {
    return await synthesizeEdgeSpeech({ ssml, text, voice })
  } catch (err: any) {
    throw createError({ statusCode: 500, message: err?.message ?? 'TTS generation failed' })
  }
})
