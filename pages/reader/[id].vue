<template>
  <ResponsiveViewSwitch>
    <template #mobile>
      <component
        :is="mobileReaderComponent"
        :reader-refs="mobileReaderRefs"
        :reader-theme="readerTheme"
        :book="book"
        :loading="loading"
        :content-loading="contentLoading"
        :is-pdf-renderable="isPdfRenderable"
        :is-pdf-book="isPdfBook"
        :pdf-source="pdfSource"
        :zoom-level="zoomLevel"
        :pdf-manifest="pdfManifest"
        :active-tts-chunk-index="activeTtsChunkIndex"
        :active-word-range="activeWordRange"
        :has-cover="hasCover"
        :chapter-list="mobileChapterList"
        :current-chapter-idx="currentChapterIdx"
        :current-pdf-page="currentPdfPage"
        :total-pages="totalPages"
        :toc-position="tocPosition"
        :current-chapter-title="currentChapterTitle"
        :sanitize-html="sanitizeHtml"
        :resolve-chunk-at-point="resolveChunkAtPoint"
        :prewarm-chunk="prewarmChunkAudio"
        :readable-chunks="allReadableChunks"
        :section-counts="epubSectionCounts"
        :full-sections="chapterList"
        :toc-items="displayTocItems"
        @back="router.back()"
        @open-toc="tocOpen = true"
        @page-change="handlePdfPageChange"
        @pdf-loaded="handlePdfLoaded"
        @read-current-position="playFromCurrentPosition"
        @read-from-chunk="playFromChunk"
        @previous-chapter="goToAdjacentChapter(-1)"
        @next-chapter="goToAdjacentChapter(1)"
        @mount-section="mountSection"
        @position-change="handleMobilePosition"
        @go-to-section="goToSectionFromMobile"
        @jump-to-toc="goToTocItem"
      />
    </template>

    <template #desktop>
      <div ref="readerPageRef" class="reader-page" :class="readerTheme">
    <header class="reader-topbar">
      <div class="tb-section tb-left">
        <button class="tb-btn" @click="router.back()" title="Back to Library">
          <i class="ri-arrow-left-line"></i>
        </button>
        <span class="tb-sep" />
        <button class="tb-btn" @click="tocOpen = !tocOpen" title="Table of Contents">
          <i class="ri-menu-2-line"></i>
        </button>
        <span class="tb-sep" />
        <button class="tb-btn" @click="zoomOut" :disabled="zoomLevel <= MIN_ZOOM" title="Zoom out">
          <i class="ri-subtract-line"></i>
        </button>
        <span class="tb-size">{{ Math.round(zoomLevel * 100) }}%</span>
        <button class="tb-btn" @click="zoomIn" :disabled="zoomLevel >= MAX_ZOOM" title="Zoom in">
          <i class="ri-add-line"></i>
        </button>
      </div>

      <div class="tb-section tb-center">
        <span class="chapter-counter" v-if="book">
          <template v-if="isPdfRenderable">
            <b class="ch-num">{{ currentPdfPage }} / {{ totalPages || book.pages || 1 }}</b>
            <span class="ch-sep">&nbsp;Page</span>
          </template>
          <template v-else-if="tocPosition">
            <b class="ch-num">{{ tocPosition.number }} / {{ tocPosition.total }}</b>
            <span class="ch-sep" v-if="tocPosition.title">&nbsp;-&nbsp;</span>
            <span class="ch-title">{{ tocPosition.title }}</span>
          </template>
          <template v-else-if="chapterList.length">
            <b class="ch-num">{{ currentChapterIdx + 1 }} / {{ chapterList.length }}</b>
            <span class="ch-sep" v-if="currentChapterTitle">&nbsp;-&nbsp;</span>
            <span class="ch-title">{{ currentChapterTitle }}</span>
          </template>
        </span>
      </div>

      <div class="tb-section tb-right">
        <button
          class="tb-btn"
          :disabled="!book || !allReadableChunks.length"
          @click="requestReadCurrentPosition"
          title="Read from here"
        >
          <i class="ri-file-transfer-line"></i>
        </button>
        <button
          class="tb-btn"
          :disabled="!isCurrentBookNarrating"
          @click="jumpToNarration"
          title="Jump to narration"
        >
          <i class="ri-focus-3-line"></i>
        </button>
        <span class="tb-sep" />
        <button
          class="tb-btn"
          @click="toggleTheme"
          :title="readerTheme === 'light' ? 'Dark mode' : 'Light mode'"
        >
          <i :class="readerTheme === 'light' ? 'ri-moon-line' : 'ri-sun-line'"></i>
        </button>
      </div>
    </header>

    <div class="toc-backdrop" :class="{ visible: tocOpen }" @click="tocOpen = false" />

    <aside class="toc-sidebar" :class="{ open: tocOpen }" ref="tocSidebarRef">
      <div class="toc-head">
        <div class="toc-head-info">
          <span class="toc-head-label">Contents</span>
          <span v-if="book" class="toc-head-book">{{ book.title }}</span>
        </div>
        <button class="tb-btn" @click="tocOpen = false" title="Close contents">
          <i class="ri-close-line"></i>
        </button>
      </div>

      <nav v-if="displayTocItems.length" class="toc-nav" ref="tocNavRef">
        <button
          v-for="(item, i) in displayTocItems"
          :key="`${item.type}-${item.page ?? item.index}-${i}`"
          class="toc-item"
          :class="{ active: isTocItemActive(item) }"
          :style="{ paddingLeft: `${1 + (item.level || 0) * 0.8}rem` }"
          @click="goToTocItem(item)"
        >
          <span class="toc-indicator"></span>
          <span class="toc-title">{{ item.title }}</span>
        </button>
      </nav>

      <div v-else-if="isPdfBook && tocLoading" class="toc-skeleton">
        <SkeletonLoader variant="toc" :count="6" />
      </div>

      <div v-else class="toc-empty">
        {{ tocEmptyMessage }}
      </div>
    </aside>

    <main class="reader-body">
      <div v-if="loading || contentLoading" class="state-center">
        <SkeletonLoader variant="reader" />
      </div>

      <div v-else-if="!book" class="state-center state-error">
        <i class="ri-error-warning-line"></i>
        <h2>Book not found</h2>
        <button class="btn-primary" @click="router.back()">Return to Library</button>
      </div>

      <template v-else>
        <PdfViewer
          v-if="isPdfRenderable"
          ref="pdfViewerRef"
          :src="pdfSource"
          :zoom="zoomLevel"
          :manifest="pdfManifest"
          :active-chunk-id="activeTtsChunkIndex"
          :active-word="activeWordRange"
          @page-change="handlePdfPageChange"
          @loaded="handlePdfLoaded"
        />

        <div v-else-if="isPdfBook" class="pdf-unavailable-card">
          <i class="ri-file-pdf-2-line"></i>
          <p>This PDF was imported before original-page rendering was available.</p>
          <p class="hint">Re-upload the PDF once so Bookish can display the document exactly as it is.</p>
        </div>

        <div v-else class="chapters-container" ref="chaptersContainerRef">
          <section v-if="hasCover" id="ch-cover" class="chapter-section cover-section">
            <div class="cover-artwork">
              <img :src="book.cover" :alt="book.title + ' cover'" class="cover-img" />
            </div>
            <div class="cover-meta">
              <h1 class="cover-title">{{ book.title }}</h1>
              <p class="cover-author">by {{ book.author }}</p>
            </div>
          </section>

          <section
            v-for="(ch, i) in chapterList"
            :key="i"
            :id="'ch-' + i"
            class="chapter-section"
            :style="{ zoom: zoomLevel }"
          >
            <article
              class="chapter-content epub-content"
              v-html="sanitizeHtml(ch.html)"
            />
          </section>

          <div v-if="!chapterList.length && !contentLoading" class="empty-notice">
            <i class="ri-book-open-line"></i>
            <p>No readable content found.</p>
            <p class="hint">Re-upload the book to enable in-app reading.</p>
          </div>
        </div>
      </template>
    </main>

    <div
      v-if="confirmReadFromHereOpen"
      class="read-confirm-backdrop"
      @click="cancelReadFromHere"
    >
      <section
        class="read-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="read-confirm-title"
        @click.stop
      >
        <h2 id="read-confirm-title">Read from here?</h2>
        <p>This will stop the current narration and start from the position currently on screen.</p>
        <div class="read-confirm-actions">
          <button type="button" class="read-confirm-btn secondary" @click="cancelReadFromHere">
            Cancel
          </button>
          <button type="button" class="read-confirm-btn primary" @click="confirmReadFromHere">
            Read from here
          </button>
        </div>
      </section>
    </div>
      </div>
    </template>
  </ResponsiveViewSwitch>
