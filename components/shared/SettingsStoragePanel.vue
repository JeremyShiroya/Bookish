<template>
  <article class="settings-panel storage-panel">
    <div class="panel-heading">
      <i class="ri-database-2-line"></i>
      <div>
        <h2>Storage</h2>
        <p>Read-only status for locally stored book content.</p>
      </div>
    </div>

    <div class="storage-grid">
      <div class="storage-metric">
        <span>Readable records</span>
        <strong>{{ storageSummary.contentCount }}</strong>
      </div>
      <div class="storage-metric">
        <span>PDF sources</span>
        <strong>{{ storageSummary.sourceCount }}</strong>
      </div>
      <div class="storage-metric">
        <span>Estimated size</span>
        <strong>{{ formattedStorageSize }}</strong>
      </div>
    </div>

    <div class="storage-status-line" :class="{ warning: !storageSummary.available }">
      <i :class="storageSummary.available ? 'ri-shield-check-line' : 'ri-error-warning-line'"></i>
      <span>{{ storageMessage }}</span>
      <button class="icon-action" title="Refresh storage status" @click="refreshStorageSummary">
        <i :class="storageLoading ? 'ri-loader-4-line spin' : 'ri-refresh-line'"></i>
      </button>
    </div>

    <div class="data-portability">
      <div class="setting-copy">
        <h3>Import and export</h3>
        <p>Move your full Pages library, playlists, reading content, audio session, and settings.</p>
      </div>
      <div class="data-actions">
        <button class="data-action primary" :disabled="backupLoading" @click="exportData">
          <i :class="backupLoading ? 'ri-loader-4-line spin' : 'ri-download-2-line'"></i>
          <span>Export</span>
        </button>
        <button class="data-action" :disabled="backupLoading" @click="openImportPicker">
          <i class="ri-upload-2-line"></i>
          <span>Import</span>
        </button>
        <button class="data-action danger" :disabled="wipeLoading" @click="wipeData">
          <i :class="wipeLoading ? 'ri-loader-4-line spin' : 'ri-delete-bin-6-line'"></i>
          <span>Wipe</span>
        </button>
        <input
          ref="importInputRef"
          class="sr-only"
          type="file"
          accept="application/json,.json"
          @change="importData"
        />
      </div>
    </div>

    <div class="server-connection">
      <div class="setting-copy">
        <h3>Server connection</h3>
        <p>
          Web metadata search (Goodreads, Google Books, publisher sites) runs on a
          Pages server. The installed app needs its address; the web app can
          leave this empty.
        </p>
      </div>
      <form class="server-row" @submit.prevent="saveServerUrl">
        <input
          v-model="serverUrlInput"
          class="server-input"
          type="url"
          inputmode="url"
          placeholder="https://your-bookish-server.example"
          aria-label="Pages server URL"
        />
        <button class="data-action primary" type="submit">
          <i class="ri-save-3-line"></i>
          <span>Save</span>
        </button>
      </form>
      <p class="server-hint">
        {{ serverHint }}
      </p>
    </div>
  </article>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  normalizeApiBaseUrl,
  readStoredApiBaseUrl,
  useApiEndpoint,
  writeStoredApiBaseUrl,
} from '~/composables/useApiEndpoint'
import { useBookishSettings } from '~/composables/useBookishSettings'
import { useBooks } from '~/composables/useBooks'
import { useBookStorage } from '~/composables/useBookStorage'
import { useLibraryBackup } from '~/composables/useLibraryBackup'
import { useTTS } from '~/composables/useTTS'
import { useToast } from '~/composables/useToast'

const { fetchAllData } = useBooks()
const { loadSettings } = useBookishSettings()
const { getStorageSummary } = useBookStorage()
const { createDownload, importBookishData, wipeBookishData } = useLibraryBackup()
const { stop: stopTTS } = useTTS()
const { addToast } = useToast()

const { apiBaseUrl: effectiveApiBaseUrl } = useApiEndpoint()
const serverUrlInput = ref(readStoredApiBaseUrl())
const savedServerUrl = ref(serverUrlInput.value)

