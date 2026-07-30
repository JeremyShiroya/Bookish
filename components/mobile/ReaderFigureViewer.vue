<template>
  <Teleport to="body">
    <div class="figure-overlay" role="dialog" aria-modal="true" aria-label="Figure">
      <button type="button" class="figure-close" aria-label="Close" @click="emit('close')">
        <i class="ri-close-line"></i>
      </button>

      <div
        ref="stageRef"
        class="figure-stage"
        :class="{ zoomed }"
        @touchstart.passive="onTouchStart"
        @touchend="onTouchEnd"
        @click="onTap"
      >
        <img
          :src="figures[index]"
          :alt="`Figure ${index + 1} of ${figures.length}`"
          draggable="false"
        />
      </div>

      <!-- Swiping between the document's figures is how WPS's image preview
           works, so the count doubles as the affordance for it. -->
      <p v-if="figures.length > 1" class="figure-count">
        {{ index + 1 }} / {{ figures.length }}
      </p>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  // Every figure in the book, in reading order, as image sources.
  figures: { type: Array, default: () => [] },
  startIndex: { type: Number, default: 0 },
})

const emit = defineEmits(['close'])

const stageRef = ref(null)
const index = ref(Math.max(0, Math.min(props.figures.length - 1, props.startIndex)))
const zoomed = ref(false)

// Zoom is per figure: moving to the next one starts fitted again.
watch(index, () => {
  zoomed.value = false
  if (stageRef.value) stageRef.value.scrollTo({ top: 0, left: 0 })
})

const SWIPE_DISTANCE = 56

let touchStart = null

const onTouchStart = (event) => {
  if (event.touches.length !== 1) return
  touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY }
}

const onTouchEnd = (event) => {
  const start = touchStart
  touchStart = null
  // While zoomed the gesture is a pan, not a page change — the stage scrolls.
  if (!start || zoomed.value) return

  const touch = event.changedTouches?.[0]
  if (!touch) return
  const dx = touch.clientX - start.x
  const dy = touch.clientY - start.y
  if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dy) > 80) return

  if (dx < 0 && index.value < props.figures.length - 1) index.value += 1
  else if (dx > 0 && index.value > 0) index.value -= 1
}

// Double-tap zooms; a single tap on the backdrop closes. Native scrolling on the
// stage does the panning once zoomed, which is far steadier than reimplementing
// pinch handling over a transform.
let lastTap = 0

const onTap = (event) => {
  const now = Date.now()
  const isDoubleTap = now - lastTap < 300
  lastTap = now

  if (isDoubleTap) {
    zoomed.value = !zoomed.value
    return
  }
  if (event.target?.tagName !== 'IMG') emit('close')
}
</script>

<style scoped>
.figure-overlay {
  position: fixed;
  inset: 0;
  z-index: 3200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(9, 12, 20, 0.94);
}

.figure-close {
  position: absolute;
  top: calc(env(safe-area-inset-top) + 12px);
  right: 14px;
  z-index: 1;
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  cursor: pointer;
  font-size: 22px;
}

.figure-stage {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  overflow: hidden;
  padding: 16px;
}

.figure-stage img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  -webkit-user-select: none;
  user-select: none;
}

.figure-stage.zoomed {
  place-items: start;
  overflow: auto;
  padding: 0;
}

.figure-stage.zoomed img {
  max-width: none;
  max-height: none;
  width: 250%;
}

.figure-count {
  position: absolute;
  bottom: calc(env(safe-area-inset-bottom) + 18px);
  margin: 0;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.8rem;
  letter-spacing: 0.04em;
}
</style>
