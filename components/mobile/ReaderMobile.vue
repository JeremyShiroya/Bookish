<template>
  <div
    :ref="setReaderPage"
    class="reader-mobile-page"
    :class="[readerTheme, { replaceBottomNav }]"
  >
    <header class="reader-mobile-topbar">
      <button type="button" class="reader-nav-btn" aria-label="Back" @click="$emit('back')">
        <i class="ri-arrow-left-s-line"></i>
      </button>

      <h1>{{ book?.title || 'Reader' }}</h1>

      <div class="reader-top-actions">
        <button type="button" class="reader-nav-btn" aria-label="Audio controls" @click="mediaOpen = true">
          <i class="ri-headphone-fill"></i>
        </button>
        <button type="button" class="reader-nav-btn" aria-label="Reader options" @click="$emit('open-toc')">
          <i class="ri-equalizer-2-line"></i>
        </button>
      </div>
    </header>

    <main class="reader-mobile-content" :class="{ 'is-pdf-reader': isPdfRenderable }">
      <div v-if="loading || contentLoading" class="reader-state">
        <SkeletonLoader variant="reader" />
      </div>

      <div v-else-if="!book" class="reader-state reader-error">
        <i class="ri-error-warning-line"></i>
        <h2>Book not found</h2>
      </div>

      <template v-else>
        <div v-if="isPdfRenderable" class="reader-mobile-pdf">
          <PdfViewer
            :ref="setPdfViewer"
            :src="pdfSource"
            :zoom="mobilePdfZoom"
            :manifest="pdfManifest"
            :active-chunk-id="activeTtsChunkIndex"
            :active-word="activeWordRange"
            @page-change="$emit('page-change', $event)"
            @loaded="$emit('pdf-loaded', $event)"
          />
        </div>

        <div v-else-if="isPdfBook" class="reader-state reader-error">
          <i class="ri-file-pdf-2-line"></i>
          <p>This PDF was imported before original-page rendering was available.</p>
          <p class="hint">Re-upload the PDF once so Bookish can display the document exactly as it is.</p>
        </div>

        <div v-else class="reader-mobile-chapters" :ref="setChaptersContainer">
          <section v-if="hasCover" id="ch-cover" class="reader-mobile-cover">
            <img :src="book.cover" :alt="`${book.title} cover`" />
            <h2>{{ book.title }}</h2>
            <p v-if="book.author">by {{ book.author }}</p>
          </section>

          <section
            v-for="(chapter, index) in chapterList"
            :key="index"
            :id="`ch-${index}`"
            class="reader-mobile-section"
          >
            <article class="reader-mobile-text epub-content" v-html="sanitizeHtml(chapter.html)" />
          </section>

          <div v-if="!chapterList.length && !contentLoading" class="reader-state">
            <i class="ri-book-open-line"></i>
            <p>No readable content found.</p>
            <p class="hint">Re-upload the book to enable in-app reading.</p>
          </div>
        </div>
      </template>
    </main>

    <div class="reader-chapter-dock">
      <div class="chapter-pill">
        <button type="button" class="chapter-pill-step" aria-label="Previous chapter" @click="$emit('previous-chapter')">
          <i class="ri-arrow-left-s-line"></i>
        </button>
        <button type="button" class="chapter-pill-title" @click="$emit('open-toc')">
          {{ chapterLabel }}
        </button>
        <button type="button" class="chapter-pill-step" aria-label="Next chapter" @click="$emit('next-chapter')">
          <i class="ri-arrow-right-s-line"></i>
        </button>
      </div>
      <button type="button" class="chapter-play" aria-label="Play chapter" @click="playFromHere">
        <i :class="isPlaying ? 'ri-pause-fill' : 'ri-play-fill'"></i>
      </button>
    </div>

    <div class="mobile-bottom-nav-wrap" aria-hidden="true">
      <MobileBottomNav />
    </div>

    <Teleport to="body">
      <div v-if="mediaOpen" class="reader-media-layer">
        <button class="reader-media-backdrop" type="button" aria-label="Close audio controls" @click="mediaOpen = false"></button>
        <section class="reader-media-sheet" role="dialog" aria-modal="true" aria-label="Audio controls">
          <div class="sheet-grabber"></div>
          <h2>{{ chapterLabel }}</h2>

          <button type="button" class="narrator-btn">
            Switch narrator
            <i class="ri-arrow-right-s-line"></i>
          </button>

          <div class="media-buttons">
            <button type="button" aria-label="Previous" @click="skipChunks(-1)">
              <i class="ri-skip-back-fill"></i>
            </button>
            <button type="button" class="media-play" aria-label="Play or pause" @click="toggleMediaPlay">
              <i :class="isPlaying ? 'ri-pause-fill' : 'ri-play-fill'"></i>
            </button>
            <button type="button" aria-label="Next" @click="skipChunks(1)">
              <i class="ri-skip-forward-fill"></i>
            </button>
          </div>

          <div class="media-progress-row">
            <span>{{ elapsedTime || '00:00' }}</span>
            <input
              type="range"
              min="0"
              max="100"
              :value="ttsProgress || 0"
              aria-label="Audio progress"
              @input="seekToProgress(Number($event.target.value))"
            />
            <span>{{ totalTime || '00:00' }}</span>
          </div>

          <span class="speed-label">{{ ttsSpeed }}x</span>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import PdfViewer from '~/components/shared/PdfViewer.vue'