</template>

<script setup>
definePageMeta({ layout: 'reader' })

import { computed, nextTick, onMounted, onUnmounted, ref, toRaw, watch } from 'vue'
import { useBooks } from '~/composables/useBooks'
import { isRenderableSection, buildReadableChunks, useTTS } from '~/composables/useTTS'
import { useBookStorage } from '~/composables/useBookStorage'
import { useBookishSettings } from '~/composables/useBookishSettings'
import { sanitizeBookHtml } from '~/composables/useHtmlSanitizer'
import {
  buildTextIndex,
  mapSectionChunks,
  resolveRangePoint,
  unwrapTtsSpans,
} from '~/composables/useChunkSpans'
import { getPrewarmedReaderContent } from '~/composables/useReaderPrewarm'
import {
  extractPdfContentFromSource,
  extractPdfTocFromSource,
  formatPdfTocTitle,
  pdfSourceToBytes,
} from '~/composables/usePdfExtractor'
import { PDF_MANIFEST_VERSION, firstChunkForPage, pageForChunk } from '~/composables/usePdfManifest'
import { pdfProgressForPage } from '~/composables/useReaderPosition'
import ReaderMobile from '~/components/mobile/ReaderMobile.vue'
import PdfViewer from '~/components/shared/PdfViewer.vue'
import ResponsiveViewSwitch from '~/components/shared/ResponsiveViewSwitch.vue'
import SkeletonLoader from '~/components/shared/SkeletonLoader.vue'

const mobileReaderComponent = ReaderMobile
const route = useRoute()
const router = useRouter()
const { books, initialized, fetchAllData, fetchBookById, updateBook } = useBooks()
const { getBookContent, saveBookContent } = useBookStorage()
const { settings, updateSettings } = useBookishSettings()
const {
  ttsBook,
  ttsChunkIdx,
  ttsPlayingChunkIdx,
  ttsStatus,
  ttsWordIdx,
  ttsBoundaries,
  play: playTTS,
  pause: pauseTTS,
  resume: resumeTTS,
  prewarmText,
} = useTTS()

const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.5

const readerPageRef = ref(null)
const chaptersContainerRef = ref(null)
const pdfViewerRef = ref(null)
const tocNavRef = ref(null)
const mobileReaderRefs = {
  readerPageRef,
  chaptersContainerRef,
  pdfViewerRef,
}

const book = ref(null)
const loading = ref(true)
const contentLoading = ref(false)
const rawContent = ref('')
const tocTitles = ref([])
const tocItems = ref([])
const pdfTocChecked = ref(false)
const tocLoading = ref(false)
const pdfSource = ref(null)
const pdfManifest = ref(null)

const zoomLevel = ref(settings.value.readerZoom)
const readerTheme = ref(settings.value.readerTheme)
const tocOpen = ref(false)
const currentChapterIdx = ref(0)
const currentPdfPage = ref(1)
const totalPages = ref(0)
const restoredInitialPdfScroll = ref(false)
const readerReady = ref(false)
const confirmReadFromHereOpen = ref(false)
const pendingReadFromHereChunk = ref(0)
const pendingReadFromHerePage = ref(1)
const pendingReadFromHereWasPlaying = ref(false)

const bookFormat = computed(() => (book.value?.format || '').toLowerCase())
const isPdfBook = computed(() => bookFormat.value === 'pdf')
const isPdfRenderable = computed(() => isPdfBook.value && !!pdfSource.value)

function hasCoverVal() {
  const cover = book.value?.cover
  return !!(cover && !cover.startsWith('data:image/svg+xml'))
}

const hasCover = computed(() => hasCoverVal())

const currentChapterTitle = computed(() => {
  const ch = chapterList.value[currentChapterIdx.value]
  return ch ? ch.title : ''
})

// Position among real TOC chapters (sections are page-level file splits,
// so "section 214 / 369" would misrepresent the chapter count).
const tocPosition = computed(() => {
  if (isPdfBook.value) return null
  const entries = displayTocItems.value
  if (!entries.length) return null
  let pos = 0
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].index <= currentChapterIdx.value) pos = i
    else break
  }
  return { number: pos + 1, total: entries.length, title: entries[pos].title }
})

const epubStyle = computed(() => {
  if (!rawContent.value || isPdfBook.value) return ''
  const match = rawContent.value.match(/<style[^>]*>([\s\S]*?)<\/style>/i)
  return match?.[1] ?? ''
})

// Publisher EPUB CSS is desktop-only. On mobile it fought the reader's own
// typography (absolute margins/widths pushed words off the page edge), so the
// mobile readers use their display preferences instead.
const isMobileViewport = ref(false)
let _viewportQuery = null
const _syncViewport = () => { isMobileViewport.value = Boolean(_viewportQuery?.matches) }

useHead(() => ({
  style: epubStyle.value && !isMobileViewport.value
    ? [{ key: 'epub-book-styles', innerHTML: epubStyle.value }]
    : [],
}))

