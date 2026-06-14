<template>
  <div class="playing-bar">
    <div class="track-info">
      <template v-if="ttsBook">
        <div class="album-art track-link" @click="router.push(`/book/${ttsBook.id}`)">
          <img
            :src="resolveBookCover(ttsBook)"
            :alt="ttsBook.title"
            @error="(e) => coverFallback(e, ttsBook.title)"
          />
        </div>
        <div class="track-details track-link" @click="router.push(`/book/${ttsBook.id}`)">
          <h4 class="track-title">{{ ttsBook.title }}</h4>
          <p class="artist-name">{{ ttsBook.author }}</p>
        </div>
        <button
          class="icon-btn like-btn"
          :title="ttsBook.isFavourite ? 'Unfavourite' : 'Favourite'"
          @click="handleFavourite"
        >
          <i
            :class="ttsBook.isFavourite ? 'ri-heart-fill' : 'ri-heart-line'"
            :style="{ color: ttsBook.isFavourite ? 'var(--color-status-danger)' : '' }"
          ></i>
        </button>
      </template>
      <template v-else>
        <div class="idle-info">
          <i class="ri-headphone-line"></i>
          <span>Nothing playing</span>
        </div>
      </template>
    </div>

    <div class="player-controls">
      <div class="control-buttons" aria-label="Read aloud controls">
        <button
          class="transport-btn"
          title="Previous book"
          :disabled="!hasPreviousBook"
          @click="playAdjacentBook(-1)"
        >
          <i class="ri-skip-back-fill"></i>
        </button>

        <button
          class="transport-btn"
          title="Previous sentence"
          :disabled="isIdle"
          @click="skipChunks(-1)"
        >
          <i class="ri-arrow-left-s-line"></i>
        </button>

        <button
          class="transport-btn time-jump-btn"
          title="Rewind 10 seconds"
          :disabled="isIdle"
          @click="skipSeconds(-10)"
        >
          <i class="ri-replay-10-line"></i>
        </button>

        <button
          class="play-btn"
          title="Play / Pause"
          :disabled="isIdle && !ttsBook"
          @click="handlePlayPause"
        >
          <i v-if="ttsStatus === 'loading'" class="ri-loader-4-line spinner"></i>
          <i v-else-if="ttsStatus === 'playing'" class="ri-pause-fill"></i>
          <i v-else class="ri-play-fill"></i>
        </button>

        <button
          class="transport-btn time-jump-btn"
          title="Forward 10 seconds"
          :disabled="isIdle"
          @click="skipSeconds(10)"
        >
          <i class="ri-forward-10-line"></i>
        </button>

        <button
          class="transport-btn"
          title="Next sentence"
          :disabled="isIdle"
          @click="skipChunks(1)"
        >
          <i class="ri-arrow-right-s-line"></i>
        </button>

        <button
          class="transport-btn"
          title="Next book"
          :disabled="!hasNextBook"
          @click="playAdjacentBook(1)"
        >
          <i class="ri-skip-forward-fill"></i>
        </button>
      </div>
      <div class="time-display" aria-label="Playback time">
        <span>{{ elapsedTime }}</span>
        <div class="time-progress-track" :class="{ 'has-chapters': showChapters }">
          <template v-if="showChapters">
            <button
              v-if="overflowBefore"
              type="button"
              class="chapter-overflow past"
              @click.stop="openChapterMenu($event)"
              @mouseenter="showSegmentTip($event, `${overflowBefore} earlier ${overflowBefore === 1 ? 'chapter' : 'chapters'} — click to browse`)"
              @mouseleave="hideSegmentTip"
            >+{{ overflowBefore }}</button>

            <div
              v-for="seg in visibleSegments"
              :key="seg.index"
              class="chapter-segment"
              :class="{ active: seg.isActive, past: seg.isPast }"
              :style="{ width: seg.widthPct + '%' }"
              @click="handleSegmentClick(seg)"
              @mouseenter="showSegmentTip($event, seg.title)"
              @mouseleave="hideSegmentTip"
            >
              <div class="chapter-segment-fill" :style="{ width: seg.fillPct + '%' }"></div>
            </div>

            <button
              v-if="overflowAfter"
              type="button"
              class="chapter-overflow"
              @click.stop="openChapterMenu($event)"
              @mouseenter="showSegmentTip($event, `${overflowAfter} more ${overflowAfter === 1 ? 'chapter' : 'chapters'} — click to browse`)"
              @mouseleave="hideSegmentTip"
            >+{{ overflowAfter }}</button>
          </template>
          <template v-else>
            <div class="time-progress-fill" :style="{ width: `${ttsProgress || 0}%` }"></div>
          </template>
        </div>
        <span>{{ totalTime }}</span>
      </div>
    </div>

    <div class="extra-controls">
      <button
        class="icon-btn speed-btn"
        :disabled="isIdle"
        title="Playback speed"
        @click="cycleSpeed"
      >
        {{ speedLabel }}
      </button>

      <BookishSelect
        v-if="ttsVoices.length > 0"
        compact
        :model-value="ttsVoiceId"
        :options="ttsVoices.map(voice => ({ value: voice.id, label: voice.name }))"
        :disabled="isIdle"
        @update:model-value="setVoice"
      />

      <div class="volume-control">
        <button class="icon-btn volume-btn" title="Mute / Unmute" @click="toggleMute">
          <i :class="isMuted ? 'ri-volume-mute-line' : 'ri-volume-up-line'"></i>
        </button>
        <div class="volume-slider-wrapper">
          <input
            type="range"
            min="0"
            max="100"
            :value="Math.round(ttsVolume * 100)"
            class="volume-slider"
            @input="handleVolume($event.target.value)"
          />
          <div class="volume-fill" :style="{ width: Math.round(ttsVolume * 100) + '%' }"></div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="segmentTip.visible"
        class="chapter-tooltip"
        :style="{ left: segmentTip.x + 'px', top: segmentTip.y + 'px' }"
      >{{ segmentTip.text }}</div>

      <div
        v-if="chapterMenuOpen"
        ref="chapterMenuRef"
        class="chapter-menu"
        :style="{ left: chapterMenuX + 'px' }"
        role="menu"
        aria-label="Chapters"
      >
        <header class="chapter-menu-head">
          <span>Chapters</span>
          <span class="chapter-menu-count">{{ chapterSegments.length }}</span>
        </header>
        <div class="chapter-menu-list">
          <button
            v-for="seg in chapterSegments"
            :key="seg.index"
            type="button"
            class="chapter-menu-item"
            :class="{ active: seg.isActive, past: seg.isPast }"
            role="menuitem"
            @click="jumpToChapter(seg)"
          >
            <span class="chapter-menu-num">{{ seg.index + 1 }}</span>
            <span class="chapter-menu-title">{{ seg.title }}</span>
            <i v-if="seg.isActive" class="ri-volume-up-fill chapter-menu-icon"></i>
            <span v-else class="chapter-menu-pct">{{ chapterPercent(seg) }}</span>
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTTS } from '~/composables/useTTS'
import { useBooks } from '~/composables/useBooks'
import { useBookishSettings } from '~/composables/useBookishSettings'

