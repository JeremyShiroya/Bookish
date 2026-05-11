<template>
  <div class="playing-bar">

    <!-- Left: Book info -->
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
          <i :class="ttsBook.isFavourite ? 'ri-heart-fill' : 'ri-heart-line'"
             :style="{ color: ttsBook.isFavourite ? '#ef4444' : '' }"></i>
        </button>
      </template>
      <template v-else>
        <div class="idle-info">
          <i class="ri-headphone-line"></i>
          <span>Nothing playing</span>
        </div>
      </template>
    </div>

    <!-- Center: Controls + Progress -->
    <div class="player-controls">
      <div class="control-buttons">
        <button class="icon-btn" title="Skip back" :disabled="isIdle" @click="skipChunks(-10)">
          <i class="ri-skip-back-line"></i>
        </button>
        <button class="play-btn" title="Play / Pause" :disabled="isIdle && !ttsBook" @click="handlePlayPause">
          <i v-if="ttsStatus === 'loading'" class="ri-loader-4-line spinner"></i>
          <i v-else-if="ttsStatus === 'playing'" class="ri-pause-fill"></i>
          <i v-else class="ri-play-fill"></i>
        </button>
        <button class="icon-btn" title="Skip forward" :disabled="isIdle" @click="skipChunks(10)">
          <i class="ri-skip-forward-line"></i>
        </button>
        <button class="icon-btn stop-btn" title="Stop" :disabled="isIdle" @click="stop">
          <i class="ri-stop-fill"></i>
        </button>
      </div>

      <div class="progress-container">
        <span class="time">{{ elapsedTime }}</span>
        <div class="progress-bar-wrapper">
          <input
            type="range"
            min="0"
            max="100"
            :value="ttsProgress"
            class="progress-slider"
            :disabled="isIdle"
            @input="seekToProgress(Number($event.target.value))"
          />
          <div class="progress-fill" :style="{ width: ttsProgress + '%' }"></div>
        </div>
        <span class="time">{{ totalTime }}</span>
      </div>

    </div>

    <!-- Right: Speed, Voice, Volume -->
    <div class="extra-controls">
      <button
        class="icon-btn speed-btn"
        :disabled="isIdle"
        title="Playback speed"
        @click="cycleSpeed"
      >{{ speedLabel }}</button>

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
import { ref, computed, onMounted } from 'vue'
import { useTTS } from '~/composables/useTTS'
import { useBooks } from '~/composables/useBooks'

const {
  ttsBook, ttsStatus, ttsProgress, ttsSpeed, ttsVolume,
  ttsVoiceId, ttsVoices,
  elapsedTime, totalTime,
  togglePlay, stop, skipChunks, setSpeed, setVolume, setVoice,
  seekToProgress, loadVoices,
} = useTTS()

onMounted(() => {
  loadVoices()
})

const { toggleFavourite } = useBooks()

const isIdle = computed(() => ttsStatus.value === 'idle')
const isMuted = ref(false)
const prevVolume = ref(1.0)

const SPEEDS = [0.75, 1.0, 1.25, 1.5, 2.0]

const speedLabel = computed(() => {
  const s = ttsSpeed.value
  return s === 1.0 ? '1×' : s + '×'
})

const cycleSpeed = () => {
  const idx = SPEEDS.indexOf(ttsSpeed.value)
  setSpeed(SPEEDS[(idx + 1) % SPEEDS.length])
}