function extractTitle(html, index) {
  const headingMatch = html.match(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/i)
  if (headingMatch) {
    const title = headingMatch[2].replace(/<[^>]+>/g, '').trim()
    if (title.length > 0 && title.length <= 120) return title
  }

  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const patterns = [
    /^(Chapter\s+(?:\d+|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|\w+)(?:\s*[:-]\s*.{0,60})?)/i,
    /^(Part\s+(?:\d+|One|Two|Three|Four|Five|\w+)(?:\s*[:-]\s*.{0,60})?)/i,
    /^(Prologue|Epilogue|Introduction|Preface|Foreword|Afterword|Acknowledgements?|About the Author|Author'?s? Note|Dedication)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return match[1].slice(0, 80)
  }

  return `Page ${index + 1}`
}

function parseChapters(content) {
  if (!content || isPdfBook.value) return []

  const html = content
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/^\s*<div[^>]+class=["'][^"']*epub-content[^"']*["'][^>]*>\s*/i, '')
    .replace(/\s*<\/div>\s*$/, '')

  return html
    .split(/<hr[^>]*chapter-break[^>]*\/?>/i)
    .map(part => part.trim())
    .filter(isRenderableSection)
    .map((html, i) => ({ title: extractTitle(html, i), html }))
}

const chapterList = computed(() => {
  const chapters = parseChapters(rawContent.value)
  if (!chapters.length) return []

  return chapters.map((ch, i) => ({
    ...ch,
    title: tocTitles.value[i] ?? ch.title,
  }))
})

// ── Progressive section mounting (mobile) ──────────────────────────────────
//
// Parsing a whole book's HTML into the DOM at once froze mobile WebViews for
// many seconds. The mobile reader instead receives a windowed view: only the
// sections around the reading position carry HTML; the rest are placeholders
// with an estimated height. The remainder mounts during idle time (or as soon
// as a placeholder approaches the viewport). Desktop keeps the full render.

const mountedSections = ref([])
let _mountIdleId = null
let _mountTimerId = null

function estimateSectionHeight(html) {
  // Estimate rendered column height from the visible text length. Tuned for the
  // reader's 17px / 1.62 line-height body so placeholders are close to the real
  // height, minimising the scroll jump when a section mounts. Each image adds a
  // rough block so image-heavy chapters don't collapse to a tiny placeholder.
  const raw = html || ''
  const textLen = raw.replace(/<[^>]+>/g, '').length
  const imageCount = (raw.match(/<img\b|<image\b|<svg\b/gi) || []).length
  return Math.max(360, Math.min(40000, Math.round(textLen * 0.62) + imageCount * 300))
}

// Placeholder heights are expensive to compute (regex per chapter) and never
// change once the content is parsed. Precompute them ONCE per chapter list so
// mobileChapterList — which recomputes on every single section mount — doesn't
// re-scan every chapter's HTML each time (that O(n²) work froze the reader).
const _sectionHeights = computed(() => chapterList.value.map((c) => estimateSectionHeight(c.html)))

const mobileChapterList = computed(() => {
  const heights = _sectionHeights.value
  const mounted = mountedSections.value
  return chapterList.value.map((chapter, index) => (
    mounted[index]
      ? chapter
      : { ...chapter, html: null, estHeight: heights[index] }
  ))
})

function initialSectionIndex() {
  const total = chapterList.value.length
  // Opened while this book is narrating (e.g. from the mini playing bar):
  // start at the section being read aloud, not the saved progress.
  if (total > 1 && ttsBook.value?.id === book.value?.id && ttsStatus.value !== 'idle') {
    return Math.max(0, Math.min(total - 1, sectionForChunk(ttsChunkIdx.value)))
  }
  const progress = Number(book.value?.progress) || 0
  if (total <= 1 || progress <= 0) return 0
  return Math.max(0, Math.min(total - 1, Math.round((progress / 100) * (total - 1))))
}

function _cancelIdleSectionMounting() {
  if (_mountIdleId !== null && typeof cancelIdleCallback === 'function') {
    cancelIdleCallback(_mountIdleId)
  }
  if (_mountTimerId !== null) clearTimeout(_mountTimerId)
  _mountIdleId = null
  _mountTimerId = null
}

async function _onAllSectionsMounted() {
  await nextTick()
  observeChapters()
  _scheduleChunkMapBuild()
}

function _startIdleSectionMounting(startIdx) {
  _cancelIdleSectionMounting()

  const step = () => {
    _mountIdleId = null
    _mountTimerId = null
    const flags = mountedSections.value

    // Mount outward from the reading position: forward first, then backward.
    // Four per idle slice — with the memoized sanitizer a mount is cheap, and
    // the whole book needs to be ready before a fast fling can reach it.
    for (let mounted = 0; mounted < 4; mounted += 1) {
      let next = -1
      for (let i = startIdx; i < flags.length; i += 1) {
        if (!flags[i]) { next = i; break }
      }
      if (next === -1) {
        for (let i = startIdx - 1; i >= 0; i -= 1) {
          if (!flags[i]) { next = i; break }
        }
      }
      if (next === -1) break
      flags[next] = true
    }

    if (flags.some((flag) => !flag)) schedule()
    else _onAllSectionsMounted()
  }

  const schedule = () => {
    if (typeof requestIdleCallback === 'function') {
      _mountIdleId = requestIdleCallback(step, { timeout: 350 })
    } else {
      _mountTimerId = setTimeout(step, 80)
    }
  }

  schedule()
}

function initializeSectionMounting() {
  const total = chapterList.value.length
  if (!total) {
    mountedSections.value = []
    _cancelIdleSectionMounting()
    return
  }

  const startIdx = initialSectionIndex()
  const flags = new Array(total).fill(false)
  for (let i = startIdx - 1; i <= startIdx + 2; i += 1) {
    if (i >= 0 && i < total) flags[i] = true
  }
  flags[0] = true
  mountedSections.value = flags
  _startIdleSectionMounting(startIdx)
}

function mountSection(index) {
  const flags = mountedSections.value
  const target = Number(index)
  if (Number.isNaN(target) || target < 0 || target >= flags.length) return
  flags[target] = true
}

const pdfTocItems = computed(() => {
  if (!isPdfBook.value) return []
  return tocItems.value || []
})

const displayTocItems = computed(() => {
  if (isPdfBook.value) {
    return (pdfTocItems.value || [])
      .filter(item => item?.title && item?.page)
      .map(item => ({
        ...item,
        title: formatPdfTocTitle(item.title, item.page),
        type: 'pdf',
      }))
  }

  return (tocTitles.value || [])
    .map((title, index) => ({ title, index, level: 0, type: 'chapter' }))
    .filter(item => item.title && item.title.trim())
})

const tocEmptyMessage = computed(() => {
  if (isPdfBook.value && !isPdfRenderable.value) {
    return 'Re-upload this PDF to load its table of contents.'
  }

  return 'This document has no table of contents.'
})

// The section highlight can be turned off in Preferences. Gating it here
// disables both the EPUB sentence band and the PDF chunk overlay at once.
const highlightEnabled = computed(() => settings.value.readerHighlight !== false)

const activeTtsChunkIndex = computed(() => {
  if (!highlightEnabled.value) return -1
  if (ttsBook.value?.id !== book.value?.id || ttsStatus.value === 'idle') return -1
  return ttsPlayingChunkIdx.value
})

const activeWordRange = computed(() => {
  if (activeTtsChunkIndex.value < 0) return null
  const boundary = ttsBoundaries.value?.[ttsWordIdx.value]
  if (!boundary || typeof boundary.charIndex !== 'number' || boundary.charIndex < 0) return null
  const end = boundary.charIndex + (boundary.word?.length || 0)
  if (end <= boundary.charIndex) return null
  return { start: boundary.charIndex, end }
})

const isCurrentBookNarrating = computed(() => (
  ttsBook.value?.id === book.value?.id && ttsStatus.value !== 'idle'
))

// Canonical chunk data: the flat chunk list (TTS playback order) plus the
// per-section chunk counts. Built section-by-section so indices line up with
// the reader's `ch-N` sections, the highlight spans, and the chapter splits.
const readableChunkData = computed(() => buildReadableChunks(rawContent.value || ''))
const epubSectionCounts = computed(() => readableChunkData.value.sectionCounts)
const allReadableChunks = computed(() => (
  isPdfBook.value
    ? (pdfManifest.value?.chunks || []).map(chunk => chunk.text)
    : readableChunkData.value.chunks
))

const activeTtsChunkPage = computed(() => {
  if (!isPdfBook.value || activeTtsChunkIndex.value < 0) return 0
  return pageForChunk(pdfManifest.value, activeTtsChunkIndex.value) || 0
})

// The TOC entry whose section range contains the section being read.
// Chapters usually span many sections (EPUBs split files per few pages),
// so an exact index match would almost never highlight anything.
const activeTocEntryIdx = computed(() => {
  if (isPdfBook.value) return -1
  const entries = displayTocItems.value
  if (!entries.length) return -1
  let active = -1
  for (const entry of entries) {
    if (entry.index <= currentChapterIdx.value) active = entry.index
    else break
  }
  return active
})

function isTocItemActive(item) {
  if (item.type === 'pdf') return currentPdfPage.value === item.page
  return item.index === activeTocEntryIdx.value
}

function goToTocItem(item) {
  if (item.type === 'pdf') {
    pdfViewerRef.value?.scrollToPage(item.page)
  } else {
    // Set the index directly — the mobile paged reader navigates from this
    // prop; scroll readers additionally scroll the section into view.
    currentChapterIdx.value = item.index
    mountSection(item.index)
    scrollToChapter(item.index)
  }
  tocOpen.value = false
}

// Mobile paged reader position (section + page) — keep the chapter index and
// saved progress in step without any scroll observation.
function handleMobilePosition(position) {
  const section = Number(position?.section)
  if (!Number.isFinite(section)) return
  if (section !== currentChapterIdx.value) currentChapterIdx.value = section
}

// Mobile Listen stepper (scroll mode) jumping to the section that owns a page.
function goToSectionFromMobile(index) {
  if (!chapterList.value.length) return
  const target = Math.max(0, Math.min(chapterList.value.length - 1, Number(index) || 0))
  currentChapterIdx.value = target
  mountSection(target)
  scrollToChapter(target)
}

function goToAdjacentChapter(delta) {
  if (isPdfRenderable.value) {
    const targetPage = Math.max(1, Math.min(totalPages.value || book.value?.pages || 1, currentPdfPage.value + delta))
    pdfViewerRef.value?.scrollToPage?.(targetPage)
    currentPdfPage.value = targetPage
    return
  }

  if (!chapterList.value.length) return
  const target = Math.max(0, Math.min(chapterList.value.length - 1, currentChapterIdx.value + delta))
  // Set the index directly so chapter stepping works even when the scroll
  // can't be observed (the mobile Listen layer covers the reading content).
  currentChapterIdx.value = target
  mountSection(target)
  scrollToChapter(target)
}

function scrollToChapter(index) {
  const el = document.getElementById(`ch-${index}`)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// First flat chunk index of section `sectionIndex`, from the per-section counts.
function sectionStartChunk(sectionIndex) {
  const counts = epubSectionCounts.value
  let offset = 0
  for (let i = 0; i < sectionIndex && i < counts.length; i += 1) offset += counts[i] || 0
  return offset
}

// Which section (ch-N) a flat chunk index falls in.
function sectionForChunk(chunkIndex) {
  const counts = epubSectionCounts.value
  const target = Math.max(0, Number(chunkIndex) || 0)
  let offset = 0
  for (let index = 0; index < counts.length; index += 1) {
    const count = Math.max(0, Number(counts[index]) || 0)
    if (target < offset + count) return index
    offset += count
  }
  return Math.max(0, counts.length - 1)
}

function chunkIndexForCurrentPosition() {
  const chunks = allReadableChunks.value
  if (!chunks.length) return 0

  if (isPdfBook.value) {
    return firstChunkForPage(pdfManifest.value, currentPdfPage.value)?.id ?? 0
  }

  // Preferred: the highlight span nearest the top of the viewport is the exact
  // sentence on screen, so "read from here" begins at the visible page — not a
  // proportional estimate that drifts toward where narration last was.
  const anchorY = 80
  if (import.meta.client && !_chunkEls.length) _buildChunkMap()
  if (import.meta.client && _chunkEls.length) {
    let best = -1
    let firstConnected = -1
    for (let i = 0; i < _chunkEls.length; i += 1) {
      const el = _chunkEls[i]
      if (!el?.isConnected) continue
      if (firstConnected === -1) firstConnected = i
      const top = el.getBoundingClientRect().top
      if (top <= anchorY + 4) best = i
      else break
    }
    if (best !== -1) return best
    if (firstConnected !== -1) return firstConnected
  }

  // Fallback: the first chunk of the section currently in view.
  const chapterIndex = Math.max(0, Math.min(currentChapterIdx.value, chapterList.value.length - 1))
  return Math.max(0, Math.min(chunks.length - 1, sectionStartChunk(chapterIndex)))
}

function requestReadCurrentPosition() {
  if (!book.value || !allReadableChunks.value.length) return
  const visiblePdfPage = isPdfRenderable.value
    ? pdfViewerRef.value?.getVisiblePage?.()
    : null
  const targetPage = visiblePdfPage || currentPdfPage.value
  const targetPdfChunk = isPdfBook.value
    ? firstChunkForPage(pdfManifest.value, targetPage)
    : null
  const targetChunkId = isPdfBook.value
    ? targetPdfChunk?.id
    : chunkIndexForCurrentPosition()
  if (targetChunkId === null || targetChunkId === undefined) return

  pendingReadFromHereWasPlaying.value = ttsStatus.value === 'playing'
  if (ttsStatus.value === 'playing') pauseTTS()
  pendingReadFromHerePage.value = targetPdfChunk?.page || targetPage
  pendingReadFromHereChunk.value = targetChunkId
  confirmReadFromHereOpen.value = true

  const targetText = allReadableChunks.value[targetChunkId]
  if (targetText) prewarmText(targetText)
}

async function playFromCurrentPosition() {
  if (!book.value || !allReadableChunks.value.length) return

  if (ttsBook.value?.id === book.value.id && ttsStatus.value === 'paused') {
    resumeTTS()
    return
  }

  if (ttsBook.value?.id === book.value.id && ttsStatus.value === 'playing') {
    pauseTTS()
    return
  }

  const visiblePdfPage = isPdfRenderable.value
    ? pdfViewerRef.value?.getVisiblePage?.()
    : null
  const targetPage = visiblePdfPage || currentPdfPage.value
  const targetPdfChunk = isPdfBook.value
    ? firstChunkForPage(pdfManifest.value, targetPage)
    : null
  const targetChunkId = isPdfBook.value
    ? targetPdfChunk?.id
    : chunkIndexForCurrentPosition()
  if (targetChunkId === null || targetChunkId === undefined) return

  pendingReadFromHereWasPlaying.value = false
  pendingReadFromHerePage.value = targetPdfChunk?.page || targetPage
  pendingReadFromHereChunk.value = targetChunkId

  const targetText = allReadableChunks.value[targetChunkId]
  if (targetText) prewarmText(targetText)

  await confirmReadFromHere()
}

function cancelReadFromHere() {
  confirmReadFromHereOpen.value = false
  // Resume if TTS was playing when the user opened the modal
  if (pendingReadFromHereWasPlaying.value && ttsBook.value?.id === book.value?.id) {
    resumeTTS()
  }
  pendingReadFromHereWasPlaying.value = false
}

async function confirmReadFromHere() {
  if (!book.value || !allReadableChunks.value.length) return
  confirmReadFromHereOpen.value = false
  pendingReadFromHereWasPlaying.value = false
  const targetPage = pendingReadFromHerePage.value

  // Move the reading marker back to the page being read from, so saved
  // progress reflects the new (earlier) position rather than where narration
  // previously was.
  if (isPdfBook.value) {
    currentPdfPage.value = targetPage
  } else {
    currentChapterIdx.value = sectionForChunk(pendingReadFromHereChunk.value)
  }

  await playTTS(book.value, {
    startChunkIdx: pendingReadFromHereChunk.value,
    ignoreSavedSession: true,
    chunks: isPdfBook.value ? allReadableChunks.value : undefined,
  })
  if (isPdfRenderable.value) {
    currentPdfPage.value = targetPage
    await nextTick()
    pdfViewerRef.value?.scrollToPage(targetPage, 'instant', 'start')
  }
  await saveReadingProgress(isPdfBook.value ? { pdfPage: targetPage } : undefined)
}

// Locate the sentence under a touch point for the mobile long-press menu.
// Builds the chunk map on demand (it's deferred to idle after load).
function resolveChunkAtPoint(x, y) {
  if (!import.meta.client || !allReadableChunks.value.length) return -1

  // PDF: resolve the page under the finger → that page's first readable chunk.
  if (isPdfBook.value) {
    const pageEl = document.elementFromPoint(x, y)?.closest?.('[data-page]')
    const page = Number(pageEl?.dataset?.page)
    if (Number.isNaN(page)) return -1
    const chunk = firstChunkForPage(pdfManifest.value, page)
    return chunk?.id ?? -1
  }

  if (!_chunkEls.length) _buildChunkMap()

  const spanAtPoint = () => {
    const range = document.caretRangeFromPoint?.(x, y)
    let node = range?.startContainer ?? document.elementFromPoint(x, y)
    if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement
    return { node, span: node?.closest?.('[data-tts-chunk]') }
  }

  let { node, span } = spanAtPoint()
  if (!span && node?.closest?.('[id^="ch-"]')) {
    // The touched section mounted after the last map build — rebuild and retry.
    _buildChunkMap()
    ;({ node, span } = spanAtPoint())
  }
  if (span) {
    const chunkIdx = Number(span.dataset.ttsChunk)
    if (!Number.isNaN(chunkIdx)) return chunkIdx
  }

  const section = node?.closest?.('[id^="ch-"]')
  const sectionIdx = Number(section?.id?.slice(3))
  if (!Number.isNaN(sectionIdx)) {
    return Math.min(allReadableChunks.value.length - 1, sectionStartChunk(sectionIdx))
  }
  return -1
}

function prewarmChunkAudio(chunkIdx) {
  const text = allReadableChunks.value[chunkIdx]
  if (text) prewarmText(text)
}

// Start narration at an exact chunk (mobile long-press "Read from here").
async function playFromChunk(chunkIdx) {
  if (!book.value || !allReadableChunks.value.length) return
  const target = Math.max(0, Math.min(allReadableChunks.value.length - 1, Number(chunkIdx) || 0))

  pendingReadFromHereWasPlaying.value = false
  // For a PDF, resolve the page that owns the pressed chunk so playback and the
  // saved reading marker land on the long-pressed page.
  pendingReadFromHerePage.value = isPdfBook.value
    ? (pageForChunk(pdfManifest.value, target) || currentPdfPage.value)
    : currentPdfPage.value
  pendingReadFromHereChunk.value = target
  await confirmReadFromHere()
}

function jumpToNarration() {
  if (!isCurrentBookNarrating.value) return
  if (isPdfRenderable.value) {
    pdfViewerRef.value?.scrollToChunk?.(activeTtsChunkIndex.value)
    return
  }
  _highlightChunk(ttsChunkIdx.value)
}

function observeChapters() {
  if (_observer) _observer.disconnect()
  if (isPdfBook.value) return

  // Track the latest ratio of EVERY section, not just the entries in one
  // callback batch — a batch only contains sections whose ratio crossed a
  // threshold, so picking the best entry could crown a barely-visible
  // neighbour while the truly dominant section (unchanged, ratio 1) was absent.
  const ratios = new Map()

  _observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const index = Number(entry.target.id?.slice(3))
      if (Number.isNaN(index)) continue
      ratios.set(index, entry.isIntersecting ? entry.intersectionRatio : 0)
    }

    let best = -1
    let bestRatio = 0
    for (const [index, ratio] of ratios) {
      if (ratio > bestRatio || (ratio === bestRatio && ratio > 0 && index < best)) {
        best = index
        bestRatio = ratio
      }
    }

    if (best >= 0 && bestRatio > 0) currentChapterIdx.value = best
  }, { threshold: [0.1, 0.3, 0.5, 0.7] })

  chapterList.value.forEach((_, i) => {
    const el = document.getElementById(`ch-${i}`)
    if (el) _observer.observe(el)
  })
}

