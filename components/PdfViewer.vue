<template>
  <div class="pdf-viewer" ref="viewerRef">
    <div v-if="pdfError" class="pdf-error">
      <i class="ri-file-damage-line"></i>
      <p>Could not render PDF.</p>
    </div>

    <div v-else-if="!ready" class="pdf-loading">
      <div class="loader-spinner"></div>
      <p>Rendering PDF...</p>
    </div>

    <template v-else>
      <div
        v-for="page in pages"
        :id="`pdf-page-${page.number}`"
        :key="page.number"
        :ref="el => setPageWrap(el, page.number)"
        class="pdf-page-wrap"
        :data-page="page.number"
        :style="{ width: `${page.width}px`, height: `${page.height}px` }"
      >
        <canvas
          :ref="el => setPageCanvas(el, page.number)"
          class="pdf-canvas"
        ></canvas>
        <div class="pdf-highlight-layer" aria-hidden="true">
          <span
            v-for="(highlight, idx) in highlightsByPage[page.number] || []"
            :key="idx"
            class="pdf-highlight"
            :style="{
              left: `${highlight.left}px`,
              top: `${highlight.top}px`,
              width: `${highlight.width}px`,
              height: `${highlight.height}px`,
            }"
          ></span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { stripHtml, splitToChunks } from '~/composables/useTTS'

const props = defineProps({
  src: { required: true },
  zoom: { type: Number, default: 1 },
  activeChunkIndex: { type: Number, default: -1 },
  textContent: { type: String, default: '' },
})

const emit = defineEmits(['page-change', 'loaded'])

const viewerRef = ref(null)
const pages = ref([])
const ready = ref(false)
const pdfError = ref(false)
const highlightsByPage = ref({})

const pageCanvases = new Map()
const pageWraps = new Map()

let pdfDocument = null
let pdfjsLibRef = null
let renderGeneration = 0
let pageObserver = null
let flatPdfText = ''
let textItemRefs = []

const normalizeText = (value) => (value || '').replace(/\s+/g, ' ').trim()

const dataUrlToBytes = (dataUrl) => {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const sourceToBytes = async (source) => {
  if (source instanceof Uint8Array) return source
  if (source instanceof ArrayBuffer) return new Uint8Array(source.slice(0))
  if (source instanceof Blob) return new Uint8Array(await source.arrayBuffer())
  if (typeof source === 'string') return dataUrlToBytes(source)
  throw new TypeError('Unsupported PDF source')
}

const setPageCanvas = (el, pageNumber) => {
  if (el) pageCanvases.set(pageNumber, el)
}

const setPageWrap = (el, pageNumber) => {
  if (el) pageWraps.set(pageNumber, el)
}

const resetPageRefs = () => {
  pageCanvases.clear()
  pageWraps.clear()
}

const rectForTextItem = (item, viewport) => {
  const pdfjsLib = pdfjsLibRef
  const tx = pdfjsLib.Util.transform(viewport.transform, item.transform)
  const fontHeight = Math.hypot(tx[2], tx[3]) || Math.abs(item.height * viewport.scale) || 12
  const width = Math.max(2, (item.width || item.str.length * 5) * viewport.scale)
  const left = tx[4]
  const top = tx[5] - fontHeight

  return {
    left: Math.max(0, left),
    top: Math.max(0, top),
    width,
    height: Math.max(8, fontHeight * 1.08),
  }
}

const renderPage = async (pageNumber, baseScale, generation) => {
  if (!pdfDocument || generation !== renderGeneration) return

  const page = await pdfDocument.getPage(pageNumber)
  if (generation !== renderGeneration) return

  const viewport = page.getViewport({ scale: baseScale * props.zoom })
  const canvas = pageCanvases.get(pageNumber)
  if (!canvas) return

  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.floor(viewport.width * dpr)
  canvas.height = Math.floor(viewport.height * dpr)
  canvas.style.width = `${viewport.width}px`
  canvas.style.height = `${viewport.height}px`

  const context = canvas.getContext('2d')
  context.setTransform(dpr, 0, 0, dpr, 0, 0)

  await page.render({ canvasContext: context, viewport }).promise

  const textContent = await page.getTextContent()
  for (const item of textContent.items) {
    const text = normalizeText(item.str)
    if (!text) continue

    const start = flatPdfText.length
    flatPdfText += `${text} `
    textItemRefs.push({
      pageNumber,
      start,
      end: flatPdfText.length - 1,
      rect: rectForTextItem(item, viewport),
    })
  }
}

const buildPages = async () => {
  if (!pdfDocument) return

  const firstPage = await pdfDocument.getPage(1)
  const firstViewport = firstPage.getViewport({ scale: 1 })
  const availableWidth = Math.max(320, (viewerRef.value?.clientWidth || 820) - 32)
  const baseScale = availableWidth / firstViewport.width

  const pageRecords = []
  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
    const page = pageNumber === 1 ? firstPage : await pdfDocument.getPage(pageNumber)
    const viewport = page.getViewport({ scale: baseScale * props.zoom })
    pageRecords.push({
      number: pageNumber,
      width: viewport.width,
      height: viewport.height,
    })
  }

  pages.value = pageRecords
  ready.value = true
  await nextTick()

  const generation = renderGeneration
  flatPdfText = ''
  textItemRefs = []

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
    await renderPage(pageNumber, baseScale, generation)
  }

  updateHighlights()
  setupPageObserver()
  emit('loaded', { pages: pdfDocument.numPages })
}

