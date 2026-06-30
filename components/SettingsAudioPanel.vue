<template>
  <article class="settings-panel audio-panel">
    <div class="panel-heading">
      <i class="ri-headphone-line"></i>
      <div>
        <h2>Audio</h2>
        <p>Read-aloud defaults for the player bar.</p>
      </div>
    </div>

    <div class="setting-row">
      <div class="setting-copy">
        <h3>Narrator voice</h3>
        <p>{{ currentVoiceName }}</p>
      </div>
      <BookishSelect
        :model-value="settings.ttsVoice"
        :options="ttsVoices.map(voice => ({ value: voice.id, label: voice.name }))"
        @update:model-value="setAudioVoice"
      />
    </div>

    <div class="setting-row">
      <div class="setting-copy">
        <h3>Playback speed</h3>
        <p>{{ settings.ttsSpeed }}x default speed.</p>
      </div>
      <div class="chip-group" aria-label="Playback speed">
        <button
          v-for="speed in speedOptions"
          :key="speed"
          :class="{ active: settings.ttsSpeed === speed }"
          @click="setAudioSpeed(speed)"
        >
          {{ speed === 1 ? '1x' : `${speed}x` }}
        </button>
      </div>
    </div>

    <div class="setting-row">
      <div class="setting-copy">
        <h3>Volume</h3>
        <p>{{ Math.round(settings.ttsVolume * 100) }}% player volume.</p>
      </div>
      <div class="range-control">
        <i class="ri-volume-down-line"></i>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="settings.ttsVolume"
          @input="setAudioVolume($event.target.value)"
        />
        <i class="ri-volume-up-line"></i>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { useBookishSettings } from '~/composables/useBookishSettings'
import { useTTS } from '~/composables/useTTS'

const { settings, updateSettings } = useBookishSettings()
const { ttsVoices, setSpeed, setVolume, setVoice } = useTTS()
const speedOptions = [0.75, 1, 1.25, 1.5, 2]

const currentVoiceName = computed(() => {
  return ttsVoices.value.find(voice => voice.id === settings.value.ttsVoice)?.name || 'Default narrator'
})

const setAudioVoice = (ttsVoice) => {
  setVoice(ttsVoice)
}

const setAudioSpeed = (ttsSpeed) => {
  updateSettings({ ttsSpeed })
  setSpeed(ttsSpeed)
}

const setAudioVolume = (value) => {
  const ttsVolume = Number(value)
  updateSettings({ ttsVolume })
  setVolume(ttsVolume)
}
</script>

<style scoped>
.settings-panel {
  padding: 1.25rem;
  min-width: 0;
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-card);
  border-radius: 10px;
}

.panel-heading {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border-subtle);
  min-width: 0;
}

.panel-heading > i {
  width: 46px;
  height: 46px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-brand-primary-muted);
  color: var(--color-brand-primary);
  font-size: 1.2rem;
  flex-shrink: 0;
}

.panel-heading h2,
.setting-copy h3 {
  color: var(--color-text-primary);
  margin: 0;
}

.panel-heading h2 {
  font-size: 1.25rem;
}

.panel-heading p,
.setting-copy p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.95rem;
  line-height: 1.45;
}

.setting-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, auto);
  gap: 1rem;
  align-items: center;
  padding: 1.35rem 0;
  border-bottom: 1px solid var(--color-border-subtle);
}

.setting-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.setting-copy {
  min-width: 0;
}

.setting-copy h3 {
  font-size: 1rem;
  margin-bottom: 0.2rem;
}

.chip-group {
  display: inline-flex;
  justify-content: flex-end;
  gap: 0.35rem;
  flex-wrap: wrap;
  min-width: 0;
}

.chip-group button {
  min-height: 45px;
  border: 1px solid var(--color-border-card);
  background: var(--color-surface-card);
  color: var(--color-text-muted);
  border-radius: 8px;
  padding: 0 1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
}

.chip-group button:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.chip-group button.active {
  background: var(--purple-li-active);
  border-color: var(--color-brand-primary);
  color: var(--color-brand-primary);
}

.range-control {
  width: min(280px, 100%);
  display: grid;
  grid-template-columns: 20px minmax(120px, 1fr) 20px;
  align-items: center;
  gap: 0.55rem;
  color: var(--color-text-muted);
}

.range-control input {
  width: 100%;
  accent-color: var(--color-brand-primary);
}

@media (max-width: 760px) {
  .settings-panel {
    padding: 1rem;
  }

  .setting-row {
    grid-template-columns: 1fr;
  }

  .chip-group {
    justify-content: flex-start;
  }

  .range-control {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .settings-panel {
    border-radius: 7px;
    padding: 0.8rem;
  }

  .panel-heading {
    align-items: flex-start;
    gap: 0.65rem;
  }

  .setting-row {
    gap: 0.75rem;
  }

  .chip-group {
    display: grid;
    grid-template-columns: 1fr;
    width: 100%;
  }

  .chip-group button {
    width: 100%;
    min-width: 0;
  }

  .range-control {
    grid-template-columns: 16px minmax(0, 1fr) 16px;
    gap: 0.35rem;
  }
}
</style>