const zoomIn = async () => {
  if (zoomLevel.value >= MAX_ZOOM) return
  zoomLevel.value = Math.round((zoomLevel.value + 0.1) * 10) / 10
  updateSettings({ readerZoom: zoomLevel.value })
  await nextTick()
  updateBookEdge()
}

const zoomOut = async () => {
  if (zoomLevel.value <= MIN_ZOOM) return
  zoomLevel.value = Math.round((zoomLevel.value - 0.1) * 10) / 10
  updateSettings({ readerZoom: zoomLevel.value })
  await nextTick()
  updateBookEdge()
}

const toggleTheme = () => {
  readerTheme.value = readerTheme.value === 'light' ? 'dark' : 'light'
  updateSettings({ readerTheme: readerTheme.value })
}

function onKeydown(event) {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return
  if (event.key === 'Escape') {
    if (confirmReadFromHereOpen.value) {
      cancelReadFromHere()
      return
    }
    tocOpen.value = false
  }
}

// Memoized: the template calls this for EVERY mounted section on EVERY
// re-render, and each progressive section mount re-renders the list — without
// the cache that re-parsed the entire mounted book through the sanitizer's
// DOM round-trip on every single mount (the mid-scroll freeze on mobile).
let _sanitizeCache = new Map()

function sanitizeHtml(html) {
  let clean = _sanitizeCache.get(html)
  if (clean === undefined) {
    clean = sanitizeBookHtml(html)
    _sanitizeCache.set(html, clean)
  }
  return clean
}

