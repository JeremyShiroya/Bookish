<template>
  <div class="reader-page" :class="readerTheme">

    <!-- ── Fixed topbar ─────────────────────────────────────────────────── -->
    <header class="reader-topbar">

      <div class="tb-section tb-left">
        <!-- Back button FIRST on the left -->
        <button class="tb-btn" @click="router.back()" title="Back to Library">
          <i class="ri-arrow-left-line"></i>
        </button>
        <span class="tb-sep" />
        <button class="tb-btn" @click="tocOpen = !tocOpen" title="Table of Contents">
          <i class="ri-menu-2-line"></i>
        </button>
        <span class="tb-sep" />
        <button class="tb-btn" @click="zoomOut" :disabled="zoomLevel <= 0.7" title="Smaller text">
          <i class="ri-subtract-line"></i>
        </button>
        <span class="tb-size">{{ Math.round(zoomLevel * 100) }}%</span>
        <button class="tb-btn" @click="zoomIn" :disabled="zoomLevel >= 1.5" title="Larger text">
          <i class="ri-add-line"></i>
        </button>
      </div>

      <div class="tb-section tb-center">
        <span class="chapter-counter" v-if="book && chapterList.length">
          <template v-if="currentChapterIdx >= 0">
            <b class="ch-num">{{ currentChapterIdx + 1 }}&thinsp;/&thinsp;{{ chapterList.length }}</b>
            <span class="ch-sep" v-if="currentChapterTitle">&nbsp;·&nbsp;</span>
            <span class="ch-title">{{ currentChapterTitle }}</span>
          </template>
          <template v-else>Cover</template>
        </span>
      </div>

      <div class="tb-section tb-right">
        <select class="font-select" v-model="fontFamily" title="Font family">
          <option v-for="f in FONTS" :key="f.value" :value="f.value">{{ f.label }}</option>
        </select>
        <button class="tb-btn" @click="toggleTheme"
          :title="readerTheme === 'light' ? 'Dark mode' : 'Light mode'">
          <i :class="readerTheme === 'light' ? 'ri-moon-line' : 'ri-sun-line'"></i>
        </button>
      </div>

    </header>

    <!-- ── TOC (starts right after global sidebar, below topbar) ────────── -->
    <div class="toc-backdrop" :class="{ visible: tocOpen }" @click="tocOpen = false" />

    <aside class="toc-sidebar" :class="{ open: tocOpen }">
      <div class="toc-head">
        <span>Contents</span>
        <button class="tb-btn" @click="tocOpen = false"><i class="ri-close-line"></i></button>
      </div>

      <div class="toc-book-info" v-if="book">
        <div class="toc-cover-thumb" v-if="hasCover">
          <img :src="book.cover" :alt="book.title" />
        </div>
        <p class="toc-book-title">{{ book.title }}</p>
        <p class="toc-book-author">{{ book.author }}</p>
      </div>

      <nav class="toc-nav">
        <button
          v-if="hasCover"
          class="toc-item"
          :class="{ active: currentChapterIdx === -1 }"
          @click="scrollToCover(); tocOpen = false"
        >
          <i class="ri-image-2-line toc-icon"></i>
          Cover
        </button>

        <button
          v-for="(ch, i) in chapterList"
          :key="i"
          class="toc-item"
          :class="{ active: currentChapterIdx === i }"
          @click="scrollToChapter(i); tocOpen = false"
        >
          <span class="toc-num">{{ i + 1 }}</span>
          {{ ch.title }}
        </button>
      </nav>
    </aside>

    <!-- ── Reading area (continuous scroll) ─────────────────────────────── -->
    <div class="reader-body">

      <!-- Loading -->
      <div v-if="loading || contentLoading" class="state-center">
        <div class="loader-spinner"></div>
        <p>{{ loading ? 'Opening book…' : 'Loading content…' }}</p>
      </div>

      <!-- Not found -->
      <div v-else-if="!book" class="state-center state-error">
        <i class="ri-error-warning-line"></i>
        <h2>Book not found</h2>
        <button class="btn-primary" @click="router.back()">Return to Library</button>
      </div>

      <template v-else>
        <div class="chapters-container" ref="chaptersContainerRef">

          <!-- Cover section -->
          <section v-if="hasCover" id="ch-cover" class="chapter-section cover-section">
            <div class="cover-artwork">
              <img :src="book.cover" :alt="book.title + ' cover'" class="cover-img" />
            </div>
            <div class="cover-meta">
              <h1 class="cover-title">{{ book.title }}</h1>
              <p class="cover-author">by {{ book.author }}</p>
            </div>
          </section>

          <!-- All chapter sections rendered at once for continuous scroll -->
          <section
            v-for="(ch, i) in chapterList"
            :key="i"
            :id="'ch-' + i"
            class="chapter-section"
          >
            <article
              class="chapter-content epub-content"
              :style="{ zoom: zoomLevel, fontFamily }"
              v-html="sanitizeHtml(ch.html)"
            />
          </section>

          <!-- Empty state -->
          <div v-if="!chapterList.length && !contentLoading" class="empty-notice">
            <i class="ri-book-open-line"></i>
            <p>No readable content found.</p>
            <p class="hint">Re-upload the EPUB file to enable in-app reading.</p>
          </div>

        </div>
      </template>

    </div>

  </div>
