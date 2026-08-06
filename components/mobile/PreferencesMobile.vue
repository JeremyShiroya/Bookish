<template>
  <div class="preferences">
    <MobileSettingsNav title="Preferences" back-to="/settings" aria-label="Settings navigation" />

    <div class="preferences-body">
      <!-- Series cards -->
      <section class="pref-group">
        <h2 class="pref-group-title">Series cards</h2>

        <!--LAYOUT-->

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

        <!--BACKGROUND-->

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
      </section>

      <!-- Series suggestions -->
      <section class="pref-group">
        <h2 class="pref-group-title">Series suggestions</h2>

        <div class="pref-row">
          <div class="pref-copy">
            <span class="pref-label">Show missing books</span>
            <span class="pref-hint">
              A series detail page counts what you own against the whole series
              ("2/6 books"). Turn this on to see the installments you're missing
              as muted cards, in their place in the reading order.
            </span>
          </div>
          <button
            type="button"
            class="pref-toggle"
            role="switch"
            :aria-checked="settings.seriesSuggestions === true"
            :class="{ on: settings.seriesSuggestions === true }"
            @click="set('seriesSuggestions', settings.seriesSuggestions !== true)"
          >
            <span class="knob"></span>
          </button>
        </div>
      </section>

      <!-- Playlist cards — the same card and the same options as Series cards. -->
      <section class="pref-group">
        <h2 class="pref-group-title">Playlist cards</h2>

        <!--LAYOUT-->

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
              :class="{ active: settings.playlistCardLayout === opt.value }"
              @click="set('playlistCardLayout', opt.value)"
            >
              <span class="preview">
                <SeriesPreview :layout="opt.value" :background="settings.playlistCardBackground" />
              </span>
              <span class="option-label">{{ opt.label }}<i v-if="settings.playlistCardLayout === opt.value" class="ri-check-line"></i></span>
            </button>
          </div>
        </div>
        
        <!--BACKGROUND-->

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
              :class="{ active: settings.playlistCardBackground === opt.value }"
              @click="set('playlistCardBackground', opt.value)"
            >
              <span class="preview">
                <SeriesPreview layout="fan" :background="opt.value" />
              </span>
              <span class="option-label">{{ opt.label }}<i v-if="settings.playlistCardBackground === opt.value" class="ri-check-line"></i></span>
            </button>
          </div>
        </div>

      </section>

      <!-- Reading — same visual-example treatment as the card sections above -->
      <section class="pref-group">
        <h2 class="pref-group-title">Reading</h2>

        <div class="pref-block">
          <div class="pref-copy">
            <span class="pref-label">Highlight while reading</span>
            <span class="pref-hint">Highlight the sentence being read aloud.</span>
          </div>
          <div class="option-grid">
            <button
              v-for="opt in toggleOptions"
              :key="`hl-${opt.value}`"
              type="button"
              class="option"
              :class="{ active: (settings.readerHighlight !== false) === opt.value }"
              @click="set('readerHighlight', opt.value)"
            >
              <span class="preview">
                <ReadingPreview kind="highlight" :on="opt.value" />
              </span>
              <span class="option-label">
                {{ opt.label }}
                <i v-if="(settings.readerHighlight !== false) === opt.value" class="ri-check-line"></i>
              </span>
            </button>
          </div>
        </div>

        <div class="pref-block">
          <div class="pref-copy">
            <span class="pref-label">Blurred cover in Listen mode</span>
            <span class="pref-hint">Soft blurred book cover behind the player.</span>
          </div>
          <div class="option-grid">
            <button
              v-for="opt in toggleOptions"
              :key="`lb-${opt.value}`"
              type="button"
              class="option"
              :class="{ active: (settings.listenCoverBlur !== false) === opt.value }"
              @click="set('listenCoverBlur', opt.value)"
            >
              <span class="preview">
                <ReadingPreview kind="listen" :on="opt.value" />
              </span>
              <span class="option-label">
                {{ opt.value ? 'Blurred cover' : 'Plain' }}
                <i v-if="(settings.listenCoverBlur !== false) === opt.value" class="ri-check-line"></i>
              </span>
            </button>
          </div>
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

        <div v-if="settings.developerMode" class="pref-row">
          <div class="pref-copy">
            <span class="pref-label">Hide content</span>
            <span class="pref-hint">Preview the app as though your library were empty. Nothing is deleted.</span>
          </div>
          <button
            type="button"
            class="pref-toggle"
            role="switch"
            :aria-checked="settings.hideContent === true"
            :class="{ on: settings.hideContent === true }"
            @click="toggleHideContent"
          >
            <span class="knob"></span>
          </button>
        </div>

        <!-- Two separate controls, deliberately. This one HIDES: the app still
             handles both formats, it just shows one. It disappears when only one
             format is enabled below, because then there is nothing to hide. -->
        <div v-if="enabledFormats.length > 1" class="pref-row">
          <div class="pref-copy">
            <span class="pref-label">Book format</span>
            <span class="pref-hint">Which formats appear in your library.</span>
          </div>
          <div class="segmented" role="group" aria-label="Book format filter">
            <button
              v-for="opt in formatFilterOptions"
              :key="opt.value"
              type="button"
              class="segment"
              :class="{ active: settings.formatFilter === opt.value }"
              @click="set('formatFilter', opt.value)"
            >{{ opt.label }}</button>
          </div>
        </div>

        <!-- And this one REMOVES: those books leave the library and the app
             stops detecting the format at all. -->
        <div class="pref-row">
          <div class="pref-copy">
            <span class="pref-label">Formats Pages reads</span>
            <span class="pref-hint">
              Removing a format clears those books from your library and stops Pages
              detecting them at all — even ones added later. Your files stay on your
              device, so turning it back on re-imports them.
            </span>
          </div>
          <div class="segmented" role="group" aria-label="Book formats Pages handles">
            <button
              v-for="opt in formatModeOptions"
              :key="opt.value"
              type="button"
              class="segment"
              :class="{ active: formatMode === opt.value }"
              @click="chooseFormatMode(opt.value)"
            >{{ opt.label }}</button>
          </div>
        </div>
      </section>
    </div>

    <!-- Removing a format destroys library records, so it says how many and what
         survives before doing it. -->
    <div v-if="pendingFormatMode" class="format-confirm-overlay" role="presentation" @click="pendingFormatMode = null">
      <section
        class="format-confirm-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="format-confirm-title"
        @click.stop
      >
        <h2 id="format-confirm-title">{{ pendingFormatTitle }}</h2>
        <p>{{ pendingFormatMessage }}</p>
        <div class="format-confirm-actions">
          <button type="button" class="ghost" @click="pendingFormatMode = null">Cancel</button>
          <button type="button" class="danger" :disabled="applyingFormat" @click="confirmFormatMode">
            {{ applyingFormat ? 'Removing…' : 'Remove' }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { enabledFormatsForMode, useBookishSettings } from '~/composables/useBookishSettings'
import { useBooks } from '~/composables/useBooks'
import { formatLabel, formatsRemovedBy, useFormatEnablement } from '~/composables/useFormatEnablement'
import { useToast } from '~/composables/useToast'
import MobileSettingsNav from './MobileSettingsNav.vue'
import ReadingPreview from '../shared/previews/ReadingPreview.vue'
// Playlist cards offer the same two layouts as series cards, so they share the
// same preview mockup.
import SeriesPreview from '../shared/previews/SeriesCardPreview.vue'

const { settings, updateSettings } = useBookishSettings()
const { addToast } = useToast()

const set = (key, value) => updateSettings({ [key]: value })

// Hide content swaps the in-memory library for an empty one (or back), so
// the change is visible the moment you leave settings — no restart needed.
const toggleHideContent = async () => {
  set('hideContent', settings.value.hideContent !== true)
  const { fetchAllData } = useBooks()
  await fetchAllData(true)
}

const backgroundOptions = [
  { value: 'blank', label: 'Default' },
  { value: 'blur', label: 'Blur image' },
]
const seriesLayoutOptions = [
  { value: 'fan', label: 'Fanned' },
  { value: 'cover', label: 'Playlist style' },
]
// Reading options are booleans, but they're presented as picture choices like
// the card sections rather than as bare switches.
const toggleOptions = [
  { value: true, label: 'On' },
  { value: false, label: 'Off' },
]
// "Book format" — an app-wide HIDE. Only offers formats the app still handles.
const formatFilterOptions = computed(() => [
  { value: 'all', label: 'All' },
  ...enabledFormats.value.map((format) => ({ value: format, label: formatLabel(format) })),
])

// "Formats Pages reads" — the app-level choice. See useFormatEnablement:
// turning one off purges its books and stops the device scanner detecting the
// extension. Not a filter, which is why it is its own row.
const formatModeOptions = [
  { value: 'both', label: 'All' },
  { value: 'pdf', label: 'PDF' },
  { value: 'epub', label: 'EPUB' },
]

const { enabledFormats, formatMode, countAffected, applyFormatMode } = useFormatEnablement()

const pendingFormatMode = ref(null)
const applyingFormat = ref(false)

const pendingFormatTitle = computed(() => {
  const removed = formatsRemovedBy(
    enabledFormatsForMode(formatMode.value),
    enabledFormatsForMode(pendingFormatMode.value),
  )
  return `Remove ${removed.map(formatLabel).join(' and ')} from your library?`
})

const pendingFormatMessage = computed(() => {
  const count = countAffected(enabledFormatsForMode(pendingFormatMode.value))
  const books = count === 1 ? '1 book' : `${count} books`
  return count > 0
    ? `${books} will be cleared from your library, and Pages will stop detecting that format. Your files stay on your device, so turning it back on re-imports them.`
    : 'Pages will stop detecting that format. Your files stay on your device.'
})

const chooseFormatMode = async (mode) => {
  if (mode === formatMode.value) return
  // Only a removal needs confirming; widening the set destroys nothing.
  const removes = formatsRemovedBy(
    enabledFormatsForMode(formatMode.value),
    enabledFormatsForMode(mode),
  ).length > 0
  if (removes) {
    pendingFormatMode.value = mode
    return
  }
  await applyFormatMode(mode)
}

const confirmFormatMode = async () => {
  if (applyingFormat.value || !pendingFormatMode.value) return
  applyingFormat.value = true
  try {
    const { removed } = await applyFormatMode(pendingFormatMode.value)
    addToast(
      removed > 0
        ? `Removed ${removed} book${removed === 1 ? '' : 's'} from your library.`
        : 'Format removed.',
      'success',
    )
  } catch (error) {
    console.error('[Preferences] Could not change the format choice:', error)
    addToast('Could not change the book formats.', 'error')
  } finally {
    applyingFormat.value = false
    pendingFormatMode.value = null
  }
}
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

.format-confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 2500;
  display: grid;
  align-items: end;
  background: rgba(15, 23, 42, 0.4);
}

.format-confirm-sheet {
  width: 100%;
  padding: 1.35rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom));
  border-radius: 20px 20px 0 0;
  background: var(--color-background-app);
  box-shadow: var(--shadow-modal);
}

.format-confirm-sheet h2 {
  margin: 0 0 0.5rem;
  color: var(--color-text-primary);
  font-size: 1.02rem;
}

.format-confirm-sheet p {
  margin: 0 0 1.1rem;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  line-height: 1.5;
}

.format-confirm-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
}

.format-confirm-actions button {
  min-height: 44px;
  border-radius: 12px;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 600;
}

.format-confirm-actions .ghost {
  border: 1px solid var(--color-border-card);
  background: transparent;
  color: var(--color-text-primary);
}

.format-confirm-actions .danger {
  border: 0;
  background: var(--color-status-error, #dc2626);
  color: #fff;
}

.format-confirm-actions .danger:disabled {
  opacity: 0.6;
  cursor: default;
}

@media (min-width: 640px) {
  .format-confirm-overlay {
    align-items: center;
    justify-items: center;
    padding: 1.5rem;
  }

  .format-confirm-sheet {
    max-width: 400px;
    border-radius: 18px;
    padding-bottom: 1.25rem;
  }
}
</style>
