<template>
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
          <i class="ri-speak-line"></i>
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
          :text-content="rawContent"
          :active-chunk-index="activeTtsChunkIndex"
          :active-chunk-text="activeTtsChunkText"
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

<script setup>
definePageMeta({ layout: 'reader' })

import { computed, nextTick, onMounted, onUnmounted, ref, toRaw, watch } from 'vue'
import { useBooks } from '~/composables/useBooks'
import { isRenderableSection, buildReadableChunks, useTTS } from '~/composables/useTTS'
import { useBookStorage } from '~/composables/useBookStorage'
import { useBookishSettings } from '~/composables/useBookishSettings'
import { extractPdfTocFromSource, pdfSourceToBytes } from '~/composables/usePdfExtractor'

const route = useRoute()
const router = useRouter()
const { books, fetchBookById, updateBook } = useBooks()
const { getBookContent, saveBookContent } = useBookStorage()
const { settings, updateSettings } = useBookishSettings()
const { ttsBook, ttsChunkIdx, ttsCurrentChunk, ttsStatus, play: playTTS, pause: pauseTTS, resume: resumeTTS } = useTTS()

const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.5

const readerPageRef = ref(null)
const chaptersContainerRef = ref(null)
const pdfViewerRef = ref(null)
const tocNavRef = ref(null)

const book = ref(null)
const loading = ref(true)
const contentLoading = ref(false)
const rawContent = ref('')
const tocTitles = ref([])
const tocItems = ref([])
const pdfTocChecked = ref(false)
const tocLoading = ref(false)
const pdfSource = ref(null)

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

