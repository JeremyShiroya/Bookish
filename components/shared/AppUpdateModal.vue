<template>
  <Teleport to="body">
    <Transition name="update-modal">
      <div
        v-if="available"
        class="update-overlay"
        @click.self="available.mandatory ? null : dismiss()"
      >
        <section
          class="update-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="update-title"
        >
          <div class="update-icon">
            <i class="ri-download-cloud-2-line"></i>
          </div>

          <h2 id="update-title">Update available</h2>
          <p class="update-version">
            <span class="from">{{ installedName || 'Installed' }}</span>
            <i class="ri-arrow-right-line"></i>
            <span class="to">{{ available.versionName }}</span>
          </p>

          <!-- Notes come from the remote manifest, so they are rendered as
               text. Never swap this for v-html. -->
          <p v-if="available.notes" class="update-notes">{{ available.notes }}</p>

          <p class="update-hint">
            The download opens in your browser. Tap it when it finishes to install.
          </p>

          <div class="update-actions" :class="{ single: available.mandatory }">
            <button
              v-if="!available.mandatory"
              type="button"
              class="update-btn secondary"
              @click="skip"
            >
              Skip this version
            </button>
            <!-- A real link, not a click handler: Capacitor turns an external
                 navigation into an ACTION_VIEW intent, which is the reliable
                 way out of the WebView (window.open is a no-op there). -->
            <a
              class="update-btn primary"
              :href="available.apkUrl"
              rel="noopener noreferrer"
              @click="dismiss"
            >
              Download
            </a>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { useAppUpdate } from '~/composables/useAppUpdate'

const { available, installed, skip, dismiss } = useAppUpdate()

const installedName = computed(() => installed.value?.name || '')
</script>

<style scoped>
.update-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
}

.update-modal {
  width: min(100%, 360px);
  padding: 26px 22px 20px;
  border-radius: 18px;
  background: var(--color-surface-modal);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.35);
  text-align: center;
}

.update-icon {
  display: grid;
  width: 58px;
  height: 58px;
  margin: 0 auto 14px;
  place-items: center;
  border-radius: 16px;
  background: var(--color-brand-primary-faint, rgba(138, 43, 226, 0.12));
  color: var(--color-brand-primary);
  font-size: 28px;
}

.update-modal h2 {
  margin: 0 0 10px;
  color: var(--color-text-primary);
  font-size: 19px;
  font-weight: 600;
  line-height: 1.25;
}

.update-version {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0 0 12px;
  color: var(--color-text-muted);
  font-size: 14px;
}

.update-version .to {
  color: var(--color-brand-primary);
  font-weight: 600;
}

.update-notes {
  margin: 0 0 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--color-surface-secondary);
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.5;
  text-align: left;
  /* Release notes are author-controlled free text — keep newlines, and never
     let a long unbroken string blow out the dialog. */
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 180px;
  overflow-y: auto;
}

.update-hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12.5px;
  line-height: 1.45;
}

.update-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 16px;
}

.update-actions.single {
  grid-template-columns: 1fr;
}

.update-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  border: 0;
  border-radius: 11px;
  cursor: pointer;
  font-size: 14.5px;
  font-weight: 550;
  text-decoration: none;
}

.update-btn.primary {
  background: var(--color-brand-primary);
  color: #fff;
  box-shadow: 0 6px 16px rgba(138, 43, 226, 0.28);
}

.update-btn.secondary {
  background: var(--color-surface-secondary);
  color: var(--color-text-secondary);
}

.update-modal-enter-active,
.update-modal-leave-active {
  transition: opacity 0.22s ease;
}

.update-modal-enter-active .update-modal,
.update-modal-leave-active .update-modal {
  transition: transform 0.22s ease;
}

.update-modal-enter-from,
.update-modal-leave-to {
  opacity: 0;
}

.update-modal-enter-from .update-modal,
.update-modal-leave-to .update-modal {
  transform: translateY(14px) scale(0.97);
}
</style>