import SkeletonLoader from '~/components/shared/SkeletonLoader.vue'
import { useTTS } from '~/composables/useTTS'
import MobileBottomNav from './MobileBottomNav.vue'

const props = defineProps({
  readerRefs: { type: Object, required: true },
  readerTheme: { type: String, default: 'light' },
  book: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  contentLoading: { type: Boolean, default: false },
  isPdfRenderable: { type: Boolean, default: false },
  isPdfBook: { type: Boolean, default: false },
  pdfSource: { type: null, default: null },
  zoomLevel: { type: Number, default: 1 },
  pdfManifest: { type: Object, default: null },
  activeTtsChunkIndex: { type: Number, default: -1 },
  activeWordRange: { type: Object, default: null },
  hasCover: { type: Boolean, default: false },
  chapterList: { type: Array, default: () => [] },
  currentChapterIdx: { type: Number, default: 0 },
  currentPdfPage: { type: Number, default: 1 },
  totalPages: { type: Number, default: 0 },
  tocPosition: { type: Object, default: null },
  currentChapterTitle: { type: String, default: '' },
  sanitizeHtml: { type: Function, required: true },
})

const emit = defineEmits([
  'back',
  'open-toc',
  'page-change',
  'pdf-loaded',
  'read-current-position',
  'previous-chapter',
  'next-chapter',
])

const {
  ttsBook,
  ttsStatus,
  ttsProgress,
  ttsSpeed,
  elapsedTime,
  totalTime,
  togglePlay,
  skipChunks,
  seekToProgress,
} = useTTS()

const mediaOpen = ref(false)
const replaceBottomNav = ref(false)
let lastScrollY = 0

const isPlaying = computed(() => (
  ttsBook.value?.id === props.book?.id && ttsStatus.value === 'playing'
))

const mobilePdfZoom = computed(() => 1)

const chapterLabel = computed(() => {
  if (props.isPdfRenderable) {
    const total = props.totalPages || props.book?.pages || 1
    return `Page ${props.currentPdfPage} / ${total}`
  }
  if (props.tocPosition?.title) return props.tocPosition.title
  if (props.currentChapterTitle) return props.currentChapterTitle
  return `Chapter ${props.currentChapterIdx + 1}`
})

const setReaderPage = (el) => {
  props.readerRefs.readerPageRef.value = el
}

const setChaptersContainer = (el) => {
  props.readerRefs.chaptersContainerRef.value = el
}

const setPdfViewer = (el) => {
  props.readerRefs.pdfViewerRef.value = el
}

const playFromHere = () => {
  if (isPlaying.value) {
    togglePlay()
    return
  }
  emit('read-current-position')
}

const toggleMediaPlay = () => {
  if (ttsBook.value?.id === props.book?.id && ttsStatus.value !== 'idle') {
    togglePlay()
    return
  }
  emit('read-current-position')
}

const onScroll = () => {
  const nextY = window.scrollY || 0
  const goingDown = nextY > lastScrollY + 3
  const goingUp = nextY < lastScrollY - 3
  if (goingDown && nextY > 96) replaceBottomNav.value = true
  if (goingUp || nextY < 48) replaceBottomNav.value = false
  lastScrollY = Math.max(0, nextY)
}

