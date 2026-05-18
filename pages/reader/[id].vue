<template>
  <div class="reader-page" :class="readerTheme">
    <!-- Thin progress bar -->
    <div class="progress-track">
      <div class="progress-fill" :style="{ width: scrollProgress + '%' }"></div>
    </div>

    <!-- Minimal nav row -->
    <div class="reader-nav">
      <button class="back-btn" @click="goBack">
        <i class="ri-arrow-left-s-line"></i>
        Library
      </button>
      <div class="reading-controls" v-if="book">
        <button class="ctrl-btn small-a" @click="decreaseFontSize" title="Smaller text">A</button>
        <button class="ctrl-btn large-a" @click="increaseFontSize" title="Bigger text">A</button>
        <button class="ctrl-btn" @click="toggleTheme" :title="readerTheme === 'light' ? 'Dark mode' : 'Light mode'">
          <i :class="readerTheme === 'light' ? 'ri-moon-line' : 'ri-sun-line'"></i>
        </button>
      </div>
    </div>

    <!-- Reading content -->
    <div class="reading-area">
      <!-- Loading -->
      <div v-if="loading" class="reader-loader">
        <div class="loader-spinner"></div>
        <p>Opening book…</p>
      </div>

      <!-- Book (any format — content is always HTML text) -->
      <template v-else-if="book">
        <div class="book-heading">
          <h1>{{ book.title }}</h1>
          <p class="by-line">by {{ book.author }}</p>
          <div class="heading-rule"></div>
        </div>

        <div v-if="contentLoading" class="content-loading">
          <div class="loader-spinner"></div>
          <p>Loading content…</p>
        </div>

        <!-- Legacy: old PDF uploads stored as base64 data URL -->
        <PdfViewer v-else-if="isLegacyPdf" :src="book.content" />

        <div
          v-else-if="book.content"
          ref="bookTextRef"
          class="book-text"
          :style="{ fontSize: fontSize + 'px' }"
          v-html="displayContent"
        ></div>

        <div v-else class="no-content">
          <i class="ri-book-2-line"></i>
          <p>No readable content for this book.</p>
          <p class="no-content-sub">Re-upload the file to enable in-app reading.</p>
        </div>
      </template>

      <!-- Not found -->
      <div v-else-if="!loading" class="reader-error">
        <i class="ri-error-warning-line"></i>
        <h2>Book not found</h2>
        <button @click="goBack" class="back-link">Return to Library</button>
      </div>

      <div style="height: 5rem"></div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'reader' });

import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useBooks } from '~/composables/useBooks';
import { useTTS, stripHtml, splitToChunks } from '~/composables/useTTS';
import { useBookStorage } from '~/composables/useBookStorage';

const route = useRoute();
const router = useRouter();
const { books, fetchBookById, updateBook } = useBooks();
const { getBookContent } = useBookStorage();

const book = ref(null);
const loading = ref(true);
const contentLoading = ref(false);
const fontSize = ref(19);
const readerTheme = ref('light');
const scrollProgress = ref(0);

const isLegacyPdf = computed(() =>
  book.value?.format === 'pdf' && book.value?.content?.startsWith('data:')
);

function sanitizeHtml(html) {
  const container = document.createElement('div')
  container.innerHTML = html
  const BLOCKED = ['script', 'iframe', 'object', 'embed', 'form', 'meta', 'link', 'base']
  BLOCKED.forEach(tag => container.querySelectorAll(tag).forEach(el => el.remove()))
  container.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name)
      } else if (['href', 'src', 'action', 'formaction'].includes(attr.name)) {
        if (attr.value.trim().toLowerCase().replace(/\s/g, '').startsWith('javascript:')) {
          el.removeAttribute(attr.name)
        }
      }
    })
  })
  return container.innerHTML
}

