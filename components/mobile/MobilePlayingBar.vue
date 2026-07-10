<template>
  <Teleport to="body">
    <Transition name="mini-bar">
      <div
        v-if="visible"
        class="mobile-playing-bar"
        :class="{ 'above-nav': hasBottomNav, dragging }"
        :style="swipeStyle"
        role="button"
        tabindex="0"
        aria-label="Open the reader at the current narration"
        @click="openReader"
        @keydown.enter="openReader"
        @touchstart.passive="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        @touchcancel="onTouchEnd"
      >
        <span class="bar-backdrop" aria-hidden="true">
          <img :src="coverUrl" alt="" @error="onCoverError" />
        </span>

        <img
          class="bar-cover"
          :src="coverUrl"
          :alt="ttsBook?.title || 'Book cover'"
          @error="onCoverError"
        />

        <div class="bar-info">
          <span class="bar-title">{{ ttsBook?.title }}</span>
          <span class="bar-subtitle">{{ subtitle }}</span>
        </div>

        <button
          type="button"
          class="bar-play"
          :aria-label="isPlaying ? 'Pause' : 'Play'"
          @click.stop="togglePlay"
        >
          <i :class="isPlaying ? 'ri-pause-fill' : 'ri-play-fill'"></i>
        </button>

        <div class="bar-progress">
          <div class="bar-progress-fill" :style="{ width: `${ttsProgress || 0}%` }"></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTTS } from '~/composables/useTTS'

const route = useRoute()
const router = useRouter()
const {
  ttsBook,
  ttsStatus,
  ttsProgress,
  ttsCurrentChunk,
  elapsedTime,
  totalTime,
  togglePlay,
  stop: stopTTS,
} = useTTS()

// Teleported to <body>, so it can't rely on a layout media query. Gate on the
// viewport here instead — the bar is phone-only chrome.
const isMobile = ref(false)
let _mq = null
const syncViewport = () => { isMobile.value = !!_mq?.matches }

onMounted(() => {
  _mq = window.matchMedia('(max-width: 768px)')
  syncViewport()
  _mq.addEventListener('change', syncViewport)
})
onUnmounted(() => _mq?.removeEventListener('change', syncViewport))

// The mini player only belongs on the main tab roots — never on detail pages
// (book/series/playlist), settings, add/edit, or the reader. All of those are
// simply absent from this whitelist.
const NAV_ROUTES = new Set(['/', '/books', '/series', '/favourites', '/playlists'])

const hasBottomNav = computed(() => NAV_ROUTES.has(route.path))

const visible = computed(() => (
  isMobile.value
  && !!ttsBook.value
  && ttsStatus.value !== 'idle'
  && NAV_ROUTES.has(route.path)
))

const isPlaying = computed(() => ttsStatus.value === 'playing')

const subtitle = computed(() => {
  const clock = totalTime.value && totalTime.value !== '--'
    ? `${elapsedTime.value} / ${totalTime.value}`
    : elapsedTime.value
  const snippet = String(ttsCurrentChunk.value || '').trim()
  return snippet ? `${clock} · ${snippet}` : clock
})

const fallbackCover = computed(() => {
  const initial = (ttsBook.value?.title || '?').trim()[0]?.toUpperCase() || '?'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="10" fill="#8A2BE2"/><text x="40" y="46" font-family="serif" font-size="34" fill="rgba(255,255,255,.6)" text-anchor="middle" dominant-baseline="middle">${initial}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
})

const coverUrl = computed(() => ttsBook.value?.cover || fallbackCover.value)

const onCoverError = (event) => {
  event.target.src = fallbackCover.value
}

// Jump into the reader's Listen mode — narration keeps playing and the player
// is right there, following the sentence being read.
const openReader = () => {
  if (!ttsBook.value?.id) return
  router.push(`/reader/${ttsBook.value.id}?mode=listen`)
}

// ── Swipe to close ──────────────────────────────────────────────────────────
// A horizontal swipe flings the bar off-screen and stops narration.
const SWIPE_DISMISS_PX = 90

const swipeDx = ref(0)
const dragging = ref(false)
let _touchStartX = 0
let _touchStartY = 0
let _swiping = false