let _observer = null
let _chunkEls = []
let _activeEl = null
let _ttsWordHighlight = null
let _activeWordMap = null
let _activeWordMapIdx = -1

function clearHtmlHighlight() {
  if (_activeEl) {
    _activeEl.classList.remove('tts-active')
    _activeEl = null
  }
}

let _chunkMapIdleId = null
let _chunkMapTimerId = null

function _cancelScheduledChunkMapBuild() {
  if (_chunkMapIdleId !== null && typeof cancelIdleCallback === 'function') {
    cancelIdleCallback(_chunkMapIdleId)
  }
  if (_chunkMapTimerId !== null) clearTimeout(_chunkMapTimerId)
  _chunkMapIdleId = null
  _chunkMapTimerId = null
}

// Wrapping every sentence of the whole book in highlight spans walks the
// entire DOM — doing it synchronously blocked first paint on mobile. Defer it
// to idle time; anything that needs the map earlier builds it on demand.
function _scheduleChunkMapBuild() {
  if (!import.meta.client) return
  _cancelScheduledChunkMapBuild()
  if (typeof requestIdleCallback === 'function') {
    _chunkMapIdleId = requestIdleCallback(() => {
      _chunkMapIdleId = null
      _buildChunkMap()
    }, { timeout: 2000 })
  } else {
    _chunkMapTimerId = setTimeout(() => {
      _chunkMapTimerId = null
      _buildChunkMap()
    }, 300)
  }
}

function _buildChunkMap() {
  _cancelScheduledChunkMapBuild()
  const container = chaptersContainerRef.value
  if (!container || !rawContent.value || isPdfBook.value) return

  clearHtmlHighlight()
  unwrapTtsSpans(container)
  _chunkEls = []
  _activeWordMapIdx = -1

  const { chunks, sectionCounts } = readableChunkData.value
  let offset = 0
  for (let s = 0; s < sectionCounts.length; s++) {
    const count = sectionCounts[s] || 0
    if (count > 0) {
      const sectionEl = document.getElementById(`ch-${s}`)
      if (sectionEl) {
        mapSectionChunks(sectionEl, chunks.slice(offset, offset + count), offset, (chunkIdx, span) => {
          _chunkEls[chunkIdx] = span
        })
      }
    }
    offset += count
  }
}

function _isNearViewport(el) {
  if (!el?.isConnected) return false
  const margin = window.innerHeight * 1.5
  const rect = el.getBoundingClientRect()
  return rect.bottom > -margin && rect.top < window.innerHeight + margin
}