useHead(() => ({
  style: epubStyle.value
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

const pdfTocItems = computed(() => {
  if (!isPdfBook.value) return []
  return tocItems.value || []
})

const displayTocItems = computed(() => {
  if (isPdfBook.value) {
    return (pdfTocItems.value || [])
      .filter(item => item?.title && item?.page)
      .map(item => ({ ...item, type: 'pdf' }))
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

const activeTtsChunkIndex = computed(() => {
  if (ttsBook.value?.id !== book.value?.id || ttsStatus.value === 'idle') return -1
  return ttsChunkIdx.value
})

const activeTtsChunkText = computed(() => {
  if (ttsBook.value?.id !== book.value?.id || ttsStatus.value === 'idle') return ''
  return ttsCurrentChunk.value || ''
})

const isCurrentBookNarrating = computed(() => (
  ttsBook.value?.id === book.value?.id && ttsStatus.value !== 'idle'
))

// Canonical chunk data: the flat chunk list (TTS playback order) plus the
// per-section chunk counts. Built section-by-section so indices line up with
// the reader's `ch-N` sections, the highlight spans, and the chapter splits.
const readableChunkData = computed(() => buildReadableChunks(rawContent.value || ''))

const sectionChunkCounts = computed(() => readableChunkData.value.sectionCounts)

const allReadableChunks = computed(() => readableChunkData.value.chunks)

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
    scrollToChapter(item.index)
  }
  tocOpen.value = false
}

function scrollToChapter(index) {
  const el = document.getElementById(`ch-${index}`)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// First flat chunk index of section `sectionIndex`, from the per-section counts.
function sectionStartChunk(sectionIndex) {
  const counts = sectionChunkCounts.value
  let offset = 0
  for (let i = 0; i < sectionIndex && i < counts.length; i += 1) offset += counts[i] || 0
  return offset
}

// Which section (ch-N) a flat chunk index falls in.
function sectionForChunk(chunkIndex) {
  const counts = sectionChunkCounts.value
  let offset = 0
  for (let i = 0; i < counts.length; i += 1) {
    offset += counts[i] || 0
    if (chunkIndex < offset) return i
  }
  return Math.max(0, counts.length - 1)
}

function chunkIndexForCurrentPosition() {
  const chunks = allReadableChunks.value
  if (!chunks.length) return 0

  if (isPdfBook.value) {
    const pages = totalPages.value || book.value?.pages || 1
    const pageProgress = pages > 1 ? (currentPdfPage.value - 1) / (pages - 1) : 0
    return Math.max(0, Math.min(chunks.length - 1, Math.floor(pageProgress * chunks.length)))
  }

  // Preferred: the highlight span nearest the top of the viewport is the exact
  // sentence on screen, so "read from here" begins at the visible page — not a
  // proportional estimate that drifts toward where narration last was.
  const anchorY = 80
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
  // Pause TTS so auto-scroll stops and the current viewport position is preserved
  pendingReadFromHereWasPlaying.value = ttsStatus.value === 'playing'
  if (ttsStatus.value === 'playing') pauseTTS()
  pendingReadFromHereChunk.value = chunkIndexForCurrentPosition()
  confirmReadFromHereOpen.value = true
}

function cancelReadFromHere() {
  confirmReadFromHereOpen.value = false
  // Resume if TTS was playing when the user opened the modal
  if (pendingReadFromHereWasPlaying.value && ttsBook.value?.id === book.value?.id) {
    resumeTTS()
  }
  pendingReadFromHereWasPlaying.value = false
}

function confirmReadFromHere() {
  if (!book.value || !allReadableChunks.value.length) return
  confirmReadFromHereOpen.value = false
  pendingReadFromHereWasPlaying.value = false

  // Move the reading marker back to the page being read from, so saved
  // progress reflects the new (earlier) position rather than where narration
  // previously was.
  if (!isPdfBook.value) {
    currentChapterIdx.value = sectionForChunk(pendingReadFromHereChunk.value)
  }

  playTTS(book.value, {
    startChunkIdx: pendingReadFromHereChunk.value,
    ignoreSavedSession: true,
  })
  saveReadingProgress()
}

function jumpToNarration() {
  if (!isCurrentBookNarrating.value) return
  if (isPdfRenderable.value) {
    pdfViewerRef.value?.scrollToActiveHighlight?.()
    return
  }
  _highlightChunk(ttsChunkIdx.value)
}

function observeChapters() {
  if (_observer) _observer.disconnect()
  if (isPdfBook.value) return

  _observer = new IntersectionObserver((entries) => {
    let best = null
    let bestRatio = 0

    for (const entry of entries) {
      if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
        best = entry.target
        bestRatio = entry.intersectionRatio
      }
    }

    if (!best?.id?.startsWith('ch-')) return
    const index = Number(best.id.slice(3))
    if (!Number.isNaN(index)) currentChapterIdx.value = index
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

function sanitizeHtml(html) {
  if (!html) return ''
  if (!import.meta.client) return html

  const div = document.createElement('div')
  div.innerHTML = html
  const blocked = ['script', 'iframe', 'object', 'embed', 'form', 'meta', 'link', 'base']
  blocked.forEach(tag => div.querySelectorAll(tag).forEach(el => el.remove()))
  div.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name)
      } else if (['href', 'src', 'action', 'formaction'].includes(attr.name)) {
        const value = attr.value.trim().toLowerCase().replace(/\s/g, '')
        if (value.startsWith('javascript:')) el.removeAttribute(attr.name)
      }
    })
  })
  return div.innerHTML
}

let _observer = null
let _chunkEls = []
let _activeEl = null

const normalizeForSearch = (value) => (value || '').replace(/\s+/g, ' ').trim()

function decodeHtmlEntities(text) {
  if (!import.meta.client || !text) return text || ''
  if (!text.includes('&')) return text
  const el = document.createElement('textarea')
  // Protect raw "<" so the parser can't swallow following text as a tag
  el.innerHTML = text.replace(/</g, '&lt;')
  return el.value
}

function unwrapTtsSpans(container) {
  container.querySelectorAll('span[data-tts-chunk]').forEach(span => {
    const parent = span.parentNode
    if (!parent) return
    while (span.firstChild) parent.insertBefore(span.firstChild, span)
    parent.removeChild(span)
    parent.normalize()
  })
}

function clearHtmlHighlight() {
  if (_activeEl) {
    _activeEl.classList.remove('tts-active')
    _activeEl = null
  }
}

function buildTextIndex(container) {
  const map = []
  let text = ''

  const appendSpace = (node, offset) => {
    if (!text || text.endsWith(' ')) return
    text += ' '
    map.push({ node, offset: Math.min(offset, node.nodeValue.length), synthetic: true })
  }

  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT
        if (node.parentElement?.closest('script, style')) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      },
    }
  )

  let node
  while ((node = walker.nextNode())) {
    const value = node.nodeValue
    for (let i = 0; i < value.length; i++) {
      const ch = value[i]
      const code = ch.charCodeAt(0)
      // Soft hyphens / zero-width chars are stripped from chunk targets too
      if (code === 0xAD || (code >= 0x200B && code <= 0x200D) || code === 0xFEFF) continue
      if (/\s/.test(ch)) {
        appendSpace(node, i)
      } else {
        text += ch
        map.push({ node, offset: i, synthetic: false })
      }
    }
    appendSpace(node, value.length)
  }

  return { text, map }
}