const router = useRouter()

const {
  ttsBook, ttsStatus, ttsSpeed, ttsVolume,
  ttsVoiceId, ttsVoices, ttsProgress, ttsChunkIdx, ttsTotalChunks, ttsChapterBoundaries,
  elapsedTime, totalTime,
  play, togglePlay, skipChunks, skipSeconds, seekToChunk, setSpeed, setVolume, setVoice, restoreLastSession,
} = useTTS()

const { settings } = useBookishSettings()
const trackSplitting = computed(() => settings.value.trackSplitting)

const { books, toggleFavourite } = useBooks()

const isIdle = computed(() => ttsStatus.value === 'idle')
const isMuted = ref(false)
const prevVolume = ref(1.0)

const chapterSegments = computed(() => {
  const boundaries = ttsChapterBoundaries.value
  const total = ttsTotalChunks.value
  if (!boundaries.length || total <= 0) return []
  const currentIdx = ttsChunkIdx.value
  return boundaries.map((seg, i) => {
    const segLen = seg.chunkEnd - seg.chunkStart + 1
    const isPast = currentIdx > seg.chunkEnd
    const isActive = currentIdx >= seg.chunkStart && currentIdx <= seg.chunkEnd
    const fillPct = isPast ? 100 : isActive && segLen > 1
      ? Math.min(100, (currentIdx - seg.chunkStart) / segLen * 100)
      : isActive ? 50 : 0
    return { ...seg, index: i, rawLen: segLen, isPast, isActive, fillPct }
  })
})