</template>

<script setup>
definePageMeta({ layout: 'reader' })

import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useBooks } from '~/composables/useBooks'
import { useTTS, stripHtml, splitToChunks } from '~/composables/useTTS'
import { useBookStorage } from '~/composables/useBookStorage'

const route  = useRoute()
const router = useRouter()
const { books, fetchBookById, updateBook } = useBooks()
const { getBookContent } = useBookStorage()

// ── Core state ──────────────────────────────────────────────────────────────
const book               = ref(null)
const loading            = ref(true)
const contentLoading     = ref(false)
const rawContent         = ref('')
const tocTitles          = ref([])
const chaptersContainerRef = ref(null)

// ── Reader preferences ──────────────────────────────────────────────────────
const zoomLevel   = ref(1.0)
const readerTheme = ref('light')
const tocOpen     = ref(false)

const FONTS = [
  { label: 'Georgia (Serif)',  value: "Georgia, 'Times New Roman', serif" },
  { label: 'Palatino',         value: "'Palatino Linotype', Palatino, serif" },
  { label: 'System (Sans)',    value: "'Helvetica Neue', Arial, sans-serif" },
  { label: 'Monospace',        value: "'Courier New', Courier, monospace" },
]
const fontFamily = ref(FONTS[0].value)

// ── Chapter tracker (set by IntersectionObserver) ───────────────────────────
const currentChapterIdx = ref(hasCoverVal() ? -1 : 0)  // -1 = cover

function hasCoverVal() {
  const c = book.value?.cover
  return !!(c && !c.startsWith('data:image/svg+xml'))
}
const hasCover = computed(() => hasCoverVal())

const currentChapterTitle = computed(() => {
  if (currentChapterIdx.value === -1) return hasCover.value ? 'Cover' : ''
  const ch = chapterList.value[currentChapterIdx.value]
  return ch ? ch.title : ''
})

// ── EPUB scoped styles → injected into <head> ───────────────────────────────
const epubStyle = computed(() => {
  if (!rawContent.value) return ''
  const m = rawContent.value.match(/<style[^>]*>([\s\S]*?)<\/style>/i)
  return m?.[1] ?? ''
})

useHead(() => ({
  style: epubStyle.value
    ? [{ key: 'epub-book-styles', innerHTML: epubStyle.value }]
    : [],
}))

