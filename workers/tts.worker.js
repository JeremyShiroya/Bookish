// Kokoro TTS Web Worker — runs ONNX inference off the main thread.

let _tts = null
let _device = null

// kokoro-js README: "If using webgpu, we recommend dtype=fp32"
const DTYPE = { webgpu: 'fp32', wasm: 'q8' }

self.onmessage = async ({ data: msg }) => {
  if (msg.type === 'init') {
    try {
      await init((pct) => self.postMessage({ type: 'progress', pct }))
      self.postMessage({ type: 'ready', device: _device })
    } catch (err) {
      self.postMessage({ type: 'load_error', message: err.message })
    }

  } else if (msg.type === 'generate') {
    const { id, text, voice } = msg
    const t0 = performance.now()
    try {
      if (!_tts) throw new Error('Model not loaded')
      const result = await _tts.generate(text, { voice })
      const ms = Math.round(performance.now() - t0)
      if (!result?.audio?.length) throw new Error(`Empty audio output after ${ms}ms`)
      console.log(`[TTS] ${_device} chunk: ${text.length}ch "${voice}" → ${ms}ms, ${result.audio.length} samples @ ${result.sampling_rate}Hz`)
      // toWav() encodes sampling_rate, bit depth, channels into a WAV header.
      // decodeAudioData() on the main thread reads it correctly — no manual
      // PCM wrangling, no chance of wrong sampling_rate causing static.
      const wav = result.toWav()
      self.postMessage({ type: 'audio', id, wav }, [wav])
    } catch (err) {
      console.error(`[TTS] chunk failed (${Math.round(performance.now() - t0)}ms):`, err.message)
      self.postMessage({ type: 'gen_error', id, message: err.message })
    }
  }
}

async function init(progressCb) {
  progressCb(2)
  const { KokoroTTS } = await import('kokoro-js')

  for (const device of ['webgpu', 'wasm']) {
    try {
      const t0 = performance.now()
      _tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype: DTYPE[device],
        device,
        progress_callback: (p) => {
          if (p.status === 'progress' && p.total) {
            progressCb(Math.max(2, Math.round((p.loaded / p.total) * 70)))
          }
        },
      })
      console.log(`[TTS] Model on ${device} (${DTYPE[device]}) in ${Math.round(performance.now() - t0)}ms`)
      progressCb(75)

      // Warmup: first inference compiles shaders (WebGPU) or optimises graph
      // (WASM). Doing it here means the user's first play chunk is fast.
      // Any failure here (including empty audio) is treated as device failure
      // and falls through to the next device.
      const w0 = performance.now()
      const warm = await _tts.generate('Hello.', { voice: 'af_bella' })
      if (!warm?.audio?.length) throw new Error(`${device} warmup produced empty audio`)
      console.log(`[TTS] Warmup ${device} ok in ${Math.round(performance.now() - w0)}ms (${warm.audio.length} samples @ ${warm.sampling_rate}Hz)`)

      progressCb(99)
      _device = device
      return  // success — stop trying devices
    } catch (e) {
      console.warn(`[TTS] ${device} failed:`, e.message)
      _tts = null
      _device = null
      if (device === 'wasm') throw new Error(`Kokoro load failed on all devices: ${e.message}`)
    }
  }
}