const swipeStyle = computed(() => {
  if (!swipeDx.value) return {}
  const opacity = Math.max(0, 1 - Math.abs(swipeDx.value) / 220)
  return { transform: `translateX(${swipeDx.value}px)`, opacity: String(opacity) }
})

const onTouchStart = (event) => {
  const touch = event.touches[0]
  _touchStartX = touch.clientX
  _touchStartY = touch.clientY
  _swiping = false
  dragging.value = false
  swipeDx.value = 0
}

const onTouchMove = (event) => {
  const touch = event.touches[0]
  const dx = touch.clientX - _touchStartX
  const dy = touch.clientY - _touchStartY
  // Lock to horizontal intent so vertical scrolls/taps aren't hijacked.
  if (!_swiping && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
    _swiping = true
    dragging.value = true
  }
  if (_swiping) {
    event.preventDefault()
    swipeDx.value = dx
  }
}

const onTouchEnd = () => {
  dragging.value = false
  const wasSwiping = _swiping
  _swiping = false
  if (wasSwiping && Math.abs(swipeDx.value) > SWIPE_DISMISS_PX) {
    // Fling it fully off the nearest edge, then stop playback (which hides it).
    swipeDx.value = swipeDx.value > 0 ? window.innerWidth : -window.innerWidth
    setTimeout(() => {
      stopTTS()
      swipeDx.value = 0
    }, 220)
  } else {
    swipeDx.value = 0
  }
}
</script>

<style scoped>
.mobile-playing-bar {
  position: fixed;
  right: 10px;
  bottom: calc(env(safe-area-inset-bottom) + 12px);
  left: 10px;
  z-index: 1300;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 44px;
  align-items: center;
  column-gap: 10px;
  overflow: hidden;
  padding: 8px 10px 10px;
  border-radius: 14px;
  /* Album art bleeds through a dark scrim, so the bar reads well in any theme. */
  background: #14121a;
  color: #fff;
  cursor: pointer;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.42);
  touch-action: pan-y;
  transition: transform 0.24s ease, opacity 0.24s ease;
}

/* No transition while the finger is dragging, so the bar tracks it 1:1. */
.mobile-playing-bar.dragging {
  transition: none;
}

.mobile-playing-bar.above-nav {
  bottom: calc(var(--mobile-bottom-nav-height, 72px) + env(safe-area-inset-bottom) + 10px);
}

/* Blurred, color-bleeding cover backdrop with a dark gradient over it. */
.bar-backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
}

.bar-backdrop img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(26px) saturate(1.4);
  transform: scale(1.6);
  opacity: 0.6;
}

.bar-backdrop::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(10, 8, 14, 0.82) 0%, rgba(10, 8, 14, 0.62) 60%, rgba(10, 8, 14, 0.78) 100%);
}

.bar-cover {
  position: relative;
  z-index: 1;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.08);
}

.bar-info {
  position: relative;
  z-index: 1;
  display: grid;
  min-width: 0;
  gap: 2px;
}

.bar-title {
  overflow: hidden;
  color: #fff;
  font-size: 13.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bar-subtitle {
  overflow: hidden;
  color: rgba(255, 255, 255, 0.72);
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bar-play {
  position: relative;
  z-index: 1;
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  justify-self: end;
  border: 0;
  border-radius: 50%;
  background: #fff;
  color: #14121a;
  cursor: pointer;
  font-size: 21px;
}

.bar-play:active {
  transform: scale(0.93);
}

/* Spotify-style hairline progress pinned to the bar's bottom edge. */
.bar-progress {
  position: absolute;
  right: 10px;
  bottom: 4px;
  left: 10px;
  z-index: 1;
  height: 3px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
}

.bar-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--color-brand-primary, #8a2be2);
  transition: width 0.4s linear;
}

.mini-bar-enter-active,
.mini-bar-leave-active {
  transition: transform 0.28s ease, opacity 0.22s ease;
}

.mini-bar-enter-from,
.mini-bar-leave-to {
  opacity: 0;
  transform: translateY(16px);
}
</style>