// ── Chapter parsing ─────────────────────────────────────────────────────────
function extractTitle(html, index) {
  // 1. First h1–h4 heading
  const hm = html.match(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/i)
  if (hm) {
    const t = hm[2].replace(/<[^>]+>/g, '').trim()
    if (t.length > 0 && t.length <= 120) return t
  }
  // 2. Semantic patterns at the very start of the text block
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const patterns = [
    /^(Chapter\s+(?:\d+|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|\w+)(?:\s*[:\-–—]\s*.{0,60})?)/i,
    /^(Part\s+(?:\d+|One|Two|Three|Four|Five|\w+)(?:\s*[:\-–—]\s*.{0,60})?)/i,
    /^(Prologue|Epilogue|Introduction|Preface|Foreword|Afterword|Acknowledgements?|About the Author|Author'?s? Note|Dedication)/i,
  ]
  for (const pat of patterns) {
    const m2 = text.match(pat)
    if (m2) return m2[1].slice(0, 80)
  }
  // 3. First short line that looks like a standalone title
  const firstLine = text.split(/\.\s|\n/)[0].trim()
  if (firstLine.length > 0 && firstLine.length <= 55
    && !/\b(also|copyright|published|isbn|printed|rights)\b/i.test(firstLine)) {
    return firstLine
  }
  // 4. Fallback — never show raw body text snippets
  return `Section ${index + 1}`
}

function parseChapters(content) {
  if (!content) return []
  let html = content
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/^\s*<div[^>]+class=["'][^"']*epub-content[^"']*["'][^>]*>\s*/i, '')
    .replace(/\s*<\/div>\s*$/, '')

  const parts = html.split(/<hr[^>]*chapter-break[^>]*\/?>/i)
  return parts
    .map(p => p.trim())
    .filter(p => p.replace(/<[^>]+>/g, '').trim().length > 3)
    .map((html, i) => ({ title: extractTitle(html, i), html }))
}

const chapterList = computed(() => {
  const chapters = parseChapters(rawContent.value)
  if (tocTitles.value.length) {
    return chapters.map((ch, i) => ({
      ...ch,
      title: tocTitles.value[i] ?? ch.title,
    }))
  }
  return chapters
})

// ── Navigation ──────────────────────────────────────────────────────────────
function scrollToChapter(i) {
  const el = document.getElementById('ch-' + i)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
function scrollToCover() {
  const el = document.getElementById('ch-cover')
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  else window.scrollTo({ top: 0, behavior: 'smooth' })
}

// ── IntersectionObserver: track which chapter is visible ────────────────────
let _observer = null

function observeChapters() {
  if (_observer) _observer.disconnect()
  _observer = new IntersectionObserver((entries) => {
    // Pick the section with the highest intersection ratio
    let best = null
    let bestRatio = 0
    for (const entry of entries) {
      if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
        best = entry.target
        bestRatio = entry.intersectionRatio
      }
    }
    if (!best) return
    const id = best.id
    if (id === 'ch-cover') {
      currentChapterIdx.value = -1
    } else if (id.startsWith('ch-')) {
      const idx = parseInt(id.slice(3))
      if (!isNaN(idx)) currentChapterIdx.value = idx
    }
  }, { threshold: [0.1, 0.3, 0.5] })

  if (hasCover.value) {
    const cover = document.getElementById('ch-cover')
    if (cover) _observer.observe(cover)
  }
  chapterList.value.forEach((_, i) => {
    const el = document.getElementById('ch-' + i)
    if (el) _observer.observe(el)
  })
}

// ── Zoom & theme ────────────────────────────────────────────────────────────
const zoomIn    = () => { if (zoomLevel.value < 1.5) zoomLevel.value = Math.round((zoomLevel.value + 0.1) * 10) / 10 }
const zoomOut   = () => { if (zoomLevel.value > 0.7) zoomLevel.value = Math.round((zoomLevel.value - 0.1) * 10) / 10 }
const toggleTheme = () => {
  readerTheme.value = readerTheme.value === 'light' ? 'dark' : 'light'
}

// ── Keyboard shortcuts ──────────────────────────────────────────────────────
function onKeydown(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
  if (e.key === 'Escape') tocOpen.value = false
}

// ── HTML sanitizer (XSS protection, preserve formatting attributes) ─────────
function sanitizeHtml(html) {
  if (!html) return ''
  const div = document.createElement('div')
  div.innerHTML = html
  const BLOCKED = ['script', 'iframe', 'object', 'embed', 'form', 'meta', 'link', 'base']
  BLOCKED.forEach(tag => div.querySelectorAll(tag).forEach(el => el.remove()))
  div.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name)
      } else if (['href', 'src', 'action', 'formaction'].includes(attr.name)) {
        const v = attr.value.trim().toLowerCase().replace(/\s/g, '')
        if (v.startsWith('javascript:')) el.removeAttribute(attr.name)
      }
    })
  })
  return div.innerHTML
}

// ── TTS highlight integration ───────────────────────────────────────────────
const { ttsBook, ttsChunkIdx, ttsWordIdx, ttsBoundaries, ttsStatus } = useTTS()

let _chunkEls   = []   // chunk index → injected <span data-chunk="N">
let _activeEl   = null  // currently chunk-highlighted element
let _wordEl     = null  // currently word-highlighted element