function resolveRangePoint(map, index, direction) {
  let cursor = index
  while (cursor >= 0 && cursor < map.length && map[cursor]?.synthetic) {
    cursor += direction
  }
  return map[cursor] || null
}

// Wrap every chunk of ONE section in a <span data-tts-chunk> for highlighting.
// Matching is scoped to the section element and chunks are matched in order,
// so an identical sentence elsewhere can't steal the match. The whole sentence
// is matched when possible (exact start AND end); otherwise a prefix locates
// the start and a suffix pins the end, so length drift between the chunk text
// and the rendered DOM never clips the first or last letters.
function _mapSectionChunks(sectionEl, chunks, baseIdx) {
  const { text, map } = buildTextIndex(sectionEl)
  if (!map.length) return
  const flatLower = text.toLowerCase()
  const ranges = []
  let searchFrom = 0

  for (let i = 0; i < chunks.length; i++) {
    const target = normalizeForSearch(decodeHtmlEntities(chunks[i])).toLowerCase()
    if (!target) continue

    let start = flatLower.indexOf(target, searchFrom)
    let end
    if (start !== -1) {
      // Exact whole-sentence match: both ends are real DOM positions.
      end = start + target.length - 1
    } else {
      const key = target.slice(0, Math.min(120, target.length))
      start = flatLower.indexOf(key, searchFrom)
      if (start === -1 && key.length > 48) start = flatLower.indexOf(key.slice(0, 48), searchFrom)
      if (start === -1) continue
      const suffix = target.slice(-Math.min(24, target.length))
      const suffixFrom = start + Math.max(0, target.length - suffix.length - 12)
      const suffixPos = flatLower.indexOf(suffix, suffixFrom)
      end = suffixPos !== -1 && suffixPos >= start
        ? suffixPos + suffix.length - 1
        : start + target.length - 1
    }
    end = Math.min(end, map.length - 1)
    ranges.push({ chunkIdx: baseIdx + i, start, end })
    searchFrom = end + 1
  }

  // Apply in reverse so wrapping earlier ranges doesn't invalidate later offsets.
  for (let i = ranges.length - 1; i >= 0; i--) {
    const info = ranges[i]
    const startPt = resolveRangePoint(map, info.start, 1)
    const endPt = resolveRangePoint(map, info.end, -1)
    if (!startPt || !endPt) continue

    const range = document.createRange()
    const endOffset = Math.min(endPt.node.nodeValue.length, endPt.offset + 1)
    try {
      range.setStart(startPt.node, startPt.offset)
      range.setEnd(endPt.node, endOffset)
      const span = document.createElement('span')
      span.dataset.ttsChunk = String(info.chunkIdx)
      span.appendChild(range.extractContents())
      range.insertNode(span)
      _chunkEls[info.chunkIdx] = span
    } catch {
      // Overlapping or detached range — skip this chunk's highlight.
    }
  }
}

function _buildChunkMap() {
  const container = chaptersContainerRef.value
  if (!container || !rawContent.value || isPdfBook.value) return

  clearHtmlHighlight()
  unwrapTtsSpans(container)
  _chunkEls = []

  const { chunks, sectionCounts } = readableChunkData.value
  let offset = 0
  for (let s = 0; s < sectionCounts.length; s++) {
    const count = sectionCounts[s] || 0
    if (count > 0) {
      const sectionEl = document.getElementById(`ch-${s}`)
      if (sectionEl) _mapSectionChunks(sectionEl, chunks.slice(offset, offset + count), offset)
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

  el.classList.add('tts-active')
  _activeEl = el

  // Follow narration only while the reader is near it. If the user scrolled
  // away, don't yank the viewport back — they can use "Jump to narration".
  const shouldFollow = !previousEl || _isNearViewport(previousEl) || _isNearViewport(el)
  if (shouldFollow) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
    })
  } catch (error) {
    console.error('[Reader] Failed to extract PDF table of contents:', error)
    pdfTocChecked.value = true
  } finally {
    tocLoading.value = false
  }
}

