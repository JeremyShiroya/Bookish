export default defineEventHandler(async () => {
  const url = process.env.VOXCPM_URL || 'http://localhost:8000'

  for (const path of ['/health', '/v1/models']) {
    try {
      const res = await fetch(`${url}${path}`, {
        signal: AbortSignal.timeout(2000),
      })
      if (res.ok) return { available: true, engine: 'voxcpm' }
    } catch {}
  }

  return { available: false, engine: 'webspeech' }
})
