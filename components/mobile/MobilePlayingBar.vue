<template>
  <Transition name="mini-bar">
    <div
      v-if="visible"
      class="mobile-playing-bar"
      :class="{ 'above-nav': hasBottomNav }"
      role="button"
      tabindex="0"
      aria-label="Open the reader at the current narration"
      @click="openReader"
      @keydown.enter="openReader"
    >
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
</template>

<script setup>
import { computed } from 'vue'
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
} = useTTS()

// Tab roots render the bottom nav; detail pages don't — the bar hugs
// whichever edge is actually free.
const NAV_ROUTES = new Set(['/', '/books', '/series', '/favourites', '/playlists'])

const hasBottomNav = computed(() => NAV_ROUTES.has(route.path))

const visible = computed(() => (
  !!ttsBook.value
  && ttsStatus.value !== 'idle'
  && !route.path.startsWith('/reader')
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

// Jump into the reader — narration keeps playing, and the reader scrolls to
// the sentence being read.
const openReader = () => {
  if (!ttsBook.value?.id) return
  router.push(`/reader/${ttsBook.value.id}`)
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
  border-radius: 12px;
  background: var(--color-surface-inverse, #111827);
  color: #fff;
  cursor: pointer;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.38);
}

.mobile-playing-bar.above-nav {
  bottom: calc(var(--mobile-bottom-nav-height, 72px) + env(safe-area-inset-bottom) + 10px);
}

.bar-cover {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.08);
}

.bar-info {
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
  color: rgba(255, 255, 255, 0.66);
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bar-play {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  justify-self: end;
  border: 0;
  border-radius: 50%;
  background: #fff;
  color: #111827;
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
  height: 3px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
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