const serverHint = computed(() => {
  if (savedServerUrl.value) return `Using ${savedServerUrl.value} for web features.`
  if (effectiveApiBaseUrl) return `Using the built-in server address ${effectiveApiBaseUrl}.`
  return 'No server set — web metadata falls back to Open Library and Internet Archive.'
})

const saveServerUrl = () => {
  const normalized = normalizeApiBaseUrl(serverUrlInput.value)
  if (normalized && !/^https?:\/\//i.test(normalized)) {
    addToast('Server URL must start with http:// or https://', 'error')
    return
  }
  writeStoredApiBaseUrl(normalized)
  savedServerUrl.value = normalized
  serverUrlInput.value = normalized
  addToast(normalized ? 'Server URL saved' : 'Server URL cleared', 'success')
}

const storageLoading = ref(false)
const backupLoading = ref(false)
const wipeLoading = ref(false)
const importInputRef = ref(null)
const storageSummary = ref({
  available: true,
  contentCount: 0,
  sourceCount: 0,
  totalBytes: 0,
  error: null,
})

const formattedStorageSize = computed(() => formatBytes(storageSummary.value.totalBytes))

const storageMessage = computed(() => {
  if (!storageSummary.value.available) {
    return storageSummary.value.error || 'Pages cannot inspect local storage right now.'
  }

  if (storageSummary.value.contentCount === 0 && storageSummary.value.sourceCount === 0) {
    return 'No locally cached reading content yet.'
  }

  return 'Local reading content is available for the reader and player.'
})

const refreshStorageSummary = async () => {
  storageLoading.value = true
  try {
    storageSummary.value = await getStorageSummary()
  } finally {
    storageLoading.value = false
  }
}

const exportData = async () => {
  backupLoading.value = true
  let url = null
  try {
    const download = await createDownload()
    url = download.url
    const link = document.createElement('a')
    link.href = download.url
    link.download = download.filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    addToast('Pages backup exported', 'success')
  } catch (error) {
    console.error('[Settings] Failed to export Pages data:', error)
    addToast(error?.message || 'Could not export Pages data', 'error')
  } finally {
    if (url) setTimeout(() => URL.revokeObjectURL(url), 0)
    backupLoading.value = false
  }
}

const openImportPicker = () => {
  importInputRef.value?.click()
}

const importData = async (event) => {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  const confirmed = window.confirm('Importing a backup will replace the current Pages data in this browser. Continue?')
  if (!confirmed) return

  backupLoading.value = true
  try {
    const backup = JSON.parse(await file.text())
    stopTTS()
    await importBookishData(backup)
    loadSettings()
    await fetchAllData(true)
    await refreshStorageSummary()
    addToast('Pages backup imported', 'success')
  } catch (error) {
    console.error('[Settings] Failed to import Pages data:', error)
    addToast(error?.message || 'Could not import Pages backup', 'error')
  } finally {
    backupLoading.value = false
  }
}

const wipeData = async () => {
  const confirmed = window.confirm('This will permanently remove all Pages books, playlists, reading content, progress, audio state, and settings from this browser. Continue?')
  if (!confirmed) return

  wipeLoading.value = true
  try {
    stopTTS()
    await wipeBookishData()
    loadSettings()
    await fetchAllData(true)
    await refreshStorageSummary()
    addToast('Pages data wiped from this browser', 'success')
  } catch (error) {
    console.error('[Settings] Failed to wipe Pages data:', error)
    addToast(error?.message || 'Could not wipe Pages data', 'error')
  } finally {
    wipeLoading.value = false
  }
}

