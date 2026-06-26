<template>
  <div class="pdf-viewer" ref="viewerRef">
    <div v-if="pdfError" class="pdf-error">
      <i class="ri-file-damage-line"></i>
      <p>Could not render PDF.</p>
    </div>

    <div v-else-if="!ready" class="pdf-loading">
      <SkeletonLoader variant="pdf" />
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
            v-for="(highlight, index) in highlightsByPage[page.number] || []"
            :key="index"
            class="pdf-highlight"
            :style="{
              left: `${highlight.left}px`,
              top: `${highlight.top}px`,
              width: `${highlight.width}px`,
              height: `${highlight.height}px`,
            }"
          ></span>
        </div>
        <div class="pdf-word-highlight-layer" aria-hidden="true">
          <span
            v-for="(highlight, index) in wordHighlightsByPage[page.number] || []"
            :key="index"
            class="pdf-word-highlight"
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
import { chunkHighlightRects, chunkSubRangeRects, scrollTargetForChunk } from '~/composables/usePdfGeometry'

const props = defineProps({
  src: { required: true },
  zoom: { type: Number, default: 1 },
  manifest: { type: Object, default: null },
  activeChunkId: { type: Number, default: -1 },
  activeWord: { type: Object, default: null },
})

const emit = defineEmits(['page-change', 'loaded'])

const viewerRef = ref(null)
const pages = ref([])
const ready = ref(false)
const pdfError = ref(false)
const highlightsByPage = ref({})

const pageCanvases = new Map()
const pageWraps = new Map()
const viewportTransforms = new Map()

let pdfDocument = null
let renderGeneration = 0
let pageObserver = null

const dataUrlToBytes = (dataUrl) => {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const sourceToBytes = async (source) => {
  if (source instanceof Uint8Array) return source
  if (source instanceof ArrayBuffer) return new Uint8Array(source.slice(0))
  if (source instanceof Blob) return new Uint8Array(await source.arrayBuffer())
  if (typeof source === 'string') return dataUrlToBytes(source)
  throw new TypeError('Unsupported PDF source')
}

const setPageCanvas = (element, pageNumber) => {
  if (element) pageCanvases.set(pageNumber, element)
}

const setPageWrap = (element, pageNumber) => {
  if (element) pageWraps.set(pageNumber, element)
}

const resetPageRefs = () => {
  pageCanvases.clear()
  pageWraps.clear()
  viewportTransforms.clear()
}

const renderPage = async (pageNumber, baseScale, generation) => {
  if (!pdfDocument || generation !== renderGeneration) return
  const page = await pdfDocument.getPage(pageNumber)
  if (generation !== renderGeneration) return

  const viewport = page.getViewport({ scale: baseScale * props.zoom })
  viewportTransforms.set(pageNumber, viewport.transform.slice())
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
}

const updateHighlights = () => {
  const chunk = props.manifest?.chunks?.find(entry => entry.id === props.activeChunkId)
  const viewportTransform = chunk ? viewportTransforms.get(chunk.page) : null
  if (!chunk || !viewportTransform) {
    highlightsByPage.value = {}
    return
  }

  highlightsByPage.value = {
    [chunk.page]: chunkHighlightRects(props.manifest, chunk.id, viewportTransform)
      .map(rect => ({
        left: Math.max(0, rect.left - 1.5),
        top: Math.max(0, rect.top - 1),
        width: rect.width + 3,
        height: rect.height + 2,
      })),
  }
}

const wordHighlightsByPage = ref({})

const updateWordHighlights = () => {
  const chunk = props.manifest?.chunks?.find(entry => entry.id === props.activeChunkId)
  const range = props.activeWord
  const viewportTransform = chunk ? viewportTransforms.get(chunk.page) : null
  if (!chunk || !range || !viewportTransform || !(range.end > range.start)) {
    wordHighlightsByPage.value = {}
    return
  }

  wordHighlightsByPage.value = {
    [chunk.page]: chunkSubRangeRects(props.manifest, chunk.id, range.start, range.end, viewportTransform)
      .map(rect => ({
        left: Math.max(0, rect.left - 1),
        top: Math.max(0, rect.top - 1),
        width: rect.width + 2,
        height: rect.height + 2,
      })),
  }
}

const refreshHighlights = () => {
  updateHighlights()
  updateWordHighlights()
}

const buildPages = async () => {
  if (!pdfDocument) return
  const firstPage = await pdfDocument.getPage(1)
  const firstViewport = firstPage.getViewport({ scale: 1 })
  const availableWidth = Math.max(320, (viewerRef.value?.clientWidth || 820) - 32)
  const baseScale = availableWidth / firstViewport.width

  const pageRecords = []
  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
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
  setupPageObserver()

  const generation = renderGeneration
  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    await renderPage(pageNumber, baseScale, generation)
  }

  refreshHighlights()
  emit('loaded', { pages: pdfDocument.numPages })
}