function _highlightChunk(index) {
  const previousEl = _activeEl
  clearHtmlHighlight()
  if (isPdfBook.value || index < 0) return

  let el = _chunkEls[index]
  if (!el) {
    _buildChunkMap()
    el = _chunkEls[index]
  }
  if (!el) return

  // Only paint the highlight band when the preference is on; still scroll so
  // "Jump to narration" works with highlighting disabled.
  if (highlightEnabled.value) {
    el.classList.add('tts-active')
    _activeEl = el
  }

  // Follow narration only while the reader is near it. If the user scrolled
  // away, don't yank the viewport back — they can use "Jump to narration".
  const shouldFollow = !previousEl || _isNearViewport(previousEl) || _isNearViewport(el)
  if (shouldFollow) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function _ensureWordHighlight() {
  if (!import.meta.client || typeof Highlight === 'undefined' || !CSS?.highlights) return null
  if (!_ttsWordHighlight) {
    _ttsWordHighlight = new Highlight()
    CSS.highlights.set('tts-word', _ttsWordHighlight)
  }
  return _ttsWordHighlight
}

function _updateEpubWordHighlight() {
  const highlight = _ensureWordHighlight()
  if (!highlight) return
  highlight.clear()
  if (isPdfBook.value) return

  const chunkIdx = activeTtsChunkIndex.value
  const range = activeWordRange.value
  if (chunkIdx < 0 || !range) return

  const el = _chunkEls[chunkIdx]
  if (!el?.isConnected) return

  if (_activeWordMapIdx !== chunkIdx || !_activeWordMap) {
    _activeWordMap = buildTextIndex(el)
    _activeWordMapIdx = chunkIdx
  }

  const map = _activeWordMap.map
  const startPt = resolveRangePoint(map, range.start, 1)
  const endPt = resolveRangePoint(map, range.end - 1, -1)
  if (!startPt || !endPt) return

  try {
    const domRange = document.createRange()
    domRange.setStart(startPt.node, startPt.offset)
    domRange.setEnd(endPt.node, Math.min(endPt.node.nodeValue.length, endPt.offset + 1))
    highlight.add(domRange)
  } catch {
    // Detached or overlapping range — leave only the sentence band.
  }
}

async function ensurePdfToc(bookId) {
  if (!isPdfBook.value || !pdfSource.value || tocItems.value?.length || pdfTocChecked.value) return

  tocLoading.value = true
  try {
    const sourceBytes = await pdfSourceToBytes(toRaw(pdfSource.value))
    const extractedItems = await extractPdfTocFromSource(sourceBytes)
    tocItems.value = extractedItems
    pdfTocChecked.value = true

    await saveBookContent(bookId, {
      content: rawContent.value || null,
      pages: totalPages.value || book.value?.pages || 0,
      tocTitles: tocTitles.value,
      tocItems: extractedItems,
      format: bookFormat.value,
      pdfTocChecked: true,
      pdfManifest: pdfManifest.value,
    })
  } catch (error) {
    console.error('[Reader] Failed to extract PDF table of contents:', error)
    pdfTocChecked.value = true
  } finally {
    tocLoading.value = false
  }
}

function readingProgressSnapshot({ pdfPage } = {}) {
  let progress = 0
  let status = 'Unread'

  if (isPdfRenderable.value && totalPages.value > 0) {
    const pdfProgress = pdfProgressForPage(pdfPage ?? currentPdfPage.value, totalPages.value)
    progress = pdfProgress.progress
    status = pdfProgress.status
  } else if (!isPdfBook.value && chapterList.value.length > 0) {
    const idx = Math.max(0, currentChapterIdx.value)
    progress = chapterList.value.length > 1
      ? Math.round((idx / (chapterList.value.length - 1)) * 100)
      : 100
    status = progress > 95 ? 'Read' : idx > 0 ? 'Reading' : 'Unread'
  }

  return {
    progress: Math.max(0, Math.min(100, progress)),
    status,
  }
}

let _progressSaveTimer = null

async function saveReadingProgress(position) {
  if (!readerReady.value || !book.value) return
  const next = readingProgressSnapshot(position)
  if (next.progress === (book.value.progress || 0) && next.status === (book.value.status || 'Unread')) return

  // Stamp when the book was actually read so "Currently Reading" can order by
  // real reading activity, not by unrelated edits that bump updatedAt.
  const updated = { ...book.value, ...next, lastReadAt: new Date().toISOString() }
  book.value = updated
  try {
    await updateBook(updated)
  } catch (err) {
    console.error('[Reader] Failed to save reading progress:', err)
  }
}

function queueProgressSave() {
  if (!readerReady.value) return
  if (_progressSaveTimer) clearTimeout(_progressSaveTimer)
  _progressSaveTimer = setTimeout(() => {
    _progressSaveTimer = null
    saveReadingProgress()
  }, 450)
}

function updateBookEdge() {
  if (!import.meta.client) return

  const target = document.querySelector(
    '.pdf-page-wrap, .pdf-unavailable-card, .chapter-section'
  )
  const topbar = document.querySelector('.reader-topbar')

  const rect = target?.getBoundingClientRect()
  const sidebarWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 250
  const contentLeft = Math.max(0, topbar?.getBoundingClientRect()?.left ?? sidebarWidth)
  const bookLeft = Math.max(contentLeft, rect?.left ?? contentLeft)
  const preferredWidth = window.innerWidth <= 768
    ? Math.min(window.innerWidth * 0.82, 300)
    : 300
  const availableMargin = Math.max(0, bookLeft - contentLeft)
  const availableContentWidth = Math.max(0, window.innerWidth - contentLeft)
  const tocWidth = availableMargin > 0
    ? availableMargin
    : Math.min(preferredWidth, availableContentWidth)
  const tocLeft = contentLeft

  readerPageRef.value?.style.setProperty('--book-left', `${bookLeft}px`)
  readerPageRef.value?.style.setProperty('--reader-content-left', `${contentLeft}px`)
  readerPageRef.value?.style.setProperty('--toc-width', `${tocWidth}px`)
  readerPageRef.value?.style.setProperty('--toc-left', `${tocLeft}px`)
  readerPageRef.value?.style.setProperty('--toc-backdrop-left', `${tocLeft + tocWidth}px`)
}

let _scrollRaf = null

function updateCurrentChapterFromScroll() {
  if (isPdfBook.value || !chapterList.value.length || !import.meta.client) return

  // O(1) hit-test at the reading anchor line instead of measuring every
  // section each frame. Reading a book with dozens of chapters used to call
  // getBoundingClientRect on all of them per scroll frame — the layout thrash
  // is what froze the chapter pill and the whole reader while scrolling.
  const anchorEl = document.elementFromPoint(Math.round(window.innerWidth / 2), 80)
  const section = anchorEl?.closest?.('[id^="ch-"]')
  const index = Number(section?.id?.slice(3))
  if (!Number.isNaN(index) && index !== currentChapterIdx.value) {
    currentChapterIdx.value = index
  }
}

function onReaderScroll() {
  if (_scrollRaf !== null) return
  _scrollRaf = requestAnimationFrame(() => {
    _scrollRaf = null
    updateCurrentChapterFromScroll()
  })
}

function handlePdfPageChange(page) {
  currentPdfPage.value = page
}

function handlePdfLoaded(payload) {
  totalPages.value = payload.pages || totalPages.value || book.value?.pages || 0
  updateBookEdge()

  if (!restoredInitialPdfScroll.value && book.value?.progress > 0 && totalPages.value > 0) {
    restoredInitialPdfScroll.value = true
    const targetPage = Math.max(1, Math.min(
      totalPages.value,
      Math.round((book.value.progress / 100) * Math.max(1, totalPages.value - 1)) + 1
    ))
    currentPdfPage.value = targetPage
    nextTick(() => pdfViewerRef.value?.scrollToPage(targetPage, 'instant'))
  }

  readerReady.value = true
}

function applyStoredReaderContent(stored) {
  if (!stored) return false

  rawContent.value = stored.content ?? ''
  tocTitles.value = stored.tocTitles ?? []
  tocItems.value = stored.tocItems ?? []
  pdfTocChecked.value = !!stored.pdfTocChecked
  pdfSource.value = stored.source ?? null
  pdfManifest.value = stored.pdfManifest ?? null
  totalPages.value = stored.pages || book.value?.pages || 0
  book.value = { ...book.value, content: stored.content ?? '', tocTitles: stored.tocTitles ?? [] }
  // Seed the mobile mounting window before the DOM renders so the first paint
  // only parses the sections around the reading position.
  initializeSectionMounting()
  return true
}

async function loadBook(id) {
  readerReady.value = false
  restoredInitialPdfScroll.value = false
  _sanitizeCache = new Map()
  const cached = books.value.find(b => String(b.id) === String(id))
  if (cached) {
    book.value = cached
    loading.value = false
  } else {
    if (!initialized.value) await fetchAllData()
    const meta = fetchBookById(id)
    if (!meta) {
      loading.value = false
      return
    }
    book.value = meta
    loading.value = false
  }

  if (!initialized.value) {
    fetchAllData().then(() => {
      const latest = fetchBookById(id)
      if (latest) book.value = { ...book.value, ...latest }
    })
  }

  const prewarmed = getPrewarmedReaderContent(id)
  const prewarmedContent = prewarmed?.content ?? null
  const appliedPrewarmedContent = applyStoredReaderContent(prewarmedContent)

  contentLoading.value = !appliedPrewarmedContent
  try {
    // Reuse the prewarm result (or its in-flight promise) instead of issuing
    // a second IndexedDB read — on mobile that duplicate read is what made
    // opening a book feel slow.
    let stored = appliedPrewarmedContent ? prewarmedContent : null
    if (!stored && prewarmed?.promise) stored = await prewarmed.promise
    if (!stored && !appliedPrewarmedContent) stored = await getBookContent(id)
    if (stored) {
      if (!appliedPrewarmedContent) applyStoredReaderContent(stored)

      if (
        bookFormat.value === 'pdf'
        && stored.source
        && stored.pdfManifest?.version !== PDF_MANIFEST_VERSION
      ) {
        try {
          const rebuilt = await extractPdfContentFromSource(stored.source)
          if (rebuilt.pdfManifest) {
            rawContent.value = rebuilt.content || rawContent.value
            totalPages.value = rebuilt.pages || totalPages.value
            pdfManifest.value = rebuilt.pdfManifest
            book.value = { ...book.value, content: rebuilt.content || rawContent.value }
            await saveBookContent(id, {
              content: rebuilt.content,
              pages: totalPages.value,
              tocTitles: tocTitles.value,
              tocItems: tocItems.value,
              format: bookFormat.value,
              pdfTocChecked: pdfTocChecked.value,
              pdfTextMapVersion: 2,
              pdfManifest: rebuilt.pdfManifest,
            })
          }
        } catch (error) {
          console.warn('[Reader] Could not rebuild the PDF page map.', error)
        }
      }
    }
  } catch (error) {
    console.error('[Reader] Failed to load content from IndexedDB:', error)
  } finally {
    contentLoading.value = false
  }

  await nextTick()
  await nextTick()
  _scheduleChunkMapBuild()
  observeChapters()
  updateBookEdge()
  ensurePdfToc(id)

  if (!isPdfBook.value && chapterList.value.length > 0
    && (book.value?.progress > 0 || isCurrentBookNarrating.value)) {
    // Same formula as the mounting window seed, so the target is mounted.
    const safeIndex = initialSectionIndex()
    currentChapterIdx.value = safeIndex
    const el = document.getElementById(`ch-${safeIndex}`)
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' })

    // Refine to the exact sentence once the highlight spans exist.
    if (isCurrentBookNarrating.value) {
      setTimeout(() => {
        if (isCurrentBookNarrating.value) jumpToNarration()
      }, 400)
    }
  }

  if (!isPdfRenderable.value) {
    readerReady.value = true
    updateCurrentChapterFromScroll()
  }
}

watch(rawContent, async () => {
  await nextTick()
  await nextTick()
  _scheduleChunkMapBuild()
  observeChapters()
  updateBookEdge()
})

watch(activeTtsChunkIndex, async (index) => {
  if (isPdfBook.value) return
  if (index < 0) {
    clearHtmlHighlight()
    return
  }
  // Narration may have moved into a chapter that hasn't been mounted yet
  // (progressive rendering). Mount it, wait for the DOM, rebuild the chunk
  // spans, then highlight — otherwise the highlight lands on nothing.
  const section = sectionForChunk(index)
  if (!mountedSections.value[section]) {
    mountSection(section)
    await nextTick()
    await nextTick()
    _buildChunkMap()
  } else if (!_chunkEls[index]) {
    _buildChunkMap()
  }
  _highlightChunk(index)
})

watch([activeTtsChunkIndex, ttsWordIdx], () => {
  if (!isPdfBook.value) _updateEpubWordHighlight()
})

watch([currentPdfPage, currentChapterIdx], queueProgressSave)

watch(tocOpen, async (open) => {
  if (open) {
    updateBookEdge()
    await nextTick()
    const nav = tocNavRef.value
    if (!nav) return
    const activeEl = nav.querySelector('.toc-item.active')
    if (activeEl) activeEl.scrollIntoView({ block: 'center', behavior: 'instant' })
  }
})

watch(isPdfRenderable, async () => {
  await nextTick()
  updateBookEdge()
})

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', updateBookEdge)
  window.addEventListener('scroll', onReaderScroll, { passive: true })
  _viewportQuery = window.matchMedia('(max-width: 768px)')
  _syncViewport()
  _viewportQuery.addEventListener('change', _syncViewport)
  await loadBook(route.params.id)
})