const displayContent = computed(() => {
  if (!book.value?.content) return '';
  const c = book.value.content;
  if (/<[a-z][\s\S]*>/i.test(c)) return sanitizeHtml(c);
  return c.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');
});

// ── TTS highlight ──────────────────────────────────────────────────────────
const { ttsBook, ttsChunkIdx, ttsStatus, ttsCurrentChunk } = useTTS()

const bookTextRef = ref(null)
let _chunkEls = []   // pre-built chunk → DOM element map
let _activeEl = null

function _buildChunkMap() {
  const container = bookTextRef.value
  if (!container || !book.value?.content) return

  const text = stripHtml(book.value.content)
  const chunks = splitToChunks(text, 400)

  // Collect leaf block elements (no child block elements) — these hold the raw text nodes
  const leaves = Array.from(
    container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote')
  ).filter(el => !el.querySelector('p, h1, h2, h3, h4, h5, h6, li, blockquote'))

  // Build normalized flat text from leaf textContent (mirrors stripHtml whitespace handling)
  let flatText = ''
  const leafMeta = leaves.map(el => {
    const norm = el.textContent.replace(/\s+/g, ' ').trim()
    const start = flatText.length
    if (norm) flatText += norm + ' '
    return { el, start, end: start + norm.length }
  })

  // Plan which chunks go in which leaf, and what their key text is
  const injectionsByLeaf = new Map()
  let searchPos = 0
  for (let i = 0; i < chunks.length; i++) {
    const key = chunks[i].slice(0, 30)
    const pos = flatText.indexOf(key, searchPos)
    if (pos === -1) continue
    searchPos = pos + 1

    const entry = leafMeta.find(m => m.start <= pos && pos < m.end)
    if (!entry) continue

    if (!injectionsByLeaf.has(entry.el)) injectionsByLeaf.set(entry.el, [])
    injectionsByLeaf.get(entry.el).push({ chunkIdx: i, searchKey: key, chunkLen: chunks[i].length })
  }

  // Inject <span data-chunk="N"> wrappers into the live DOM text nodes.
  // Process each leaf's injections in reverse order so earlier positions
  // in the same text node are not disturbed by later insertions.
  _chunkEls = new Array(chunks.length).fill(null)

  for (const [leafEl, injections] of injectionsByLeaf) {
    for (let j = injections.length - 1; j >= 0; j--) {
      const { chunkIdx, searchKey, chunkLen } = injections[j]

      // Re-traverse text nodes each time so DOM changes from previous
      // injections in this leaf are reflected
      const found = _findTextNode(leafEl, searchKey)
      if (!found) continue

      const { node: tn, pos: startPos } = found
      const raw = tn.textContent
      const endPos = Math.min(startPos + chunkLen, raw.length)

      const span = document.createElement('span')
      span.dataset.chunk = chunkIdx
      span.textContent = raw.slice(startPos, endPos)

      const parent = tn.parentNode
      if (!parent) continue
      if (startPos > 0)    parent.insertBefore(document.createTextNode(raw.slice(0, startPos)), tn)
      parent.insertBefore(span, tn)
      if (endPos < raw.length) parent.insertBefore(document.createTextNode(raw.slice(endPos)), tn)
      parent.removeChild(tn)

      _chunkEls[chunkIdx] = span
    }
  }
}

// Walk text nodes inside `el` and return the first one that contains `searchKey`
function _findTextNode(el, searchKey) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let tn
  while ((tn = walker.nextNode())) {
    const pos = tn.textContent.indexOf(searchKey)
    if (pos !== -1) return { node: tn, pos }
  }
  return null
}