const showChapters = computed(() => trackSplitting.value && chapterSegments.value.length > 1)

// Long books: show a window of segments around the current chapter so the
// bar stays readable; the rest collapse into "+N" pills that open the menu.
const MAX_VISIBLE_CHAPTERS = 7

const segmentWindow = computed(() => {
  const segs = chapterSegments.value
  if (segs.length <= MAX_VISIBLE_CHAPTERS) {
    const total = segs.reduce((sum, seg) => sum + seg.rawLen, 0) || 1
    return {
      segments: segs.map(seg => ({ ...seg, widthPct: seg.rawLen / total * 100 })),
      before: 0,
      after: 0,
    }
  }
  const activeIdx = Math.max(0, segs.findIndex(seg => seg.isActive))
  const start = Math.max(0, Math.min(
    activeIdx - Math.floor(MAX_VISIBLE_CHAPTERS / 2),
    segs.length - MAX_VISIBLE_CHAPTERS,
  ))
  const windowSegs = segs.slice(start, start + MAX_VISIBLE_CHAPTERS)
  const windowTotal = windowSegs.reduce((sum, seg) => sum + seg.rawLen, 0) || 1
  return {
    segments: windowSegs.map(seg => ({ ...seg, widthPct: seg.rawLen / windowTotal * 100 })),
    before: start,
    after: segs.length - (start + MAX_VISIBLE_CHAPTERS),
  }
})

const visibleSegments = computed(() => segmentWindow.value.segments)
const overflowBefore = computed(() => segmentWindow.value.before)
const overflowAfter = computed(() => segmentWindow.value.after)

// Hover tooltip for chapter segments (teleported so the bar can't clip it)
const segmentTip = ref({ visible: false, x: 0, y: 0, text: '' })

const showSegmentTip = (event, text) => {
  const rect = event.currentTarget.getBoundingClientRect()
  segmentTip.value = {
    visible: true,
    x: Math.min(Math.max(rect.left + rect.width / 2, 70), window.innerWidth - 70),
    y: rect.top - 8,
    text,
  }
}

const hideSegmentTip = () => {
  segmentTip.value = { ...segmentTip.value, visible: false }
}

// Chapter menu (opened from the "+N" overflow pills)
const chapterMenuOpen = ref(false)
const chapterMenuX = ref(0)
const chapterMenuRef = ref(null)

const openChapterMenu = async (event) => {
  hideSegmentTip()
  const menuWidth = 280
  chapterMenuX.value = Math.min(
    Math.max(event.clientX - menuWidth / 2, 8),
    window.innerWidth - menuWidth - 8,
  )
  chapterMenuOpen.value = true
  await nextTick()
  chapterMenuRef.value?.querySelector('.chapter-menu-item.active')
    ?.scrollIntoView({ block: 'center', behavior: 'instant' })
}

const closeChapterMenu = () => {
  chapterMenuOpen.value = false
}

const handleSegmentClick = (seg) => {
  if (isIdle.value) return
  seekToChunk(seg.chunkStart)
}

const jumpToChapter = (seg) => {
  closeChapterMenu()
  if (isIdle.value) return
  seekToChunk(seg.chunkStart)
}

const chapterPercent = (seg) => {
  const total = ttsTotalChunks.value
  if (!total) return ''
  return `${Math.round(seg.chunkStart / total * 100)}%`
}