onUnmounted(async () => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', updateBookEdge)
  window.removeEventListener('scroll', onReaderScroll)
  _viewportQuery?.removeEventListener('change', _syncViewport)
  _viewportQuery = null
  if (_scrollRaf !== null) cancelAnimationFrame(_scrollRaf)
  if (_progressSaveTimer) clearTimeout(_progressSaveTimer)
  if (_observer) _observer.disconnect()
  _cancelScheduledChunkMapBuild()
  _cancelIdleSectionMounting()

  if (import.meta.client && CSS?.highlights) CSS.highlights.delete('tts-word')
  _ttsWordHighlight = null

  if (!book.value) return
  await saveReadingProgress()
})
</script>

<style scoped>
.reader-page.light {
  --bg: var(--color-reader-light-background);
  --page-bg: var(--color-reader-light-page);
  --page-shadow: var(--shadow-reader-page);
  --topbar-bg: var(--color-reader-light-toolbar);
  --topbar-border: var(--color-reader-light-border);
  --text: var(--color-reader-light-text);
  --muted: var(--color-reader-light-muted);
  --border: var(--color-border-subtle);
  --btn-hover: var(--color-reader-light-button-hover);
  --sidebar-bg: var(--color-reader-light-toolbar);
  --toc-active: var(--color-reader-light-toc-active);
  --toc-color: var(--color-brand-primary);
}

.reader-page.dark {
  --bg: var(--color-reader-dark-background);
  --page-bg: var(--color-reader-dark-page);
  --page-shadow: var(--shadow-reader-page);
  --topbar-bg: var(--color-reader-dark-toolbar);
  --topbar-border: var(--color-reader-dark-border);
  --text: var(--color-reader-dark-text);
  --muted: var(--color-reader-dark-muted);
  --border: var(--color-reader-dark-border);
  --btn-hover: var(--color-reader-dark-button-hover);
  --sidebar-bg: var(--color-reader-dark-toolbar);
  --toc-active: var(--color-reader-dark-toc-active);
  --toc-color: var(--color-brand-primary);
}

.reader-page {
  --book-left: var(--sidebar-width, 250px);
  --reader-content-left: var(--sidebar-width, 250px);
  --toc-width: 300px;
  --toc-left: 0px;
  --toc-backdrop-left: var(--book-left);
  --reader-page-height: 920px;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  position: relative;
  transition: background 0.2s, color 0.2s;
}

.reader-topbar {
  position: fixed;
  top: 0;
  left: var(--sidebar-width, 250px);
  right: 0;
  z-index: 200;
  height: 48px;
  background: var(--topbar-bg);
  border-bottom: 1px solid var(--topbar-border);
  box-shadow: var(--shadow-card-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.75rem;
  gap: 0.5rem;
}

.tb-section {
  display: flex;
  align-items: center;
  flex: 1;
}

.tb-left { justify-content: flex-start; gap: 0.15rem; }
.tb-center { justify-content: center; flex: 0 1 auto; min-width: 0; overflow: hidden; padding: 0 0.5rem; }
.tb-right { justify-content: flex-end; gap: 0.25rem; }

.tb-btn {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 1rem;
  flex-shrink: 0;
  transition: background 0.12s, color 0.12s;
}

.tb-btn:hover:not(:disabled) {
  background: var(--btn-hover);
  color: var(--text);
}

.tb-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.tb-sep {
  width: 1px;
  height: 18px;
  background: var(--border);
  margin: 0 0.2rem;
  flex-shrink: 0;
}

.tb-size {
  font-size: 0.72rem;
  color: var(--muted);
  min-width: 34px;
  text-align: center;
  user-select: none;
}

.chapter-counter {
  font-size: 0.78rem;
  color: var(--muted);
  overflow: hidden;
  display: flex;
  align-items: center;
  max-width: 100%;
}

.ch-num {
  font-weight: 600;
  color: var(--text);
  flex-shrink: 0;
}

.ch-sep { flex-shrink: 0; }
.ch-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }

