export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const voxcpmUrl = process.env.VOXCPM_URL || 'http://localhost:8000'
  const model = process.env.VOXCPM_MODEL || 'openbmb/VoxCPM2'
  const voice = process.env.VOXCPM_SPEAKER || body.voice || 'default'
  const apiKey = process.env.VOXCPM_API_KEY

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  try {
    const response = await fetch(`${voxcpmUrl}/v1/audio/speech`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        input: body.text,
        voice,
        speed: body.speed ?? 1.0,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      console.error(`[TTS] VoxCPM returned ${response.status}`)
      return { engine: 'webspeech' }
    }

    const contentType = response.headers.get('content-type') || 'audio/wav'
    const audioBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(audioBuffer).toString('base64')
    const mimeType = contentType.split(';')[0].trim()

    return {
      engine: 'voxcpm',
      audio: `data:${mimeType};base64,${base64}`,
    }
  } catch (err) {
    console.error('[TTS] VoxCPM error:', err)
    return { engine: 'webspeech' }
  }
})