function _highlightChunk(idx) {
  if (_activeEl) { _activeEl.classList.remove('tts-active'); _activeEl = null }
  const el = _chunkEls[idx]
  if (!el) return
  el.classList.add('tts-active')
  _activeEl = el
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

// Rebuild the map whenever this book's content loads
watch(
  () => book.value?.content,
  async () => {
    await nextTick()
    _buildChunkMap()
    if (ttsBook.value?.id === book.value?.id && ttsStatus.value === 'playing') {
      _highlightChunk(ttsChunkIdx.value)
    }
  }
)

// Highlight each new chunk when TTS is playing this book
watch(ttsChunkIdx, (idx) => {
  if (ttsBook.value?.id !== book.value?.id) return
  if (ttsStatus.value === 'idle') return
  _highlightChunk(idx)
})

// Clear highlight when TTS stops or switches to a different book
watch([ttsStatus, ttsBook], ([status, tBook]) => {
  if (status === 'idle' || tBook?.id !== book.value?.id) {
    if (_activeEl) { _activeEl.classList.remove('tts-active'); _activeEl = null }
  }
})
// ── end TTS highlight ───────────────────────────────────────────────────────

const handleScroll = () => {
  const total = document.documentElement.scrollHeight - window.innerHeight;
  if (total > 0) scrollProgress.value = (window.scrollY / total) * 100;
};

const restoreScroll = async () => {
  if (book.value?.progress) {
    await nextTick();
    setTimeout(() => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: (book.value.progress / 100) * total });
    }, 150);
  }
};

onMounted(async () => {
  const id = Number(route.params.id);
  window.addEventListener('scroll', handleScroll, { passive: true });

  // Use cached metadata for instant render
  const cached = books.value.find(b => b.id === id);
  if (cached) {
    contentLoading.value = true;
    book.value = cached;
    loading.value = false;
    window.addEventListener('scroll', handleScroll, { passive: true });

    // ── Stage 2: load content from IndexedDB ─────────────────────────────────
    const stored = await getBookContent(id);
    if (stored) {
      book.value = { ...book.value, content: stored.content };
    }
    contentLoading.value = false;
    await restoreScroll();
  } else {
    // No cache — metadata fetch then load content from IndexedDB
    const meta = await fetchBookById(id);
    if (!meta) {
      loading.value = false;
      return;
    }
    contentLoading.value = true;
    book.value = meta;
    loading.value = false;
    window.addEventListener('scroll', handleScroll, { passive: true });

    // ── Stage 2: load content from IndexedDB ─────────────────────────────────
    const stored = await getBookContent(id);
    if (stored) {
      book.value = { ...book.value, content: stored.content };
    }
    contentLoading.value = false;
    await restoreScroll();
  }
});

onUnmounted(async () => {
  window.removeEventListener('scroll', handleScroll);
  if (book.value && scrollProgress.value > 0) {
    await updateBook({
      ...book.value,
      progress: Math.round(scrollProgress.value),
      status: scrollProgress.value > 95 ? 'Completed' : 'Reading',
    });
  }
});

const goBack = () => router.back();
const toggleTheme = () => { readerTheme.value = readerTheme.value === 'light' ? 'dark' : 'light'; };
const increaseFontSize = () => { if (fontSize.value < 36) fontSize.value += 1; };
const decreaseFontSize = () => { if (fontSize.value > 13) fontSize.value -= 1; };
</script>

<style scoped>
/* ── Tokens ── */
.reader-page.light {
  --bg: #ffffff;
  --text: #1a1a1a;
  --muted: #6b7280;
  --border: #e8e8e8;
  --ctrl-hover: #f3f4f6;
}
.reader-page.dark {
  --bg: #18181b;
  --text: #e4e4e7;
  --muted: #a1a1aa;
  --border: #3f3f46;
  --ctrl-hover: #27272a;
}

.reader-page {
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  transition: background 0.2s, color 0.2s;
}

/* ── Progress bar ── */
.progress-track {
  height: 3px;
  background: transparent;
  position: sticky;
  top: 0;
  z-index: 10;
}
.progress-fill {
  height: 100%;
  background: #8A2BE2;
  transition: width 0.15s;
}

