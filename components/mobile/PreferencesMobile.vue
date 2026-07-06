<template>
  <div class="preferences">
    <MobileSettingsNav title="Preferences" back-to="/settings" aria-label="Settings navigation" />

    <div class="preferences-body">
      <!-- Series cards -->
      <section class="pref-group">
        <h2 class="pref-group-title">Series cards</h2>

        <div class="pref-block">
          <div class="pref-copy">
            <span class="pref-label">Background</span>
            <span class="pref-hint">Plain surface, or a blurred cover image.</span>
          </div>
          <div class="option-grid">
            <button
              v-for="opt in backgroundOptions"
              :key="opt.value"
              type="button"
              class="option"
              :class="{ active: settings.seriesCardBackground === opt.value }"
              @click="set('seriesCardBackground', opt.value)"
            >
              <span class="preview">
                <SeriesPreview layout="fan" :background="opt.value" />
              </span>
              <span class="option-label">{{ opt.label }}<i v-if="settings.seriesCardBackground === opt.value" class="ri-check-line"></i></span>
            </button>
          </div>
        </div>

        <div class="pref-block">
          <div class="pref-copy">
            <span class="pref-label">Layout</span>
            <span class="pref-hint">Fanned covers, or the playlist-style card.</span>
          </div>
          <div class="option-grid">
            <button
              v-for="opt in seriesLayoutOptions"
              :key="opt.value"
              type="button"
              class="option"
              :class="{ active: settings.seriesCardLayout === opt.value }"
              @click="set('seriesCardLayout', opt.value)"
            >
              <span class="preview">
                <SeriesPreview :layout="opt.value" :background="settings.seriesCardBackground" />
              </span>
              <span class="option-label">{{ opt.label }}<i v-if="settings.seriesCardLayout === opt.value" class="ri-check-line"></i></span>
            </button>
          </div>
        </div>
      </section>

      <!-- Favourites cards -->
      <section class="pref-group">
        <h2 class="pref-group-title">Favourites cards</h2>

        <div class="pref-block">
          <div class="pref-copy">
            <span class="pref-label">Background</span>
            <span class="pref-hint">Blurred cover image, or a plain card.</span>
          </div>
          <div class="option-grid">
            <button
              v-for="opt in favBackgroundOptions"
              :key="opt.value"
              type="button"
              class="option"
              :class="{ active: settings.favouritesCardBackground === opt.value }"
              @click="set('favouritesCardBackground', opt.value)"
            >
              <span class="preview">
                <FavouritePreview layout="grid" :background="opt.value" />
              </span>
              <span class="option-label">{{ opt.label }}<i v-if="settings.favouritesCardBackground === opt.value" class="ri-check-line"></i></span>
            </button>
          </div>
        </div>

        <div class="pref-block">
          <div class="pref-copy">
            <span class="pref-label">Layout</span>
            <span class="pref-hint">A three-up grid, or a single-column list.</span>
          </div>
          <div class="option-grid">
            <button
              v-for="opt in favLayoutOptions"
              :key="opt.value"
              type="button"
              class="option"
              :class="{ active: settings.favouritesCardLayout === opt.value }"
              @click="set('favouritesCardLayout', opt.value)"
            >
              <span class="preview">
                <FavouritePreview :layout="opt.value" :background="settings.favouritesCardBackground" />
              </span>
              <span class="option-label">{{ opt.label }}<i v-if="settings.favouritesCardLayout === opt.value" class="ri-check-line"></i></span>
            </button>
          </div>
        </div>
      </section>

      <!-- Reading -->
      <section class="pref-group">
        <h2 class="pref-group-title">Reading</h2>

        <div class="pref-row">
          <div class="pref-copy">
            <span class="pref-label">Highlight while reading</span>
            <span class="pref-hint">Highlight the sentence being read aloud.</span>
          </div>
          <button
            type="button"
            class="pref-toggle"
            role="switch"
            :aria-checked="settings.readerHighlight !== false"
            :class="{ on: settings.readerHighlight !== false }"
            @click="set('readerHighlight', settings.readerHighlight === false)"
          >
            <span class="knob"></span>
          </button>
        </div>
      </section>

      <!-- Interface -->
      <section class="pref-group">
        <h2 class="pref-group-title">Interface</h2>

        <div class="pref-row">
          <div class="pref-copy">
            <span class="pref-label">Reading streak</span>
            <span class="pref-hint">Show the streak counter in the top bar.</span>
          </div>
          <button
            type="button"
            class="pref-toggle"
            role="switch"
            :aria-checked="settings.showStreak !== false"
            :class="{ on: settings.showStreak !== false }"
            @click="set('showStreak', settings.showStreak === false)"
          >
            <span class="knob"></span>
          </button>
        </div>

        <div class="pref-row">
          <div class="pref-copy">
            <span class="pref-label">Book format</span>
            <span class="pref-hint">Which formats appear in your library.</span>
          </div>
          <div class="segmented" role="group" aria-label="Book format filter">
            <button
              v-for="opt in formatOptions"
              :key="opt.value"
              type="button"
              class="segment"
              :class="{ active: settings.formatFilter === opt.value }"
              @click="set('formatFilter', opt.value)"
            >{{ opt.label }}</button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { useBookishSettings } from '~/composables/useBookishSettings'
