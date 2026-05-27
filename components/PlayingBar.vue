<template>
  <div class="playing-bar">
    <div class="track-info">
      <template v-if="ttsBook">
        <div class="album-art">
          <img
            :src="resolveBookCover(ttsBook)"
            :alt="ttsBook.title"
            @error="(e) => coverFallback(e, ttsBook.title)"
          />
        </div>
        <div class="track-details">
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
        <div class="time-progress-track">
          <div class="time-progress-fill" :style="{ width: `${ttsProgress || 0}%` }"></div>
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

      <div class="voice-select-wrap" v-if="ttsVoices.length > 0">
        <select
          class="voice-select"
          :value="ttsVoiceId"
          :disabled="isIdle"
          @change="setVoice($event.target.value)"
        >
          <option v-for="v in ttsVoices" :key="v.id" :value="v.id">{{ v.name }}</option>
        </select>
      </div>

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
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useTTS } from '~/composables/useTTS'
import { useBooks } from '~/composables/useBooks'

const {
  ttsBook, ttsStatus, ttsSpeed, ttsVolume,
  ttsVoiceId, ttsVoices, ttsProgress,
  elapsedTime, totalTime,
  play, togglePlay, skipChunks, skipSeconds, setSpeed, setVolume, setVoice,
} = useTTS()

const { books, toggleFavourite } = useBooks()

const isIdle = computed(() => ttsStatus.value === 'idle')
const isMuted = ref(false)
const prevVolume = ref(1.0)

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
  background: var(--color-surface-primary);
  border-top: 1px solid var(--color-border-subtle);
  padding: 0 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 1000;
  box-shadow: var(--shadow-card-subtle);
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

.album-art {
  width: 45px;
  height: 63px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: var(--shadow-control-subtle);
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

.time-progress-fill {
  height: 100%;
  min-width: 2px;
  border-radius: inherit;
  background: var(--color-brand-primary);
  transition: width 0.3s ease;
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
  border: 1px solid var(--color-border-subtle);
  border-radius: 4px;
  padding: 3px 4px;
  background: var(--color-surface-primary);
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
