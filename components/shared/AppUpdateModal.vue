<template>
  <Teleport to="body">
    <Transition name="update-modal">
      <!-- A tap outside must not close the dialog mid-download: the transfer
           would carry on with nothing left on screen reporting it. -->
      <div
        v-if="available"
        class="update-overlay"
        @click.self="available.mandatory || busy ? null : dismiss()"
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

          <!-- Downloading in the app: our own progress, so the user never has
               to go and find the file in the browser's downloads. -->
          <div v-if="busy" class="update-progress" role="status" aria-live="polite">
            <div class="progress-track">
              <div
                class="progress-fill"
                :class="{ indeterminate: install.status === 'downloading' && !install.totalBytes }"
                :style="install.totalBytes ? { width: `${install.percent}%` } : null"
              ></div>
            </div>
            <p class="progress-label">
              <template v-if="install.status === 'opening'">Opening the installer…</template>
              <template v-else-if="install.totalBytes">
                Downloading {{ install.percent }}% · {{ formatMb(install.receivedBytes) }} of {{ formatMb(install.totalBytes) }}
              </template>
              <template v-else>Downloading…</template>
            </p>
          </div>

          <!-- Android 8+ keeps a per-app "install unknown apps" toggle that the
               user has to grant themselves; without it the installer never
               appears and nothing explains why. -->
          <p v-else-if="install.status === 'needs-permission'" class="update-hint warn">
            {{ install.message }} Turn on “Allow from this source”, then tap Update again.
          </p>

          <p v-else-if="install.status === 'error'" class="update-hint warn">
            {{ install.message }}
          </p>

          <p v-else class="update-hint">
            <template v-if="inAppCapable">
              Downloads in the app. Android will ask you to confirm the install.
            </template>
            <template v-else>
              The download opens in your browser. Tap it when it finishes to install.
            </template>
          </p>

          <div v-if="!busy" class="update-actions" :class="{ single: available.mandatory }">
            <!-- "Later" holds only for this app session: the prompt is back the
                 next time the app is opened from cold, but task-switching away
                 and back will not bring it straight back. -->
            <button
              v-if="!available.mandatory"
              type="button"
              class="update-btn secondary"
              @click="dismiss"
            >
              Later
            </button>

            <button
              v-if="install.status === 'needs-permission'"
              type="button"
              class="update-btn primary"
              @click="openInstallSettings"
            >
              Open settings
            </button>
            <!-- In-app path is a button; everything else keeps the real link,
                 because Capacitor turns an external navigation into an
                 ACTION_VIEW intent and window.open is a no-op in the WebView. -->
            <button
              v-else-if="inAppCapable"
              type="button"
              class="update-btn primary"
              @click="startUpdate"
            >
              {{ install.status === 'error' ? 'Try again' : 'Update' }}
            </button>
            <a
              v-else
              class="update-btn primary"
              :href="available.apkUrl"
              rel="noopener noreferrer"
              @click="dismiss"
            >
              Update
            </a>
          </div>

          <!-- Kept, but demoted: skipping is permanent for this version, which
               is a bigger decision than "not now". -->
          <button
            v-if="!available.mandatory && !busy"
            type="button"
            class="update-skip-link"
            @click="skip"
          >
            Skip this version
          </button>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useAppUpdate } from '~/composables/useAppUpdate'
import { useApkUpdateInstall } from '~/composables/useApkUpdateInstall'

const { available, installed, skip, dismiss } = useAppUpdate()
const {
  state: install,
  canInstallInApp,
  downloadAndInstall,
  openInstallSettings,
  reset,
} = useApkUpdateInstall()

const installedName = computed(() => installed.value?.name || '')

// Only native builds carrying the installer plugin download in-app; everything
// else keeps the browser hand-off rather than showing a button that can't work.
const inAppCapable = ref(false)
onMounted(async () => { inAppCapable.value = await canInstallInApp() })

const busy = computed(() => ['downloading', 'opening'].includes(install.value.status))

// A fresh prompt should not inherit the previous attempt's error or progress.
watch(available, (next) => { if (next) reset() })

const startUpdate = () => downloadAndInstall(available.value)

const formatMb = (bytes) => `${(Number(bytes || 0) / (1024 * 1024)).toFixed(1)} MB`
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

.update-hint.warn {
  color: var(--color-text-secondary);
}

.update-progress {
  margin-top: 4px;
}

.progress-track {
  overflow: hidden;
  height: 6px;
  border-radius: 999px;
  background: var(--color-surface-secondary);
}

.progress-fill {
  width: 0;
  height: 100%;
  border-radius: 999px;
  background: var(--color-brand-primary);
  transition: width 0.2s ease;
}

/* No content-length means no honest percentage — sweep instead of inventing
   one, so the bar never sits at a number that isn't real. */
.progress-fill.indeterminate {
  width: 40%;
  animation: update-sweep 1.1s ease-in-out infinite;
}

@keyframes update-sweep {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(250%); }
}

.progress-label {
  margin: 10px 0 0;
  color: var(--color-text-muted);
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .progress-fill { transition: none; }
  .progress-fill.indeterminate { animation: none; width: 100%; opacity: 0.55; }
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

.update-skip-link {
  display: block;
  width: 100%;
  margin-top: 10px;
  padding: 6px 0;
  border: 0;
  background: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.8rem;
  text-decoration: underline;
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