const renderPdf = async () => {
  if (!props.src) return

  const generation = ++renderGeneration
  ready.value = false
  pdfError.value = false
  pages.value = []
  highlightsByPage.value = {}
  flatPdfText = ''
  textItemRefs = []
  resetPageRefs()

  try {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url
    ).toString()
    pdfjsLibRef = pdfjsLib

    const bytes = await sourceToBytes(props.src)
    pdfDocument = await pdfjsLib.getDocument({ data: bytes }).promise
    if (generation !== renderGeneration) return

    await buildPages()
  } catch (err) {
    console.error('PDF render error:', err)
    pdfError.value = true
    ready.value = false
  }
}

const findChunkRange = (chunkIndex) => {
  const chunks = splitToChunks(stripHtml(props.textContent || ''))
  if (chunkIndex < 0 || chunkIndex >= chunks.length || !flatPdfText) return null

  const flatLower = flatPdfText.toLowerCase()
  let searchFrom = 0

  for (let i = 0; i <= chunkIndex; i++) {
    const target = normalizeText(chunks[i]).toLowerCase()
    if (!target) continue

    const keyLength = Math.min(120, target.length)
    const key = target.slice(0, keyLength)
    let position = flatLower.indexOf(key, searchFrom)

    if (position === -1 && keyLength > 48) {
      position = flatLower.indexOf(target.slice(0, 48), searchFrom)
    }

    if (position === -1) return null
    if (i === chunkIndex) {
      return {
        start: position,
        end: position + target.length,
      }
    }
    searchFrom = position + Math.max(1, key.length)
  }

  return null
}

const updateHighlights = () => {
  const range = findChunkRange(props.activeChunkIndex)
  if (!range) {
    highlightsByPage.value = {}
    return
  }

  const nextHighlights = {}
  for (const item of textItemRefs) {
    if (item.end < range.start || item.start > range.end) continue
    if (!nextHighlights[item.pageNumber]) nextHighlights[item.pageNumber] = []
    nextHighlights[item.pageNumber].push({
      left: Math.max(0, item.rect.left - 2),
      top: Math.max(0, item.rect.top - 1),
      width: item.rect.width + 4,
      height: item.rect.height + 2,
    })
  }

  highlightsByPage.value = nextHighlights

  const firstPage = Number(Object.keys(nextHighlights)[0])
  if (firstPage) {
    scrollToPage(firstPage, 'smooth', 'center')
  }
}

const setupPageObserver = () => {
  if (pageObserver) pageObserver.disconnect()

  pageObserver = new IntersectionObserver((entries) => {
    let best = null
    let bestRatio = 0

    for (const entry of entries) {
      if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
        best = entry.target
        bestRatio = entry.intersectionRatio
      }
    }

    const pageNumber = Number(best?.dataset?.page)
    if (pageNumber) emit('page-change', pageNumber)
  }, {
    root: null,
    rootMargin: '-48px 0px -120px 0px',
    threshold: [0.1, 0.3, 0.5, 0.7],
  })

  for (const wrap of pageWraps.values()) {
    pageObserver.observe(wrap)
  }
}

const scrollToPage = (pageNumber, behavior = 'smooth', block = 'start') => {
  const page = pageWraps.get(Number(pageNumber))
  if (page) page.scrollIntoView({ behavior, block })
}

defineExpose({ scrollToPage })

onMounted(renderPdf)
onUnmounted(() => {
  if (pageObserver) pageObserver.disconnect()
})

watch(() => props.src, renderPdf)
watch(() => props.zoom, renderPdf)
watch(() => props.activeChunkIndex, updateHighlights)
watch(() => props.textContent, updateHighlights)
</script>

<style scoped>
.pdf-viewer {
  width: 100%;
  max-width: min(100%, 1040px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  overflow-x: auto;
  padding: 0 0.5rem 2rem;
}

.pdf-page-wrap {
  position: relative;
  flex: 0 0 auto;
  background: #ffffff;
  border-radius: 3px;
  overflow: hidden;
  box-shadow: 0 2px 24px rgba(0, 0, 0, 0.13);
}

.pdf-canvas {
  display: block;
  background: #ffffff;
}

.pdf-highlight-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.pdf-highlight {
  position: absolute;
  background: rgba(255, 213, 79, 0.42);
  border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(236, 179, 0, 0.2);
  mix-blend-mode: multiply;
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

@keyframes spin {
  to { transform: rotate(360deg); }
}

.pdf-error i {
  font-size: 2.5rem;
}
</style>
