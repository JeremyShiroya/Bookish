export default defineEventHandler(async () => {
  const url = process.env.VOXCPM_URL
  if (!url) return { available: false, engine: 'webspeech' }

  try {
    const res = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(2000),
    })
    return { available: res.ok, engine: res.ok ? 'voxcpm' : 'webspeech' }
  } catch {
    return { available: false, engine: 'webspeech' }
  }
})