const onDocumentClick = (event) => {
  if (!chapterMenuOpen.value) return
  if (chapterMenuRef.value?.contains(event.target)) return
  if (event.target.closest?.('.chapter-overflow')) return
  closeChapterMenu()
}

const onDocumentKeydown = (event) => {
  if (event.key === 'Escape') closeChapterMenu()
}

const SPEEDS = [0.75, 1.0, 1.25, 1.5, 2.0]

const speedLabel = computed(() => {
  const speed = ttsSpeed.value
  return speed === 1.0 ? '1x' : `${speed}x`
})

const currentBookIndex = computed(() => {
  if (!ttsBook.value) return -1
  return books.value.findIndex(book => book.id === ttsBook.value.id)
})

const hasPreviousBook = computed(() => currentBookIndex.value > 0)
const hasNextBook = computed(() => (
  currentBookIndex.value !== -1 && currentBookIndex.value < books.value.length - 1
))

const cycleSpeed = () => {
  const idx = SPEEDS.indexOf(ttsSpeed.value)
  setSpeed(SPEEDS[(idx + 1) % SPEEDS.length])
}

const handlePlayPause = () => {
  if (ttsStatus.value === 'loading') return
  togglePlay()
}

const hydrateLastSession = () => {
  if (books.value.length) restoreLastSession(books.value)
}

onMounted(() => {
  hydrateLastSession()
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onDocumentKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKeydown)
})

watch(books, hydrateLastSession, { immediate: true })

const playAdjacentBook = (delta) => {
  const nextBook = books.value[currentBookIndex.value + delta]
  if (nextBook) play(nextBook)
}

const handleFavourite = () => {
  if (ttsBook.value) toggleFavourite(ttsBook.value.id)
}

const handleVolume = (val) => {
  isMuted.value = false
  setVolume(Number(val) / 100)
}

const toggleMute = () => {
  if (isMuted.value) {
    setVolume(prevVolume.value)
    isMuted.value = false
  } else {
    prevVolume.value = ttsVolume.value || 1.0
    setVolume(0)
    isMuted.value = true
  }
}

const generateCoverPlaceholder = (title) => {
  const colors = getThemeCssVars([
    { name: '--color-book-cover-placeholder-one', fallback: '#8A2BE2' },
    { name: '--color-book-cover-placeholder-two', fallback: '#6A0DAD' },
    { name: '--color-book-cover-placeholder-three', fallback: '#9370DB' },
    { name: '--color-book-cover-placeholder-four', fallback: '#BA55D3' },
    { name: '--color-book-cover-placeholder-five', fallback: '#DDA0DD' },
  ])
  const hash = [...title].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const color = colors[hash % colors.length]
  const initial = title.trim()[0]?.toUpperCase() || '?'
  const displayTitle = title.length > 18 ? `${title.substring(0, 18)}...` : title
  const softText = getThemeCssVar('--color-book-cover-placeholder-text-soft', 'rgba(255,255,255,0.25)')
  const strongText = getThemeCssVar('--color-book-cover-placeholder-text-strong', 'rgba(255,255,255,0.65)')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="${color}"/><text x="100" y="130" font-family="serif" font-size="100" fill="${softText}" text-anchor="middle" dominant-baseline="middle">${initial}</text><text x="100" y="230" font-family="sans-serif" font-size="11" fill="${strongText}" text-anchor="middle">${displayTitle}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const resolveBookCover = (book) => {
  if (!book.cover) return generateCoverPlaceholder(book.title)
  return book.cover
}

const coverFallback = (event, title) => {
  event.target.src = generateCoverPlaceholder(title)
}
</script>

<style scoped>
.playing-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  box-sizing: border-box;
  height: 90px;
  background: var(--color-background-app);
  border-top: 1px solid var(--color-border-card);
  padding: 0 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 1000;
  overflow: hidden;
}