// Build chunk→DOM-element map across the ENTIRE rendered book (all chapters)
function _buildChunkMap() {
  const container = chaptersContainerRef.value
  if (!container || !rawContent.value) return

  const text   = stripHtml(rawContent.value)
  const chunks = splitToChunks(text, 400)

  const leaves = Array.from(
    container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th, dd, dt')
  ).filter(el => !el.querySelector('p, h1, h2, h3, h4, h5, h6, li, blockquote'))

  const normWs = s => s.replace(/\s+/g, ' ').trim()

  // Build normalized flat text from leaf DOM elements
  let flatText = ''
  const leafMeta = leaves.map(el => {
    const t = normWs(el.textContent)
    const start = flatText.length
    if (t) flatText += t + ' '
    return { el, start, end: start + t.length }
  })
  const flatLower = flatText.toLowerCase()

  _chunkEls = new Array(chunks.length).fill(null)
  const injectionsByLeaf = new Map()
  let searchPos = 0

  for (let i = 0; i < chunks.length; i++) {
    // Normalize chunk and use first 50 chars as search key
    const chunkNorm = normWs(chunks[i])
    const key = chunkNorm.toLowerCase().slice(0, 50)
    if (!key) continue
    const pos = flatLower.indexOf(key, searchPos)
    if (pos === -1) continue
    searchPos = pos + 1
    const entry = leafMeta.find(m => m.start <= pos && pos < m.end)
    if (!entry) continue
    if (!injectionsByLeaf.has(entry.el)) injectionsByLeaf.set(entry.el, [])
    // Store first ~6 words for flexible regex matching against actual text nodes
    const words = chunkNorm.split(/\s+/).slice(0, 6).filter(Boolean)
    injectionsByLeaf.get(entry.el).push({ chunkIdx: i, words, chunkLen: chunks[i].length })
  }

  for (const [leafEl, injections] of injectionsByLeaf) {
    for (let j = injections.length - 1; j >= 0; j--) {
      const { chunkIdx, words, chunkLen } = injections[j]
      if (!words.length) continue
      // Regex matches first few words with flexible whitespace
      const pattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+')
      const re = new RegExp(pattern, 'i')

      const walker = document.createTreeWalker(leafEl, NodeFilter.SHOW_TEXT)
      let tn
      while ((tn = walker.nextNode())) {
        const match = tn.textContent.match(re)
        if (!match) continue
        const raw      = tn.textContent
        const startPos = match.index
        const endPos   = Math.min(startPos + chunkLen, raw.length)
        const span     = document.createElement('span')
        span.dataset.chunk = chunkIdx
        span.textContent   = raw.slice(startPos, endPos)
        const parent = tn.parentNode
        if (!parent) break
        if (startPos > 0) parent.insertBefore(document.createTextNode(raw.slice(0, startPos)), tn)
        parent.insertBefore(span, tn)
        if (endPos < raw.length) parent.insertBefore(document.createTextNode(raw.slice(endPos)), tn)
        parent.removeChild(tn)
        _chunkEls[chunkIdx] = span
        break
      }
    }
  }
}