.toc-backdrop {
  display: none;
  position: fixed;
  top: 48px;
  left: var(--toc-backdrop-left);
  right: 0;
  bottom: 0;
  background: transparent;
  z-index: 298;
}

.toc-backdrop.visible {
  display: block;
}

.toc-sidebar {
  position: fixed;
  top: 48px;
  left: var(--toc-left);
  height: calc(100vh - 48px - 90px);
  width: var(--toc-width);
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border);
  z-index: 299;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: translateX(calc(-100% - 1px));
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    transform 0.24s ease,
    opacity 0.16s ease,
    visibility 0s linear 0.24s;
  box-shadow: var(--shadow-card-raised);
}

.toc-sidebar.open {
  transform: translateX(0);
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transition:
    transform 0.24s ease,
    opacity 0.16s ease;
}

.toc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  gap: 0.5rem;
}

.toc-head-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.toc-head-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text);
  line-height: 1.2;
}

.toc-head-book {
  font-size: 0.7rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 0.1rem;
}

.toc-nav {
  flex: 1;
  overflow-y: auto;
  padding: 0.4rem 0;
}

.toc-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  border-left: 2px solid transparent;
  color: var(--text);
  cursor: pointer;
  padding: 0.48rem 0.75rem 0.48rem 0.875rem;
  font-size: 0.8rem;
  line-height: 1.45;
  transition: background 0.1s, border-color 0.1s;
}

.toc-item:hover {
  background: var(--btn-hover);
  border-left-color: var(--border);
}

.toc-item.active {
  background: var(--toc-active);
  color: var(--toc-color);
  font-weight: 500;
  border-left-color: var(--toc-color);
}

.toc-indicator {
  display: none;
}

.toc-num {
  font-size: 0.68rem;
  color: var(--muted);
  min-width: 20px;
  flex-shrink: 0;
  margin-top: 0.15rem;
  text-align: right;
}

.toc-item.active .toc-num {
  color: var(--toc-color);
}

.toc-title {
  min-width: 0;
  flex: 1;
}

.toc-empty {
  padding: 1rem;
  color: var(--muted);
  font-size: 0.82rem;
  line-height: 1.5;
}

.toc-skeleton {
  padding: 1rem;
}

.reader-body {
  padding: calc(48px + 2rem) 1rem 4rem;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.chapters-container {
  width: 100%;
  max-width: 760px;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.chapter-section {
  width: 100%;
  min-height: var(--reader-page-height);
  background: var(--page-bg);
  box-shadow: var(--page-shadow);
  border-radius: 3px;
  transform-origin: top center;
}

.cover-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3.5rem 2.5rem;
  gap: 2.25rem;
}

.cover-artwork {
  box-shadow: var(--shadow-cover);
  border-radius: 3px;
  overflow: hidden;
  max-width: 300px;
}

.cover-img {
  width: 100%;
  height: auto;
  display: block;
}

.cover-meta {
  text-align: center;
}

.cover-title {
  font-family: Georgia, serif;
  font-size: 1.9rem;
  color: var(--text);
  margin: 0 0 0.5rem;
  line-height: 1.2;
}

.cover-author {
  font-size: 1rem;
  color: var(--muted);
  margin: 0;
}

.chapter-section article.chapter-content {
  padding: 3.5rem 4rem;
  line-height: 1.9;
  color: var(--text);
  word-break: break-word;
}

.chapter-content :deep(b),
.chapter-content :deep(strong),
.chapter-content :deep(h1),
.chapter-content :deep(h2),
.chapter-content :deep(h3),
.chapter-content :deep(h4),
.chapter-content :deep(h5),
.chapter-content :deep(h6),
.chapter-content :deep(th) {
  font-weight: bold !important;
}

.chapter-content :deep(.tts-active) {
  background: var(--color-reader-highlight);
  border-radius: 3px;
  outline: 1.5px solid var(--color-reader-highlight-border);
  outline-offset: 1px;
  transition: background 0.2s;
}

.chapter-content :deep(img) { max-width: 100%; height: auto; border-radius: 4px; margin: 1.5rem auto; display: block; }
.chapter-content :deep(figure) { margin: 2rem auto; text-align: center; }
.chapter-content :deep(figcaption) { font-size: 0.85rem; color: var(--muted); font-style: italic; margin-top: 0.4rem; }
.chapter-content :deep(table) { border-collapse: collapse; width: 100%; margin: 1.5rem 0; font-size: 0.9em; }
.chapter-content :deep(th),
.chapter-content :deep(td) { border: 1px solid var(--border); padding: 0.4rem 0.75rem; text-align: left; vertical-align: top; }
.chapter-content :deep(ul),
.chapter-content :deep(ol) { margin: 0 0 1.5em; padding-left: 2em; }
.chapter-content :deep(hr) { border: none; border-top: 1px solid var(--border); margin: 2.5rem auto; width: 40%; }
.chapter-content :deep(pre) { background: var(--btn-hover); border-radius: 6px; padding: 1rem 1.25rem; overflow-x: auto; font-size: 0.875em; margin: 1.5rem 0; }
.chapter-content :deep(code) { font-family: 'Courier New', monospace; font-size: 0.875em; background: var(--btn-hover); border-radius: 3px; padding: 0.1em 0.3em; }
.chapter-content :deep(pre code) { background: none; padding: 0; }
.chapter-content :deep(svg) { max-width: 100%; height: auto; display: block; margin: 1.5rem auto; }
.chapter-content :deep(.epub-content) { margin: 0; padding: 0; }

.read-confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: var(--color-background-overlay-faint);
  backdrop-filter: blur(6px);
}

.read-confirm-modal {
  width: min(420px, 100%);
  background: var(--page-bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--shadow-modal);
  padding: 1.25rem;
}

.read-confirm-modal h2 {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
  font-weight: 650;
  line-height: 1.25;
}

.read-confirm-modal p {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.read-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 1.25rem;
}

.read-confirm-btn {
  min-height: 36px;
  border-radius: 7px;
  border: 1px solid var(--border);
  padding: 0 0.95rem;
  font-size: 0.86rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.read-confirm-btn.secondary {
  background: transparent;
  color: var(--muted);
}

.read-confirm-btn.secondary:hover {
  background: var(--btn-hover);
  color: var(--text);
}

.read-confirm-btn.primary {
  background: var(--color-brand-primary);
  border-color: var(--color-brand-primary);
  color: var(--color-text-on-brand);
}

.read-confirm-btn.primary:hover {
  background: var(--color-brand-primary-hover);
  border-color: var(--color-brand-primary-hover);
}

.pdf-unavailable-card {
  width: min(100%, 760px);
  min-height: 360px;
  background: var(--page-bg);
  border-radius: 3px;
  box-shadow: var(--page-shadow);
  color: var(--muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 4rem 2rem;
  text-align: center;
}

.pdf-unavailable-card i {
  font-size: 3rem;
}

.pdf-unavailable-card p {
  margin: 0;
}

.empty-notice {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 360px;
  padding: 4rem 2rem;
  text-align: center;
  color: var(--muted);
  gap: 0.75rem;
  background: var(--page-bg);
  border-radius: 3px;
  box-shadow: var(--page-shadow);
}

.empty-notice i {
  font-size: 3rem;
}

.hint {
  font-size: 0.85rem;
  opacity: 0.7;
  margin: 0;
}

.state-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: calc(100vh - 96px);
  gap: 1rem;
  color: var(--muted);
}

.state-error i {
  font-size: 3rem;
  color: var(--color-status-danger-bright);
}

.btn-primary {
  background: var(--color-brand-primary);
  color: var(--color-text-on-brand);
  border: none;
  padding: 0.6rem 1.25rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background 0.15s;
}

.btn-primary:hover {
  background: var(--color-brand-primary-hover);
}

@media (max-width: 768px) {
  .tb-size {
    display: none;
  }

  .reader-body {
    padding: calc(48px + 1rem) 0.5rem 3rem;
  }

  .cover-section {
    padding: 2rem 1.25rem;
  }

  .chapter-section article.chapter-content {
    padding: 2rem 1.25rem;
  }
}
</style>