const formatBytes = (bytes) => {
  if (!bytes) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`
}

onMounted(refreshStorageSummary)
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
.setting-copy p,
.storage-metric span {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.95rem;
  line-height: 1.45;
}

.storage-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  padding-top: 1.25rem;
}

.storage-metric {
  min-height: 84px;
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  padding: 1rem;
}

.storage-metric strong {
  display: block;
  color: var(--color-text-primary);
  font-size: 1.35rem;
  line-height: 1;
}

.storage-status-line {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.75rem;
  margin-top: 1.25rem;
  min-height: 58px;
  padding: 0.65rem 0.9rem;
  border-radius: 8px;
  border: 1px solid var(--color-border-card);
  color: var(--color-status-success);
  font-size: 0.95rem;
}

.storage-status-line.warning {
  color: var(--color-status-warning);
}

.icon-action {
  margin-left: auto;
  width: 42px;
  height: 42px;
  border: 1px solid var(--color-border-card);
  border-radius: 8px;
  background: var(--color-surface-card);
  color: var(--color-brand-primary-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s;
}

.icon-action:hover {
  background: var(--color-surface-hover);
}

.data-portability {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-border-subtle);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: center;
}

.data-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.data-action {
  min-height: 45px;
  border: 1px solid var(--color-border-card);
  border-radius: 8px;
  background: var(--color-surface-card);
  color: var(--color-text-secondary);
  padding: 0 0.9rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
}

.data-action:hover:not(:disabled) {
  background: var(--color-surface-hover);
  color: var(--color-brand-primary-hover);
}

.data-action.primary {
  background: var(--color-brand-primary);
  color: var(--color-text-on-brand);
  border-color: var(--color-brand-primary);
}

.data-action.danger {
  color: var(--color-status-danger);
}

.data-action:disabled {
  opacity: 0.55;
  cursor: default;
}

.server-connection {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-border-subtle);
  display: grid;
  gap: 0.75rem;
}

.server-row {
  display: flex;
  gap: 0.45rem;
  align-items: center;
}

.server-input {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 45px;
  padding: 0 0.9rem;
  border: 1px solid var(--color-border-card);
  border-radius: 8px;
  background: var(--color-surface-card);
  color: var(--color-text-primary);
  font-size: 0.95rem;
}

.server-input:focus {
  border-color: var(--color-brand-primary);
  outline: none;
}

.server-hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.spin {
  display: inline-block;
  animation: spin 0.85s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 760px) {
  .settings-panel {
    padding: 16px;
    border-radius: var(--mobile-card-radius);
  }

  .panel-heading {
    gap: 12px;
    padding-bottom: 16px;
  }

  .panel-heading > i {
    width: var(--mobile-list-icon-size);
    height: var(--mobile-list-icon-size);
    font-size: var(--mobile-icon-size);
  }

  .panel-heading h2 {
    font-size: var(--mobile-section-title-size);
    line-height: 1.25;
  }

  .panel-heading p,
  .setting-copy p,
  .storage-metric span {
    font-size: var(--mobile-subtext-size);
  }

  .storage-grid {
    grid-template-columns: 1fr;
    gap: 12px;
    padding-top: 16px;
  }

  .storage-metric {
    min-height: 84px;
    border-radius: var(--mobile-control-radius);
    padding: 16px;
  }

  .storage-metric strong {
    font-size: var(--mobile-title-size);
  }

  .storage-status-line {
    min-height: 58px;
    margin-top: 16px;
    border-radius: var(--mobile-control-radius);
    font-size: var(--mobile-body-size);
  }

  .icon-action {
    width: var(--mobile-touch-target);
    height: var(--mobile-touch-target);
    font-size: 20px;
  }

  .data-portability {
    margin-top: 16px;
    padding-top: 16px;
  }

  .setting-copy h3 {
    font-size: var(--mobile-body-size);
    line-height: 1.25;
  }

  .data-action {
    min-height: var(--mobile-touch-target);
    border-radius: var(--mobile-control-radius);
    font-size: var(--mobile-body-size);
  }
}

@media (max-width: 480px) {
  .settings-panel {
    border-radius: var(--mobile-card-radius);
    padding: 16px;
  }

  .panel-heading {
    align-items: flex-start;
  }

  .storage-status-line {
    align-items: flex-start;
  }

  .data-portability {
    grid-template-columns: 1fr;
  }

  .data-actions {
    display: grid;
    grid-template-columns: 1fr;
    width: 100%;
  }
}
</style>