/* ── Nav row ── */
.reader-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 2rem 0;
  max-width: 780px;
  margin: 0 auto;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  background: none;
  border: none;
  color: #8A2BE2;
  font-size: 0.875rem;
  font-weight: 400;
  cursor: pointer;
  padding: 0.35rem 0.6rem;
  border-radius: 0.375rem;
  transition: background 0.15s;
}
.back-btn:hover { background: var(--ctrl-hover); }
.back-btn i { font-size: 1.1rem; }

.reading-controls {
  display: flex;
  align-items: center;
  gap: 0.15rem;
}

.ctrl-btn {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 0.35rem 0.55rem;
  border-radius: 0.375rem;
  font-family: Georgia, serif;
  font-weight: 400;
  font-size: 0.9rem;
  transition: background 0.15s, color 0.15s;
  display: flex;
  align-items: center;
}
.ctrl-btn:hover { background: var(--ctrl-hover); color: var(--text); }
.ctrl-btn.small-a { font-size: 0.75rem; }
.ctrl-btn.large-a { font-size: 1.15rem; }
.ctrl-btn i { font-size: 1rem; }

/* ── Reading area ── */
.reading-area {
  max-width: 680px;
  margin: 0 auto;
  padding: 2rem 2rem 0;
}

/* ── Book heading ── */
.book-heading {
  text-align: center;
  margin-bottom: 3rem;
}
.book-heading h1 {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 2.1rem;
  font-weight: 400;
  line-height: 1.2;
  margin: 0 0 0.5rem;
  color: var(--text);
}
.by-line {
  font-size: 1rem;
  color: var(--muted);
  margin: 0 0 1.5rem;
}
.heading-rule {
  width: 48px;
  height: 3px;
  background: #8A2BE2;
  border-radius: 2px;
  margin: 0 auto;
}

/* ── Book text ── */
.book-text {
  font-family: Georgia, 'Times New Roman', serif;
  line-height: 1.9;
  color: var(--text);
  word-break: break-word;
}

.book-text :deep(.tts-active) {
  background: rgba(138, 43, 226, 0.12);
  border-radius: 4px;
  outline: 2px solid rgba(138, 43, 226, 0.25);
  outline-offset: 2px;
  transition: background 0.25s, outline-color 0.25s;
}

.book-text :deep(p) { margin: 0 0 1.5em; }
.book-text :deep(h1),
.book-text :deep(h2),
.book-text :deep(h3) {
  font-family: Georgia, serif;
  margin: 2.5rem 0 1rem;
  line-height: 1.3;
  color: var(--text);
}
.book-text :deep(h1) { font-size: 1.6em; }
.book-text :deep(h2) { font-size: 1.3em; }
.book-text :deep(h3) { font-size: 1.1em; }
.book-text :deep(img) {
  max-width: 100%;
  border-radius: 0.5rem;
  margin: 1rem auto;
  display: block;
}
.book-text :deep(.chapter-break) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 3.5rem auto;
  width: 50%;
}

/* ── States ── */
.content-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 0;
  gap: 1rem;
  color: var(--muted);
}

.reader-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6rem 0;
  gap: 1.25rem;
  color: var(--muted);
}
.loader-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(138, 43, 226, 0.2);
  border-top-color: #8A2BE2;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.no-content {
  text-align: center;
  padding: 4rem 0;
  color: var(--muted);
}
.no-content i { font-size: 3rem; margin-bottom: 1rem; display: block; }
.no-content-sub { font-size: 0.85rem; margin-top: 0.5rem; opacity: 0.7; }

.reader-error {
  text-align: center;
  padding: 5rem 0;
  color: var(--muted);
}
.reader-error i { font-size: 3rem; color: #ef4444; margin-bottom: 1rem; display: block; }
.back-link {
  background: #8A2BE2;
  color: white;
  border: none;
  padding: 0.625rem 1.25rem;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: 400;
  margin-top: 1rem;
}
</style>