.icon-btn,
.transport-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-brand-primary);
  width: 34px;
  height: 34px;
  padding: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.16s ease, color 0.16s ease, transform 0.16s ease;
}

.icon-btn {
  color: var(--color-text-muted);
  font-size: 1.1rem;
}

.transport-btn {
  font-size: 1.42rem;
}

.time-jump-btn {
  font-size: 1.6rem;
}

.icon-btn:hover:not(:disabled),
.transport-btn:hover:not(:disabled) {
  color: var(--color-brand-primary-hover);
  background: var(--color-brand-primary-soft);
}

.transport-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.icon-btn:disabled,
.transport-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.track-info {
  display: flex;
  align-items: center;
  flex: 0 0 26%;
  min-width: 0;
  overflow: hidden;
  gap: 0.75rem;
}

.track-link {
  cursor: pointer;
}

.track-link:hover .track-title {
  color: var(--color-brand-primary-hover);
  text-decoration: underline;
}

.album-art {
  width: 45px;
  height: 63px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: var(--shadow-control-subtle);
  transition: opacity 0.15s;
}

.album-art.track-link:hover {
  opacity: 0.85;
}

.album-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.track-details {
  overflow: hidden;
  flex: 1;
}

.track-title {
  font-size: 0.875rem;
  font-weight: 400;
  color: var(--color-text-primary);
  margin: 0 0 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.artist-name {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.idle-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-text-subtle);
  font-size: 0.875rem;
}

.idle-info i {
  font-size: 1.25rem;
}

.like-btn:hover:not(:disabled) {
  color: var(--color-status-danger) !important;
}

.player-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;
  min-width: 0;
  max-width: 680px;
  gap: 0.35rem;
}

.time-display {
  display: grid;
  grid-template-columns: max-content minmax(180px, 1fr) max-content;
  align-items: center;
  column-gap: 0.45rem;
  width: min(640px, 100%);
  color: var(--color-text-secondary);
  font-size: 0.78rem;
}

.time-display span {
  white-space: nowrap;
  line-height: 1;
}

.time-display span:first-child {
  text-align: right;
}

.time-display span:last-child {
  text-align: left;
}

.time-progress-track {
  height: 4px;
  border-radius: 999px;
  background: var(--color-border-strong);
  overflow: hidden;
}

.time-progress-track.has-chapters {
  display: flex;
  align-items: center;
  height: 14px;
  border-radius: 3px;
  gap: 3px;
  overflow: visible;
  background: transparent;
}

.time-progress-fill {
  height: 100%;
  min-width: 2px;
  border-radius: inherit;
  background: var(--color-brand-primary);
  transition: width 0.3s ease;
}

.chapter-segment {
  flex: 0 1 auto;
  height: 4px;
  border-radius: 3px;
  background: var(--color-border-strong);
  overflow: hidden;
  position: relative;
  transition: height 0.15s ease;
  min-width: 8px;
  cursor: pointer;
}

.chapter-segment:hover {
  height: 7px;
}

.chapter-segment.active {
  height: 7px;
}

.chapter-segment-fill {
  position: absolute;
  inset: 0;
  width: 0%;
  background: var(--color-brand-primary);
  border-radius: inherit;
  transition: width 0.3s ease;
}

.chapter-overflow {
  flex: 0 0 auto;
  min-width: 28px;
  height: 14px;
  padding: 0 6px;
  border: 1px solid var(--color-border-strong);
  border-radius: 999px;
  background: var(--color-surface-card);
  color: var(--color-text-muted);
  font-size: 0.6rem;
  font-weight: 600;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.chapter-overflow.past {
  background: var(--color-brand-primary-soft);
  border-color: var(--color-brand-primary-soft);
  color: var(--color-brand-primary);
}

.chapter-overflow:hover {
  border-color: var(--color-brand-primary);
  color: var(--color-brand-primary);
}

.chapter-tooltip {
  position: fixed;
  z-index: 1200;
  transform: translate(-50%, -100%);
  max-width: 280px;
  padding: 0.35rem 0.6rem;
  background: var(--color-text-primary);
  color: var(--color-surface-primary);
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.3;
  border-radius: 6px;
  box-shadow: var(--shadow-modal);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}

.chapter-menu {
  position: fixed;
  bottom: calc(var(--layout-playing-bar-height, 90px) + 10px);
  z-index: 1200;
  width: 280px;
  background: var(--color-surface-primary);
  border: 1px solid var(--color-border-card);
  border-radius: 12px;
  box-shadow: var(--shadow-modal);
  overflow: hidden;
}

.chapter-menu-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 0.9rem 0.5rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-primary);
  border-bottom: 1px solid var(--color-border-subtle);
}

