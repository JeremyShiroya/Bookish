<template>
  <!-- No backdrop dismissal and no close button: the choice decides what the
       device scan is even allowed to import, so it has to be answered before
       the library fills up. "Both" is right there for anyone who does not care. -->
  <div class="format-overlay" role="presentation">
    <section
      class="format-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="format-choice-title"
    >
      <header>
        <i class="ri-book-2-line"></i>
        <h2 id="format-choice-title">What should Pages read?</h2>
        <p>
          Pages only looks for the formats you pick here. You can change this later
          in Settings → Preferences.
        </p>
      </header>

      <div class="format-options" role="group" aria-label="Book formats">
        <button
          v-for="option in options"
          :key="option.mode"
          type="button"
          class="format-option"
          :class="{ selected: chosen === option.mode }"
          :disabled="saving"
          @click="chosen = option.mode"
        >
          <span class="option-icon"><i :class="option.icon"></i></span>
          <span class="option-copy">
            <strong>{{ option.label }}</strong>
            <small>{{ option.hint }}</small>
          </span>
          <i v-if="chosen === option.mode" class="ri-check-line option-tick"></i>
        </button>
      </div>

      <button type="button" class="format-confirm" :disabled="saving" @click="confirm">
        {{ saving ? 'Setting up…' : 'Continue' }}
      </button>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { enabledFormatsForMode, useBookishSettings } from '~/composables/useBookishSettings'
import { useFormatEnablement } from '~/composables/useFormatEnablement'

const emit = defineEmits(['done'])

const { updateSettings } = useBookishSettings()
const { applyFormatMode } = useFormatEnablement()

const options = [
  {
    mode: 'both',
    icon: 'ri-book-shelf-line',
    label: 'Everything',
    hint: 'Read EPUBs and PDFs',
  },
  {
    mode: 'epub',
    icon: 'ri-book-open-line',
    label: 'EPUB only',
    hint: 'An ebook reader — PDFs are ignored',
  },
  {
    mode: 'pdf',
    icon: 'ri-file-pdf-2-line',
    label: 'PDF only',
    hint: 'A document reader — EPUBs are ignored',
  },
]

const chosen = ref('both')
const saving = ref(false)

const confirm = async () => {
  if (saving.value) return
  saving.value = true
  try {
    await applyFormatMode(chosen.value)
  } catch (error) {
    console.error('[Formats] Could not apply the first-boot format choice:', error)
    // Fallback: make sure format choice is marked as made even if scan threw error
    updateSettings({
      enabledFormats: enabledFormatsForMode(chosen.value),
      formatFilter: 'all',
      formatChoiceMade: true,
    })
  } finally {
    saving.value = false
    emit('done')
  }
}
</script>

<style scoped>
.format-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: grid;
  align-items: end;
  padding: 0;
  background: rgba(15, 23, 42, 0.4);
}

.format-sheet {
  width: 100%;
  padding: 1.4rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom));
  border-radius: 20px 20px 0 0;
  background: var(--color-background-app);
  box-shadow: var(--shadow-modal);
}

.format-sheet header {
  margin-bottom: 1.1rem;
  text-align: center;
}

.format-sheet header i {
  color: var(--color-brand-primary);
  font-size: 1.9rem;
}

.format-sheet h2 {
  margin: 0.4rem 0 0.3rem;
  color: var(--color-text-primary);
  font-size: 1.15rem;
}

.format-sheet header p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.84rem;
  line-height: 1.45;
}

.format-options {
  display: grid;
  gap: 0.5rem;
  margin-bottom: 1.1rem;
}

.format-option {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  width: 100%;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--color-border-card);
  border-radius: 14px;
  background: var(--color-surface-card);
  color: var(--color-text-primary);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;
}

.format-option.selected {
  border-color: var(--color-brand-primary);
  background: var(--color-brand-primary-faint);
}

.option-icon {
  display: grid;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 11px;
  background: var(--color-surface-hover);
  color: var(--color-brand-primary);
  font-size: 1.15rem;
}

.option-copy {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.option-copy strong {
  font-size: 0.94rem;
  font-weight: 600;
}

.option-copy small {
  color: var(--color-text-muted);
  font-size: 0.78rem;
}

.option-tick {
  margin-left: auto;
  color: var(--color-brand-primary);
  font-size: 1.15rem;
}

.format-confirm {
  width: 100%;
  min-height: 46px;
  border: 0;
  border-radius: 13px;
  background: var(--color-brand-primary);
  color: var(--color-text-on-brand);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 600;
}

.format-confirm:disabled {
  opacity: 0.6;
  cursor: default;
}

@media (min-width: 640px) {
  .format-overlay {
    align-items: center;
    justify-items: center;
    padding: 1.5rem;
  }

  .format-sheet {
    max-width: 420px;
    border-radius: 20px;
    padding-bottom: 1.25rem;
  }
}
</style>
