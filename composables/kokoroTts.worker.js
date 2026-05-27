import { KokoroTTS } from 'kokoro-js'

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'

let ttsPromise = null
let runtime = null

const isFirefox = () => /firefox/i.test(globalThis.navigator?.userAgent || '')

const runtimeCandidates = () => {
  const candidates = []
  const allowWebGpu = !!globalThis.navigator?.gpu && !isFirefox()
  if (allowWebGpu) candidates.push({ device: 'webgpu', dtype: 'q4f16' })
  candidates.push({ device: 'wasm', dtype: 'q4' })
  candidates.push({ device: 'wasm', dtype: 'q8' })
  return candidates
}

const loadTts = async () => {
  let lastError = null

  for (const candidate of runtimeCandidates()) {
    try {
      const tts = await KokoroTTS.from_pretrained(MODEL_ID, candidate)
      runtime = candidate
      return tts
    } catch (error) {
      lastError = error
      console.warn(`[Kokoro] Failed to load ${candidate.device}/${candidate.dtype}:`, error)
    }
  }

  throw lastError || new Error('Kokoro model failed to load')
}

const getTts = async () => {
  if (!ttsPromise) {
    ttsPromise = loadTts().catch((error) => {
      ttsPromise = null
      throw error
    })
  }
  return ttsPromise
}

self.onmessage = async (event) => {
  const { id, type, text = '', voice = 'af_heart', speed = 1 } = event.data || {}

  try {
    if (type === 'warmup') {
      await getTts()
      self.postMessage({ id, type, ready: true, runtime })
      return
    }

    if (type !== 'generate') return

    const tts = await getTts()
    const audio = await tts.generate(String(text || ''), { voice, speed })
    const wav = audio.toWav()
    self.postMessage({ id, type, audio: wav, runtime }, [wav])
  } catch (error) {
    self.postMessage({
      id,
      type,
      error: error?.message || 'Kokoro generation failed',
    })
  }
}