// Highlight the full chunk span (sentence-level); also resets word highlight
function _highlightChunk(idx) {
  // Collapse previous word span first to avoid DOM fragmentation
  if (_wordEl) {
    const p = _wordEl.parentNode
    if (p) { p.replaceChild(document.createTextNode(_wordEl.textContent), _wordEl); p.normalize() }
    _wordEl = null
  }
  if (_activeEl) { _activeEl.classList.remove('tts-active'); _activeEl = null }
  const el = _chunkEls[idx]
  if (!el) return
  el.classList.add('tts-active')
  _activeEl = el
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

// Highlight a specific word inside the active chunk span (word-level precision).
// Falls back to the parent paragraph element if the word lies beyond the span.
function _highlightWord(wordText) {
  if (_wordEl) {
    const parent = _wordEl.parentNode
    if (parent) {
      parent.replaceChild(document.createTextNode(_wordEl.textContent), _wordEl)
      parent.normalize()
    }
    _wordEl = null
  }
  if (!_activeEl || !wordText) return

  // Try within the chunk span, then widen to containing block element
  const searchRoots = [_activeEl]
  const parentEl = _activeEl.closest(
    'p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th, dd, dt'
  )
  if (parentEl && parentEl !== _activeEl) searchRoots.push(parentEl)

  for (const searchRoot of searchRoots) {
    const walker = document.createTreeWalker(searchRoot, NodeFilter.SHOW_TEXT)
    let tn
    while ((tn = walker.nextNode())) {
      const pos = tn.textContent.toLowerCase().indexOf(wordText.toLowerCase())
      if (pos === -1) continue
      const raw  = tn.textContent
      const ws   = document.createElement('span')
      ws.className   = 'tts-word'
      ws.textContent = raw.slice(pos, pos + wordText.length)
      const parent = tn.parentNode
      if (!parent) continue
      if (pos > 0) parent.insertBefore(document.createTextNode(raw.slice(0, pos)), tn)
      parent.insertBefore(ws, tn)
      if (pos + wordText.length < raw.length) parent.insertBefore(document.createTextNode(raw.slice(pos + wordText.length)), tn)
      parent.removeChild(tn)
      _wordEl = ws
      return
    }
  }
}

// Watch TTS chunk index — sentence-level highlight, auto-scroll
watch(ttsChunkIdx, (idx) => {
  if (ttsBook.value?.id !== book.value?.id) return
  if (ttsStatus.value === 'idle') return
  _highlightChunk(idx)
})

// Watch word index — word-level highlight inside current chunk (driven by rAF loop in useTTS)
watch(ttsWordIdx, (widx) => {
  if (ttsBook.value?.id !== book.value?.id) return
  if (ttsStatus.value === 'idle' || widx < 0) return
  const boundary = ttsBoundaries.value[widx]
  if (boundary?.word) _highlightWord(boundary.word)
})

watch([ttsStatus, ttsBook], ([status, tBook]) => {
  if (status === 'idle' || tBook?.id !== book.value?.id) {
    if (_activeEl) { _activeEl.classList.remove('tts-active'); _activeEl = null }
    if (_wordEl)   { _wordEl.classList.remove('tts-word');     _wordEl = null }
  }
})

// Rebuild chunk map when content loads (all chapters now in DOM together)
watch(rawContent, async () => {
  await nextTick()
  await nextTick()
  _buildChunkMap()
  observeChapters()
})

// ── Book loading ─────────────────────────────────────────────────────────────
async function loadBook(id) {
  const cached = books.value.find(b => b.id === id)
  if (cached) {
    book.value    = cached
    loading.value = false
  } else {
    const meta = await fetchBookById(id)
    if (!meta) { loading.value = false; return }
    book.value    = meta
    loading.value = false
  }

  contentLoading.value = true
  try {
    const stored = await getBookContent(id)
    if (stored?.content) {
      rawContent.value = stored.content
      tocTitles.value = stored.tocTitles ?? []
      book.value = { ...book.value, content: stored.content }
    }
  } catch (e) {
    console.error('[Reader] Failed to load content from IndexedDB:', e)
  } finally {
    contentLoading.value = false
  }

  await nextTick()
  await nextTick()
  _buildChunkMap()
  observeChapters()

  // Restore scroll position based on saved chapter progress
  if (book.value?.progress > 0 && chapterList.value.length > 0) {
    const targetIdx = Math.round((book.value.progress / 100) * (chapterList.value.length - 1))
    const el = document.getElementById('ch-' + Math.max(0, Math.min(targetIdx, chapterList.value.length - 1)))
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' })
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  await loadBook(Number(route.params.id))
})

onUnmounted(async () => {
  window.removeEventListener('keydown', onKeydown)
  if (_observer) _observer.disconnect()
  // Save progress
  if (book.value && chapterList.value.length > 0) {
    const idx = Math.max(0, currentChapterIdx.value)
    const progress = chapterList.value.length > 1
      ? Math.round((idx / (chapterList.value.length - 1)) * 100)
      : 100
    await updateBook({
      ...book.value,
      progress: Math.max(0, Math.min(100, progress)),
      status: progress > 95 ? 'Completed' : idx > 0 ? 'Reading' : 'Unread',
    })
  }
})
</script>

<style scoped>
/* ── Design tokens ──────────────────────────────────────────────────────── */
.reader-page.light {
  --bg:          #eceae4;
  --page-bg:     #ffffff;
  --page-shadow: 0 2px 24px rgba(0, 0, 0, 0.13);
  --topbar-bg:   #ffffff;
  --topbar-border: #e0ddd7;
  --text:        #1a1a1a;
  --muted:       #6b7280;
  --border:      #e5e7eb;
  --btn-hover:   #f3f4f6;
  --sidebar-bg:  #ffffff;
  --toc-active:  #f3f0ff;
  --toc-color:   #8A2BE2;
}
.reader-page.dark {
  --bg:          #18171c;
  --page-bg:     #27262d;
  --page-shadow: 0 2px 24px rgba(0, 0, 0, 0.45);
  --topbar-bg:   #1e1d24;
  --topbar-border: #3a3940;
  --text:        #e4e4e7;
  --muted:       #a1a1aa;
  --border:      #3a3940;
  --btn-hover:   #2e2d36;
  --sidebar-bg:  #1e1d24;
  --toc-active:  #2d1f42;
  --toc-color:   #a855f7;
}

.reader-page {
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  position: relative;
  transition: background 0.2s, color 0.2s;
}

/* ── Topbar (fixed, sits right of global sidebar) ── */
.reader-topbar {
  position: fixed;
  top: 0;
  left: var(--sidebar-width, 250px);
  right: 0;
  z-index: 200;
  height: 48px;
  background: var(--topbar-bg);
  border-bottom: 1px solid var(--topbar-border);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.75rem;
  gap: 0.5rem;
}

.tb-section { display: flex; align-items: center; flex: 1; }
.tb-left    { justify-content: flex-start; gap: 0.15rem; }
.tb-center  { justify-content: center; flex: 0 1 auto; min-width: 0; overflow: hidden; padding: 0 0.5rem; }
.tb-right   { justify-content: flex-end; gap: 0.25rem; }

.tb-btn {
  background: none; border: none; color: var(--muted); cursor: pointer;
  width: 32px; height: 32px; display: flex; align-items: center;
  justify-content: center; border-radius: 6px; font-size: 1rem; flex-shrink: 0;
  transition: background 0.12s, color 0.12s;
}
.tb-btn:hover:not(:disabled) { background: var(--btn-hover); color: var(--text); }
.tb-btn:disabled { opacity: 0.35; cursor: default; }

.tb-sep {
  width: 1px; height: 18px; background: var(--border);
  margin: 0 0.2rem; flex-shrink: 0;
}

.tb-size {
  font-size: 0.72rem; color: var(--muted);
  min-width: 20px; text-align: center; user-select: none;
}

.chapter-counter {
  font-size: 0.78rem;
  color: var(--muted);
  overflow: hidden;
  display: flex;
  align-items: center;
  max-width: 100%;
}
.ch-num { font-weight: 600; color: var(--text); flex-shrink: 0; }
.ch-sep { flex-shrink: 0; }
.ch-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }

.font-select {
  font-size: 0.72rem; color: var(--muted); background: var(--btn-hover);
  border: 1px solid var(--border); border-radius: 5px; padding: 2px 6px;
  height: 28px; cursor: pointer; max-width: 108px;
}

/* ── TOC: anchored to reader area, not covering global sidebar ── */
.toc-backdrop {
  display: none;
  position: fixed;
  top: 48px;
  left: var(--sidebar-width, 250px);
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 298;
}
.toc-backdrop.visible { display: block; }

.toc-sidebar {
  position: fixed;
  top: 48px;
  left: 0;
  height: calc(100vh - 48px);
  width: 288px;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border);
  z-index: 299;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: translateX(-100%);
  transition: transform 0.24s ease;
  box-shadow: 4px 0 20px rgba(0, 0, 0, 0.12);
}
.toc-sidebar.open { transform: translateX(var(--sidebar-width, 250px)); }

.toc-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.75rem 1rem; border-bottom: 1px solid var(--border);
  font-size: 0.875rem; font-weight: 600; color: var(--text); flex-shrink: 0;
}

.toc-book-info { padding: 1rem; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.toc-cover-thumb {
  width: 52px; height: 72px; border-radius: 3px; overflow: hidden;
  margin-bottom: 0.6rem; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
}
.toc-cover-thumb img { width: 100%; height: 100%; object-fit: cover; }
.toc-book-title { font-size: 0.83rem; font-weight: 600; color: var(--text); margin: 0 0 0.2rem; line-height: 1.3; }
.toc-book-author { font-size: 0.73rem; color: var(--muted); margin: 0; }

.toc-nav { flex: 1; overflow-y: auto; padding: 0.4rem 0; }
.toc-item {
  display: flex; align-items: flex-start; gap: 0.5rem; width: 100%;
  text-align: left; background: none; border: none; color: var(--text);
  cursor: pointer; padding: 0.5rem 1rem; font-size: 0.8rem; line-height: 1.45;
  transition: background 0.1s;
}
.toc-item:hover { background: var(--btn-hover); }
.toc-item.active { background: var(--toc-active); color: var(--toc-color); font-weight: 500; }
.toc-icon { font-size: 0.9rem; flex-shrink: 0; margin-top: 0.1rem; }
.toc-num { font-size: 0.7rem; color: var(--muted); min-width: 18px; flex-shrink: 0; margin-top: 0.15rem; text-align: right; }
.toc-item.active .toc-num { color: var(--toc-color); }

/* ── Reader body ── */
.reader-body {
  padding: calc(48px + 2rem) 1rem 4rem;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* ── Chapters container (continuous scroll) ── */
.chapters-container {
  width: 100%;
  max-width: 760px;
  display: flex;
  flex-direction: column;
}

/* ── Individual chapter card ── */
.chapter-section {
  width: 100%;
  background: var(--page-bg);
  box-shadow: var(--page-shadow);
  border-radius: 3px;
  margin-bottom: 2.5rem;
  min-height: 300px;
}

/* ── Cover section ── */
.cover-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3.5rem 2.5rem;
  gap: 2.25rem;
  min-height: 520px;
}
.cover-artwork {
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  border-radius: 3px;
  overflow: hidden;
  max-width: 300px;
}
.cover-img { width: 100%; height: auto; display: block; }
.cover-meta { text-align: center; }
.cover-title {
  font-family: Georgia, serif;
  font-size: 1.9rem;
  color: var(--text);
  margin: 0 0 0.5rem;
  line-height: 1.2;
}
.cover-author { font-size: 1rem; color: var(--muted); margin: 0; }

/* ── Chapter content ── */
/*
  Intentionally MINIMAL overrides — we let the EPUB's own injected CSS
  handle typography. We only set the canvas colour and guard against XSS.
  Removing heading-size / font-family / margin overrides that fought EPUB styles.
*/
.chapter-section article.chapter-content {
  padding: 3.5rem 4rem;
  line-height: 1.9;
  color: var(--text);
  word-break: break-word;
}

/*
  main.css sets `font-weight: 400 !important` globally.
  We fight it back with higher-source-order !important for bold elements.
*/
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

/* TTS sentence highlight (chunk level) */
.chapter-content :deep(.tts-active) {
  background: rgba(138, 43, 226, 0.10);
  border-radius: 3px;
  transition: background 0.2s;
}

/* TTS word highlight (word level — on top of chunk highlight) */
.chapter-content :deep(.tts-word) {
  background: rgba(138, 43, 226, 0.30);
  border-radius: 2px;
  outline: 1.5px solid rgba(138, 43, 226, 0.45);
  outline-offset: 1px;
  transition: background 0.08s;
}

/* Safety net for images / tables / code inside EPUB content */
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
/* Respect inline colour/size styles from EPUB CSS — don't override them */

/* ── Empty notice ── */
.empty-notice {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 4rem 2rem; text-align: center;
  color: var(--muted); gap: 0.75rem; background: var(--page-bg);
  border-radius: 3px; box-shadow: var(--page-shadow);
}
.empty-notice i { font-size: 3rem; }
.hint { font-size: 0.85rem; opacity: 0.7; margin: 0; }

/* ── Loading / error ── */
.state-center {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; flex: 1; min-height: calc(100vh - 96px);
  gap: 1rem; color: var(--muted);
}
.state-error i { font-size: 3rem; color: #ef4444; }
.btn-primary {
  background: #8A2BE2; color: #fff; border: none;
  padding: 0.6rem 1.25rem; border-radius: 8px; cursor: pointer; font-size: 0.875rem;
  transition: background 0.15s;
}
.btn-primary:hover { background: #7B1FD9; }

/* ── Spinner ── */
.loader-spinner {
  width: 36px; height: 36px;
  border: 3px solid rgba(138, 43, 226, 0.18);
  border-top-color: #8A2BE2;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Responsive ── */
@media (max-width: 768px) {
  .tb-size { display: none; }
  .font-select { display: none; }
  .reader-body { padding: calc(48px + 1rem) 0.5rem 3rem; }
  .toc-sidebar { width: 82vw; }
  .cover-section { padding: 2rem 1.25rem; }
  .chapter-section article.chapter-content { padding: 2rem 1.25rem; }
}
</style>