const handlePlayPause = () => {
  if (ttsStatus.value === 'loading') return
  togglePlay()
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
  const colors = ['#8A2BE2', '#6A0DAD', '#9370DB', '#BA55D3', '#DDA0DD']
  const hash = [...title].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const color = colors[hash % colors.length]
  const initial = title.trim()[0]?.toUpperCase() || '?'
  const displayTitle = title.length > 18 ? title.substring(0, 18) + '…' : title
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="${color}"/><text x="100" y="130" font-family="serif" font-size="100" fill="rgba(255,255,255,0.25)" text-anchor="middle" dominant-baseline="middle">${initial}</text><text x="100" y="230" font-family="sans-serif" font-size="11" fill="rgba(255,255,255,0.65)" text-anchor="middle">${displayTitle}</text></svg>`
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
  box-sizing: border-box; /* padding included in 100% width — prevents overflow */
  height: 90px;
  background: #ffffff;
  border-top: 1px solid #e5e7eb;
  padding: 0 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 1000;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

/* ── Shared icon button ── */
.icon-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #6b7280;
  font-size: 1.1rem;
  padding: 8px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}
.icon-btn:hover:not(:disabled) { color: #1f2937; background: #f3f4f6; }
.icon-btn:disabled { opacity: 0.35; cursor: default; }

/* ── Left: Track info ── */
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
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
.album-art img { width: 100%; height: 100%; object-fit: cover; }

.track-details { overflow: hidden; flex: 1; }
.track-title {
  font-size: 0.875rem;
  font-weight: 400;
  color: #111827;
  margin: 0 0 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.artist-name {
  font-size: 0.75rem;
  color: #6b7280;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.idle-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #9ca3af;
  font-size: 0.875rem;
}
.idle-info i { font-size: 1.25rem; }

.like-btn:hover:not(:disabled) { color: #ef4444 !important; }

/* ── Center: Controls + progress ── */
.player-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  max-width: 560px;
  gap: 0.35rem;
}

.control-buttons {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.play-btn {
  background: #1f2937;
  color: white;
  border: none;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.2rem;
  transition: transform 0.15s, background 0.15s;
  flex-shrink: 0;
}
.play-btn:hover:not(:disabled) { background: #374151; transform: scale(1.05); }
.play-btn:disabled { opacity: 0.4; cursor: default; }

.stop-btn { font-size: 1.2rem; }

.progress-container {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 0.6rem;
}
.time { font-size: 0.7rem; color: #9ca3af; min-width: 32px; text-align: center; }

.progress-bar-wrapper {
  position: relative;
  flex: 1;
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  cursor: pointer;
}
.progress-slider {
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
.progress-slider:disabled { cursor: default; }
.progress-fill {
  position: absolute;
  top: 0; left: 0;
  height: 100%;
  background: #4b5563;
  border-radius: 2px;
  pointer-events: none;
  transition: width 0.3s linear;
}
.progress-bar-wrapper:hover .progress-fill { background: #8A2BE2; }

/* ── Right: Speed / Voice / Volume ── */
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
  letter-spacing: 0.01em;
}

.voice-select-wrap { max-width: 100px; overflow: hidden; }
.voice-select {
  font-size: 0.7rem;
  color: #6b7280;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  padding: 3px 4px;
  background: white;
  cursor: pointer;
  max-width: 100px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.voice-select:disabled { opacity: 0.4; cursor: default; }

.volume-control {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.volume-slider-wrapper {
  position: relative;
  width: 70px;
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  cursor: pointer;
}
.volume-slider {
  position: absolute;
  top: -8px; left: 0;
  width: 100%;
  height: 20px;
  opacity: 0;
  cursor: pointer;
  z-index: 2;
  margin: 0;
}
.volume-fill {
  position: absolute;
  top: 0; left: 0;
  height: 100%;
  background: #4b5563;
  border-radius: 2px;
  pointer-events: none;
}
.volume-slider-wrapper:hover .volume-fill { background: #8A2BE2; }

.spinner { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Responsive ── */
@media (max-width: 768px) {
  .extra-controls { display: none; }
  .track-info { flex: 0 0 38%; }
  .player-controls { flex: 1 1 auto; }
}
@media (max-width: 500px) {
  .album-art { display: none; }
  .track-info { flex: 0 1 auto; }
  .player-controls { flex: 1 1 auto; }
}
</style>