function readingProgressSnapshot() {
  let progress = 0
  let status = 'Unread'

  if (isPdfRenderable.value && totalPages.value > 0) {
    progress = totalPages.value > 1
      ? Math.round(((currentPdfPage.value - 1) / (totalPages.value - 1)) * 100)
      : 100
    status = progress > 95 ? 'Read' : currentPdfPage.value > 1 ? 'Reading' : 'Unread'
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

async function saveReadingProgress() {
  if (!readerReady.value || !book.value) return
  const next = readingProgressSnapshot()
  if (next.progress === (book.value.progress || 0) && next.status === (book.value.status || 'Unread')) return

  const updated = { ...book.value, ...next }
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
  if (isPdfBook.value || !chapterList.value.length) return

  const sections = chapterList.value
    .map((_, index) => document.getElementById(`ch-${index}`))
    .filter(Boolean)
  if (!sections.length) return

  const anchorY = 72
  let bestIndex = currentChapterIdx.value
  let bestDistance = Number.POSITIVE_INFINITY

  sections.forEach((section) => {
    const rect = section.getBoundingClientRect()
    const distance = rect.top <= anchorY
      ? Math.abs(anchorY - rect.top) * 0.5
      : Math.abs(rect.top - anchorY)
    const index = Number(section.id.slice(3))
    if (!Number.isNaN(index) && distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  })

  if (bestIndex !== currentChapterIdx.value) currentChapterIdx.value = bestIndex
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

async function loadBook(id) {
  readerReady.value = false
  restoredInitialPdfScroll.value = false
  const cached = books.value.find(b => b.id === id)
  if (cached) {
    book.value = cached
    loading.value = false
  } else {
    const meta = fetchBookById(id)
    if (!meta) {
      loading.value = false
      return
    }
    book.value = meta
    loading.value = false
  }

  contentLoading.value = true
  try {
    const stored = await getBookContent(id)
    if (stored) {
      rawContent.value = stored.content ?? ''
      tocTitles.value = stored.tocTitles ?? []
      tocItems.value = stored.tocItems ?? []
      pdfTocChecked.value = !!stored.pdfTocChecked
      pdfSource.value = stored.source ?? null
      totalPages.value = stored.pages || book.value?.pages || 0
      book.value = { ...book.value, content: stored.content ?? '', tocTitles: stored.tocTitles ?? [] }
    }
  } catch (error) {
    console.error('[Reader] Failed to load content from IndexedDB:', error)
  } finally {
    contentLoading.value = false
  }

  await nextTick()
  await nextTick()
  _buildChunkMap()
  observeChapters()
  updateBookEdge()
  await ensurePdfToc(id)

  if (!isPdfBook.value && book.value?.progress > 0 && chapterList.value.length > 0) {
    const targetIdx = Math.round((book.value.progress / 100) * (chapterList.value.length - 1))
    const safeIndex = Math.max(0, Math.min(targetIdx, chapterList.value.length - 1))
    currentChapterIdx.value = safeIndex
    const el = document.getElementById(`ch-${safeIndex}`)
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' })
  }

  if (!isPdfRenderable.value) {
    readerReady.value = true
    updateCurrentChapterFromScroll()
  }
}

watch(rawContent, async () => {
  await nextTick()
  await nextTick()
  _buildChunkMap()
  observeChapters()
  updateBookEdge()
})

watch(activeTtsChunkIndex, (index) => {
  if (isPdfBook.value) return
  if (index < 0) clearHtmlHighlight()
  else _highlightChunk(index)
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
  await loadBook(route.params.id)
})

onUnmounted(async () => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', updateBookEdge)
  window.removeEventListener('scroll', onReaderScroll)
  if (_scrollRaf !== null) cancelAnimationFrame(_scrollRaf)
  if (_progressSaveTimer) clearTimeout(_progressSaveTimer)
  if (_observer) _observer.disconnect()

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
