// Kokoro TTS Web Worker — runs ONNX inference off the main thread.
// Returns 16-bit PCM mono WAV (the most universally-supported audio format).
// The main thread plays it via a plain HTML5 Audio element + Blob URL — no
// Web Audio API, no decodeAudioData, no createBuffer. The browser's native
// WAV decoder handles everything, which is the most reliable path.

let _tts = null
let _device = null

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
      const samples = result.audio
      const sampling_rate = result.sampling_rate
      if (!samples?.length) throw new Error(`Empty audio output after ${ms}ms`)
      console.log(`[TTS] ${_device} chunk: ${text.length}ch "${voice}" → ${ms}ms, ${samples.length} samples @ ${sampling_rate}Hz`)
      // Encode 16-bit PCM mono WAV. Universal browser support, no quirks.
      const wav = encodeWav16(samples, sampling_rate)
      self.postMessage({ type: 'audio', id, wav }, [wav])
    } catch (err) {
      console.error(`[TTS] chunk failed (${Math.round(performance.now() - t0)}ms):`, err.message)
      self.postMessage({ type: 'gen_error', id, message: err.message })
    }
  }
}

// 16-bit PCM mono WAV encoder. Returns an ArrayBuffer ready for transfer.
function encodeWav16(samples, sampleRate) {
  const numSamples = samples.length
  const dataBytes = numSamples * 2
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)

  // RIFF header
  writeStr(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  writeStr(view, 8, 'WAVE')

  // fmt chunk
  writeStr(view, 12, 'fmt ')
  view.setUint32(16, 16, true)         // chunk size
  view.setUint16(20, 1, true)          // PCM
  view.setUint16(22, 1, true)          // mono
  view.setUint32(24, sampleRate, true) // sample rate
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true)          // block align
  view.setUint16(34, 16, true)         // bits per sample

  // data chunk
  writeStr(view, 36, 'data')
  view.setUint32(40, dataBytes, true)

  let offset = 44
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
    offset += 2
  }

  return buffer
}

function writeStr(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
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

      const w0 = performance.now()
      const warm = await _tts.generate('Hello.', { voice: 'af_bella' })
      if (!warm?.audio?.length) throw new Error(`${device} warmup produced empty audio`)
      console.log(`[TTS] Warmup ${device} ok in ${Math.round(performance.now() - w0)}ms (${warm.audio.length} samples @ ${warm.sampling_rate}Hz)`)

      progressCb(99)
      _device = device
      return
    } catch (e) {
      console.warn(`[TTS] ${device} failed:`, e.message)
      _tts = null
      _device = null
      if (device === 'wasm') throw new Error(`Kokoro load failed on all devices: ${e.message}`)
    }
  }
}