const renderPdf = async () => {
  if (!props.src) return
  const generation = ++renderGeneration
  ready.value = false
  pdfError.value = false
  pages.value = []
  highlightsByPage.value = {}
  resetPageRefs()

  try {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url
    ).toString()
    const bytes = await sourceToBytes(props.src)
    pdfDocument = await pdfjsLib.getDocument({ data: bytes }).promise
    if (generation !== renderGeneration) return
    await buildPages()
  } catch (error) {
    console.error('PDF render error:', error)
    pdfError.value = true
    ready.value = false
  }
}

const setupPageObserver = () => {
  pageObserver?.disconnect()
  pageObserver = new IntersectionObserver((entries) => {
    const best = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
    const pageNumber = Number(best?.target?.dataset?.page)
    if (pageNumber) emit('page-change', pageNumber)
  }, {
    root: null,
    rootMargin: '-48px 0px -120px 0px',
    threshold: [0.1, 0.3, 0.5, 0.7],
  })
  for (const wrap of pageWraps.values()) pageObserver.observe(wrap)
}

const getVisiblePage = () => {
  const anchorY = 56
  const records = [...pageWraps.entries()].map(([page, element]) => {
    const rect = element.getBoundingClientRect()
    return { page, top: rect.top, bottom: rect.bottom }
  })
  const atAnchor = records.find(record => record.top <= anchorY && record.bottom > anchorY)
  if (atAnchor) return atAnchor.page
  records.sort((a, b) => Math.abs(a.top - anchorY) - Math.abs(b.top - anchorY))
  return records[0]?.page || 1
}

const scrollToPage = (pageNumber, behavior = 'smooth', block = 'start') => {
  pageWraps.get(Number(pageNumber))?.scrollIntoView({ behavior, block })
}

const scrollToChunk = (chunkId, behavior = 'smooth') => {
  const chunk = props.manifest?.chunks?.find(entry => entry.id === Number(chunkId))
  const viewportTransform = chunk ? viewportTransforms.get(chunk.page) : null
  if (!chunk || !viewportTransform) return

  const target = scrollTargetForChunk(props.manifest, chunk.id, viewportTransform)
  const pageWrap = pageWraps.get(chunk.page)
  if (!target || !pageWrap) return
  const pageRect = pageWrap.getBoundingClientRect()
  const top = window.scrollY + pageRect.top + target.top - 72
  window.scrollTo({ top: Math.max(0, top), behavior })
}

defineExpose({ getVisiblePage, scrollToPage, scrollToChunk })

onMounted(renderPdf)
onUnmounted(() => pageObserver?.disconnect())

watch(() => props.src, renderPdf)
watch(() => props.zoom, renderPdf)
watch(() => props.manifest, refreshHighlights, { deep: true })
watch(() => props.activeChunkId, refreshHighlights)
watch(() => props.activeWord, updateWordHighlights)
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
  background: var(--color-surface-primary);
  border-radius: 3px;
  overflow: hidden;
  box-shadow: var(--shadow-reader-page);
}

.pdf-canvas {
  display: block;
  background: var(--color-surface-primary);
}

.pdf-highlight-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}

.pdf-highlight {
  position: absolute;
  background: var(--color-reader-highlight);
  border-radius: 2px;
  box-shadow: 0 0 0 1px var(--color-reader-highlight-border);
  mix-blend-mode: multiply;
}

.pdf-word-highlight-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
}

.pdf-word-highlight {
  position: absolute;
  background: var(--color-reader-word-highlight);
  border-radius: 2px;
  mix-blend-mode: multiply;
}

.pdf-loading,
.pdf-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 4rem 0;
  color: var(--color-text-muted);
  text-align: center;
}

.pdf-error i {
  font-size: 2.5rem;
}
</style>