onMounted(() => {
  lastScrollY = window.scrollY || 0
  window.addEventListener('scroll', onScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<style scoped>
.reader-mobile-page {
  --mobile-reader-bg: #e8e8f2;
  --mobile-reader-text: #222431;
  --mobile-reader-muted: #6f7282;
  min-height: 100vh;
  background: var(--mobile-reader-bg);
  color: var(--mobile-reader-text);
  font-family: var(--mobile-font-family);
}

.reader-mobile-page.dark {
  --mobile-reader-bg: var(--color-reader-dark-background);
  --mobile-reader-text: var(--color-reader-dark-text);
  --mobile-reader-muted: var(--color-reader-dark-muted);
}

.reader-mobile-topbar {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 1150;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 88px;
  align-items: center;
  min-height: 52px;
  padding: env(safe-area-inset-top) 8px 0;
  background: var(--mobile-reader-bg);
}

.reader-mobile-topbar h1 {
  overflow: hidden;
  margin: 0;
  color: var(--mobile-reader-text);
  font-size: 17px;
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reader-top-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.reader-nav-btn {
  display: inline-grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--mobile-reader-text);
  cursor: pointer;
  font-size: 21px;
}

.reader-mobile-content {
  padding: calc(60px + env(safe-area-inset-top)) 20px 150px;
}

.reader-mobile-content.is-pdf-reader {
  padding: calc(60px + env(safe-area-inset-top)) 12px 150px;
}

.reader-mobile-pdf {
  width: 100%;
}

.reader-mobile-pdf :deep(.pdf-viewer) {
  max-width: 100%;
  gap: 2rem;
  overflow-x: hidden;
  padding: 0 0 2rem;
}

.reader-mobile-pdf :deep(.pdf-page-wrap) {
  max-width: 100%;
}

.reader-mobile-chapters {
  display: grid;
  gap: 0;
}

.reader-mobile-section {
  min-height: auto;
}

.reader-mobile-text {
  color: var(--mobile-reader-text);
  font-size: 14.5px;
  line-height: 1.22;
  word-break: break-word;
}

.reader-mobile-text :deep(p) {
  margin: 0 0 0.65rem;
}

.reader-mobile-text :deep(.tts-active) {
  border-radius: 3px;
  background: var(--color-reader-highlight);
  outline: 1px solid var(--color-reader-highlight-border);
}

.reader-mobile-text :deep(img) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 1rem auto;
}

.reader-mobile-cover {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
  min-height: 70vh;
  padding-top: 2rem;
  text-align: center;
}

.reader-mobile-cover img {
  width: min(58vw, 220px);
  border-radius: 6px;
  box-shadow: var(--shadow-cover);
}

.reader-mobile-cover h2,
.reader-mobile-cover p {
  margin: 0;
}

.reader-state {
  display: grid;
  min-height: 55vh;
  place-items: center;
  gap: 0.7rem;
  color: var(--mobile-reader-muted);
  text-align: center;
}

.reader-state i {
  font-size: 2rem;
}

.hint {
  margin: 0;
  font-size: 0.82rem;
  opacity: 0.75;
}

.reader-chapter-dock {
  position: fixed;
  right: 0;
  bottom: calc(var(--mobile-bottom-nav-height, 72px) + env(safe-area-inset-bottom));
  left: 0;
  z-index: 1160;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 48px;
  gap: 10px;
  align-items: center;
  padding: 10px 20px 12px;
  background: transparent;
  transition: bottom 0.24s ease, transform 0.24s ease;
}

.reader-mobile-page.replaceBottomNav .reader-chapter-dock {
  bottom: env(safe-area-inset-bottom);
  padding-bottom: 18px;
}

.chapter-play {
  border: 0;
  background: #fff;
  color: var(--mobile-reader-text);
  cursor: pointer;
  box-shadow: 0 1px 5px rgba(15, 23, 42, 0.08);
}

.chapter-pill {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 44px;
  height: 42px;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 1px 5px rgba(15, 23, 42, 0.08);
}

.chapter-pill-step,
.chapter-pill-title {
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--mobile-reader-text);
  cursor: pointer;
}

.chapter-pill-step {
  display: grid;
  place-items: center;
  font-size: 22px;
}

.chapter-pill-title {
  overflow: hidden;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reader-mobile-page.replaceBottomNav .chapter-pill {
  background: transparent;
  box-shadow: none;
}

.reader-mobile-page.replaceBottomNav .chapter-pill-step {
  visibility: hidden;
}

.reader-mobile-page.replaceBottomNav .chapter-pill-title {
  text-align: center;
}

.chapter-play {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 50%;
  font-size: 20px;
}

.mobile-bottom-nav-wrap {
  transition: transform 0.24s ease, opacity 0.2s ease;
}

.reader-mobile-page.replaceBottomNav .mobile-bottom-nav-wrap {
  opacity: 0;
  pointer-events: none;
  transform: translateY(110%);
}

.reader-media-layer {
  position: fixed;
  inset: 0;
  z-index: 2200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.reader-media-backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(15, 23, 42, 0.12);
}

.reader-media-sheet {
  position: relative;
  width: 100%;
  min-height: 188px;
  padding: 10px 16px calc(22px + env(safe-area-inset-bottom));
  border-radius: 16px 16px 0 0;
  background: #f5f5fb;
  color: var(--mobile-reader-text);
  box-shadow: 0 -12px 34px rgba(15, 23, 42, 0.16);
  text-align: center;
}

.sheet-grabber {
  width: 42px;
  height: 4px;
  margin: 0 auto 16px;
  border-radius: 999px;
  background: #0d0d13;
}

.reader-media-sheet h2 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 650;
}

.narrator-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 30px;
  margin-bottom: 14px;
  padding: 0 12px;
  border: 0;
  border-radius: 7px;
  background: #e1e2ef;
  color: #9ca0b3;
  font-size: 13px;
}

.media-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 30px;
  margin-bottom: 12px;
}

.media-buttons button {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #02030a;
  cursor: pointer;
  font-size: 18px;
}

.media-buttons .media-play {
  font-size: 21px;
}

.media-progress-row {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 42px;
  gap: 6px;
  align-items: center;
  color: #1f2230;
  font-size: 9px;
}

.media-progress-row input {
  width: 100%;
  accent-color: var(--color-brand-primary);
}

.speed-label {
  display: block;
  margin-top: 8px;
  color: #1f2230;
  font-size: 10px;
  text-align: left;
}
</style>