import MobileSettingsNav from './MobileSettingsNav.vue'
import FavouritePreview from '../shared/previews/FavouriteCardPreview.vue'
import SeriesPreview from '../shared/previews/SeriesCardPreview.vue'

const { settings, updateSettings } = useBookishSettings()

const set = (key, value) => updateSettings({ [key]: value })

const backgroundOptions = [
  { value: 'blank', label: 'Default' },
  { value: 'blur', label: 'Blur image' },
]
const seriesLayoutOptions = [
  { value: 'fan', label: 'Fanned' },
  { value: 'cover', label: 'Playlist style' },
]
const favBackgroundOptions = [
  { value: 'blur', label: 'Blur image' },
  { value: 'blank', label: 'Default' },
]
const favLayoutOptions = [
  { value: 'grid', label: 'Grid' },
  { value: 'list', label: 'List' },
]
const formatOptions = [
  { value: 'all', label: 'All' },
  { value: 'pdf', label: 'PDF' },
  { value: 'epub', label: 'EPUB' },
]
</script>

<style scoped>
.preferences {
  min-height: 100vh;
  background: var(--color-background-app);
  font-family: var(--mobile-font-family);
}

.preferences-body {
  display: grid;
  gap: 26px;
  padding: 10px var(--mobile-page-padding-inline, 16px) calc(var(--mobile-bottom-nav-height, 72px) + 32px);
}

.pref-group {
  display: grid;
  gap: 14px;
}

.pref-group-title {
  margin: 0 2px;
  color: var(--color-text-muted);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* Block = a label + a row of visual option cards. */
.pref-block {
  display: grid;
  gap: 10px;
}

.pref-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.pref-label {
  color: var(--color-text-primary);
  font-size: 15.5px;
}

.pref-hint {
  color: var(--color-text-muted);
  font-size: 12.5px;
  line-height: 1.35;
}

.option-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.option {
  display: grid;
  gap: 8px;
  padding: 8px;
  border: 2px solid var(--color-border-card);
  border-radius: 14px;
  background: var(--color-surface-card, var(--color-surface-secondary));
  cursor: pointer;
  transition: border-color 0.18s ease, transform 0.12s ease;
}

.option:active {
  transform: scale(0.98);
}

.option.active {
  border-color: var(--color-brand-primary);
}

.preview {
  display: block;
  height: 92px;
  overflow: hidden;
  border-radius: 9px;
}

.option-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 500;
}

.option.active .option-label {
  color: var(--color-brand-primary);
}

.option-label i {
  font-size: 15px;
}

/* Simple rows for toggles / format. */
.pref-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 4px;
  border-bottom: 1px solid var(--color-border-subtle);
}

.pref-group .pref-row:last-child {
  border-bottom: 0;
}

.segmented {
  display: inline-flex;
  flex: 0 0 auto;
  padding: 3px;
  border-radius: 10px;
  background: var(--color-surface-secondary);
}

.segment {
  min-height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  transition: background 0.18s ease, color 0.18s ease;
}

.segment.active {
  background: var(--color-brand-primary);
  color: #fff;
}

.pref-toggle {
  position: relative;
  flex: 0 0 auto;
  width: 46px;
  height: 27px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: var(--color-border-card);
  cursor: pointer;
  transition: background 0.2s ease;
}

.pref-toggle.on {
  background: var(--color-brand-primary);
}

.pref-toggle .knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 21px;
  height: 21px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 5px rgba(15, 23, 42, 0.25);
  transition: transform 0.2s ease;
}

.pref-toggle.on .knob {
  transform: translateX(19px);
}
</style>