.chapter-menu-count {
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--color-text-muted);
  background: var(--color-surface-tertiary);
  border-radius: 999px;
  padding: 0.1rem 0.5rem;
}

.chapter-menu-list {
  max-height: 280px;
  overflow-y: auto;
  padding: 0.3rem;
}

.chapter-menu-item {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) max-content;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.45rem 0.55rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.chapter-menu-item:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.chapter-menu-item.active {
  background: var(--purple-li-active);
  color: var(--color-brand-primary);
  font-weight: 500;
}

.chapter-menu-item.past:not(.active) {
  color: var(--color-text-muted);
}

.chapter-menu-num {
  font-size: 0.7rem;
  color: var(--color-text-subtle);
  text-align: right;
}

.chapter-menu-item.active .chapter-menu-num {
  color: var(--color-brand-primary);
}

.chapter-menu-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chapter-menu-pct {
  font-size: 0.68rem;
  color: var(--color-text-subtle);
}

.chapter-menu-icon {
  font-size: 0.85rem;
}

.control-buttons {
  display: grid;
  grid-template-columns: repeat(3, 38px) 48px repeat(3, 38px);
  align-items: center;
  justify-content: center;
  gap: 0.78rem;
}

.play-btn {
  background: transparent;
  color: var(--color-brand-primary-hover);
  border: none;
  border-radius: 50%;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 2rem;
  transition: transform 0.15s, background 0.15s, color 0.15s;
  flex-shrink: 0;
}

.play-btn:hover:not(:disabled) {
  background: var(--color-brand-primary-soft);
  color: var(--color-brand-primary-hover);
  transform: scale(1.04);
}

.play-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.extra-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 0 0 26%;
  min-width: 0;
  overflow: hidden;
  gap: 0.4rem;
}

.speed-btn {
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 400;
  min-width: 36px;
  padding: 4px 6px;
}

.voice-select-wrap {
  max-width: 100px;
  overflow: hidden;
}

.voice-select {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border-card);
  border-radius: 4px;
  padding: 3px 4px;
  background: var(--color-surface-card);
  cursor: pointer;
  max-width: 100px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.voice-select:disabled {
  opacity: 0.4;
  cursor: default;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.volume-slider-wrapper {
  position: relative;
  width: 70px;
  height: 4px;
  background: var(--color-border-subtle);
  border-radius: 2px;
  cursor: pointer;
}

.volume-slider {
  position: absolute;
  top: -8px;
  left: 0;
  width: 100%;
  height: 20px;
  opacity: 0;
  cursor: pointer;
  z-index: 2;
  margin: 0;
}

.volume-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--color-brand-primary);
  border-radius: 2px;
  pointer-events: none;
}

.volume-slider-wrapper:hover .volume-fill {
  background: var(--color-brand-primary-hover);
}

.spinner {
  display: inline-block;
  animation: spin 0.85s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .extra-controls {
    display: none;
  }

  .track-info {
    flex: 0 0 34%;
  }

  .control-buttons {
    gap: 0.35rem;
    grid-template-columns: repeat(3, 32px) 42px repeat(3, 32px);
  }

  .transport-btn {
    width: 30px;
    height: 30px;
    font-size: 1.2rem;
  }
}

@media (max-width: 500px) {
  .album-art {
    display: none;
  }

  .track-info {
    flex: 0 1 auto;
  }
}
</style>
