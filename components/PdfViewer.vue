<template>
  <div class="pdf-viewer">
    <div v-if="pdfError" class="pdf-error">
      <i class="ri-file-damage-line"></i>
      <p>Could not render PDF.</p>
    </div>
    <div v-else-if="!ready" class="pdf-loading">
      <div class="loader-spinner"></div>
      <p>Rendering PDF…</p>
    </div>
    <template v-else>
      <div
        v-for="n in numPages"
        :key="n"
        class="pdf-page-wrap"
      >
        <canvas :ref="el => { if (el) pageCanvases[n - 1] = el }" class="pdf-canvas"></canvas>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'

const props = defineProps({
  src: { type: String, required: true }
})

const numPages = ref(0)
const pageCanvases = ref([])
const ready = ref(false)
const pdfError = ref(false)

const dataUrlToBytes = (dataUrl) => {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const renderPdf = async () => {
  if (!props.src) return
  ready.value = false
  pdfError.value = false
  pageCanvases.value = []

  try {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url
    ).toString()

    const bytes = dataUrlToBytes(props.src)
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
    numPages.value = pdf.numPages
    ready.value = true

    await nextTick()

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const containerWidth = pageCanvases.value[i - 1]?.parentElement?.clientWidth || 680
      const baseViewport = page.getViewport({ scale: 1 })
      const scale = containerWidth / baseViewport.width
      const viewport = page.getViewport({ scale })

      const canvas = pageCanvases.value[i - 1]
      if (!canvas) continue
      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.style.width = '100%'

      await page.render({
        canvasContext: canvas.getContext('2d'),
        viewport,
      }).promise
    }
  } catch (err) {
    console.error('PDF render error:', err)
    pdfError.value = true
    ready.value = false
  }
}

onMounted(renderPdf)
watch(() => props.src, renderPdf)
</script>

<style scoped>
.pdf-viewer {
  width: 100%;
}

.pdf-page-wrap {
  margin-bottom: 1.5rem;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.pdf-canvas {
  display: block;
  width: 100%;
  height: auto;
}

.pdf-loading,
.pdf-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 4rem 0;
  color: #6b7280;
  text-align: center;
}

.loader-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(138, 43, 226, 0.2);
  border-top-color: #8A2BE2;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.pdf-error i { font-size: 2.5rem; }
</style>
