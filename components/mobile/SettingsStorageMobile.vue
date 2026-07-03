<template>
  <div class="storage-mobile">
    <!-- Local storage summary -->
    <section class="card">
      <div class="card-head">
        <i class="ri-database-2-line"></i>
        <div>
          <h2>On this device</h2>
          <p>{{ storageMessage }}</p>
        </div>
        <button class="refresh-btn" aria-label="Refresh" @click="refreshStorageSummary">
          <i :class="storageLoading ? 'ri-loader-4-line spin' : 'ri-refresh-line'"></i>
        </button>
      </div>
      <div class="stat-row">
        <div class="stat">
          <strong>{{ storageSummary.contentCount }}</strong>
          <span>Readable books</span>
        </div>
        <div class="stat">
          <strong>{{ storageSummary.sourceCount }}</strong>
          <span>PDF files</span>
        </div>
        <div class="stat">
          <strong>{{ formattedStorageSize }}</strong>
          <span>Space used</span>
        </div>
      </div>
    </section>

    <!-- Metadata backfill -->
    <section class="card">
      <div class="card-head">
        <i class="ri-file-search-line"></i>
        <div>
          <h2>Book details</h2>
          <p>Fill missing covers, blurbs, genres, and years from the web.</p>
        </div>
      </div>

      <div v-if="backfill.running" class="backfill-progress">
        <div class="backfill-progress-labels">
          <span class="backfill-title">{{ backfill.currentTitle }}</span>
          <span class="backfill-count">{{ backfill.current }} / {{ backfill.total }}</span>
        </div>
        <div class="backfill-bar">
          <div class="backfill-fill" :style="{ width: `${backfillPercent}%` }"></div>
        </div>
        <button class="ghost-btn" type="button" @click="stopBackfill">Stop</button>
      </div>

      <template v-else>
        <button class="primary-btn" type="button" @click="startBackfill">
          <i class="ri-download-cloud-2-line"></i>
          Fetch metadata for my library
        </button>
        <p v-if="backfill.finished" class="backfill-summary">
          Updated {{ backfill.updated }} of {{ backfill.total }} book{{ backfill.total === 1 ? '' : 's' }}.
          <button
            v-if="backfill.failures.length"
            class="link-btn"
            type="button"
            @click="showFailures = true"
          >
            View {{ backfill.failures.length }} unsuccessful
          </button>
        </p>
      </template>
    </section>

    <!-- Hidden books -->
    <section class="card">
      <div class="card-head">
        <i class="ri-eye-off-line"></i>
        <div>
          <h2>Hidden books</h2>
          <p>{{ hiddenCount ? `${hiddenCount} book${hiddenCount === 1 ? '' : 's'} hidden from your library.` : 'No books are hidden.' }}</p>
        </div>
      </div>
      <button v-if="hiddenCount" class="secondary-btn" type="button" @click="restoreHidden">
        <i class="ri-eye-line"></i>
        Restore hidden books
      </button>
    </section>

    <!-- Backup -->
    <section class="card">
      <div class="card-head">
        <i class="ri-archive-2-line"></i>
        <div>
          <h2>Backup</h2>
          <p>Move your full library, playlists, progress, and settings.</p>
        </div>
      </div>
      <div class="backup-actions">
        <button class="secondary-btn" :disabled="backupLoading" type="button" @click="exportData">
          <i :class="backupLoading ? 'ri-loader-4-line spin' : 'ri-download-2-line'"></i>
          Export
        </button>
        <button class="secondary-btn" :disabled="backupLoading" type="button" @click="openImportPicker">
          <i class="ri-upload-2-line"></i>
          Import
        </button>
        <button class="secondary-btn danger" :disabled="wipeLoading" type="button" @click="wipeData">
          <i :class="wipeLoading ? 'ri-loader-4-line spin' : 'ri-delete-bin-6-line'"></i>
          Wipe
        </button>
      </div>
      <input
        ref="importInputRef"
        class="sr-only"
        type="file"
        accept="application/json,.json"
        @change="importData"
      />
    </section>

    <!-- Server connection -->
    <section class="card">
      <div class="card-head">
        <i class="ri-server-line"></i>
        <div>
          <h2>Server connection</h2>
          <p>Optional Bookish server for publisher research and AI checks.</p>
        </div>
      </div>
      <form class="server-row" @submit.prevent="saveServerUrl">
        <input
          v-model="serverUrlInput"
          class="server-input"
          type="url"
          inputmode="url"
          placeholder="https://your-bookish-server.example"
          aria-label="Bookish server URL"
        />
        <button class="primary-btn compact" type="submit">Save</button>
      </form>
      <p class="server-hint">{{ serverHint }}</p>
    </section>

    <!-- Unsuccessful lookups modal -->
    <Teleport to="body">
      <div v-if="showFailures" class="failures-overlay" @click.self="showFailures = false">
        <section class="failures-modal" role="dialog" aria-modal="true" aria-label="Unsuccessful metadata lookups">
          <header>
            <h3>Couldn't update {{ backfill.failures.length }} book{{ backfill.failures.length === 1 ? '' : 's' }}</h3>
            <button type="button" aria-label="Close" @click="showFailures = false">
              <i class="ri-close-line"></i>
            </button>
          </header>
          <ul>
            <li v-for="failure in backfill.failures" :key="failure.id">
              <strong>{{ failure.title }}</strong>
              <span>{{ failure.reason }}</span>
            </li>
          </ul>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import {
  normalizeApiBaseUrl,
  readStoredApiBaseUrl,
  useApiEndpoint,
  writeStoredApiBaseUrl,
} from '~/composables/useApiEndpoint'
import { backfillLibraryMetadata } from '~/composables/useMetadataBackfill'
import { useBookishSettings } from '~/composables/useBookishSettings'
import { useBooks } from '~/composables/useBooks'
import { useBookStorage } from '~/composables/useBookStorage'
import { useLibraryBackup } from '~/composables/useLibraryBackup'
import { useTTS } from '~/composables/useTTS'
import { useToast } from '~/composables/useToast'

const { books, updateBook, fetchAllData, restoreHiddenBooks, countHiddenBooks } = useBooks()
const { loadSettings } = useBookishSettings()
const { getStorageSummary } = useBookStorage()
const { createDownload, importBookishData, wipeBookishData } = useLibraryBackup()
const { stop: stopTTS } = useTTS()
const { addToast } = useToast()

// ── Storage summary ─────────────────────────────────────────────────────────

const storageLoading = ref(false)
const storageSummary = ref({ available: true, contentCount: 0, sourceCount: 0, totalBytes: 0, error: null })

const formattedStorageSize = computed(() => formatBytes(storageSummary.value.totalBytes))

const storageMessage = computed(() => {
  if (!storageSummary.value.available) return storageSummary.value.error || 'Storage cannot be inspected right now.'
  if (storageSummary.value.contentCount === 0 && storageSummary.value.sourceCount === 0) {
    return 'No reading content is stored yet.'
  }
  return 'Books are stored on this device only.'
})

const refreshStorageSummary = async () => {
  storageLoading.value = true
  try {
    storageSummary.value = await getStorageSummary()
  } finally {
    storageLoading.value = false
  }
}

// ── Metadata backfill ───────────────────────────────────────────────────────

const backfill = reactive({
  running: false,
  finished: false,
  current: 0,
  total: 0,
  currentTitle: '',
  updated: 0,
  failures: [],
})
const showFailures = ref(false)
let _stopRequested = false

const backfillPercent = computed(() => (
  backfill.total ? Math.round((backfill.current / backfill.total) * 100) : 0
))

const startBackfill = async () => {
  if (backfill.running) return
  _stopRequested = false
  backfill.running = true
  backfill.finished = false
  backfill.failures = []
  backfill.updated = 0
  backfill.current = 0
  backfill.total = 0

  try {
    const result = await backfillLibraryMetadata({
      books: books.value,
      updateBook,
      shouldStop: () => _stopRequested,
      onProgress: ({ current, total, title }) => {
        backfill.current = current
        backfill.total = total
        backfill.currentTitle = title
      },
    })
    backfill.updated = result.updated
    backfill.total = result.total
    backfill.failures = result.failures
    backfill.finished = true

    if (!result.total) addToast('All books already have their details.', 'success')
    else if (_stopRequested) addToast('Metadata fetch stopped.', 'info')
    else addToast(`Metadata fetch complete — updated ${result.updated} of ${result.total} books.`, 'success')
  } catch (error) {
    console.error('[Storage] Metadata backfill failed:', error)
    addToast('Metadata fetch failed — please try again.', 'error')
  } finally {
    backfill.running = false
  }
}

const stopBackfill = () => {
  _stopRequested = true
}

// ── Hidden books ────────────────────────────────────────────────────────────

const hiddenCount = ref(0)

const refreshHiddenCount = async () => {
  try {
    hiddenCount.value = await countHiddenBooks()
  } catch {
    hiddenCount.value = 0
  }
}

const restoreHidden = async () => {
  const restored = await restoreHiddenBooks()
  await refreshHiddenCount()
  addToast(restored ? `Restored ${restored} hidden book${restored === 1 ? '' : 's'}.` : 'No hidden books to restore.', 'success')
}

// ── Backup ──────────────────────────────────────────────────────────────────

const backupLoading = ref(false)
const wipeLoading = ref(false)
const importInputRef = ref(null)

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
    addToast('Bookish backup exported', 'success')
  } catch (error) {
    console.error('[Storage] Failed to export Bookish data:', error)
    addToast(error?.message || 'Could not export Bookish data', 'error')
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

  const confirmed = window.confirm('Importing a backup will replace the current Bookish data on this device. Continue?')
  if (!confirmed) return

  backupLoading.value = true
  try {
    const backup = JSON.parse(await file.text())
    stopTTS()
    await importBookishData(backup)
    loadSettings()
    await fetchAllData(true)
    await refreshStorageSummary()
    await refreshHiddenCount()
    addToast('Bookish backup imported', 'success')
  } catch (error) {
    console.error('[Storage] Failed to import Bookish data:', error)
    addToast(error?.message || 'Could not import Bookish backup', 'error')
  } finally {
    backupLoading.value = false
  }
}

const wipeData = async () => {
  const confirmed = window.confirm('This permanently removes all Bookish books, playlists, progress, and settings from this device. Continue?')
  if (!confirmed) return

  wipeLoading.value = true
  try {
    stopTTS()
    await wipeBookishData()
    loadSettings()
    await fetchAllData(true)
    await refreshStorageSummary()
    await refreshHiddenCount()
    addToast('Bookish data wiped from this device', 'success')
  } catch (error) {
    console.error('[Storage] Failed to wipe Bookish data:', error)
    addToast(error?.message || 'Could not wipe Bookish data', 'error')
  } finally {
    wipeLoading.value = false
  }
}

// ── Server connection ───────────────────────────────────────────────────────

const { apiBaseUrl: effectiveApiBaseUrl } = useApiEndpoint()
const serverUrlInput = ref(readStoredApiBaseUrl())
const savedServerUrl = ref(serverUrlInput.value)

const serverHint = computed(() => {
  if (savedServerUrl.value) return `Using ${savedServerUrl.value} for web features.`
  if (effectiveApiBaseUrl) return `Using the built-in server address ${effectiveApiBaseUrl}.`
  return 'No server set — searches run directly on this device.'
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

// ── Helpers ────────────────────────────────────────────────────────────────

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

onMounted(() => {
  refreshStorageSummary()
  refreshHiddenCount()
})
</script>

<style scoped>
.storage-mobile {
  display: grid;
  gap: 14px;
  padding: 4px var(--mobile-page-padding-inline, 16px) calc(var(--mobile-bottom-nav-height, 72px) + 24px);
  font-family: var(--mobile-font-family);
}

.card {
  padding: 16px;
  border: 1px solid var(--color-border-card);
  border-radius: var(--mobile-card-radius, 14px);
  background: var(--color-surface-card);
}

.card-head {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 12px;
  margin-bottom: 12px;
}

.card-head > i {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 10px;
  background: var(--color-brand-primary-muted, rgba(138, 43, 226, 0.12));
  color: var(--color-brand-primary);
  font-size: 19px;
}

.card-head h2 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 16px;
  font-weight: 600;
}

.card-head p {
  margin: 2px 0 0;
  color: var(--color-text-muted);
  font-size: 12.5px;
  line-height: 1.35;
}

.refresh-btn {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 1px solid var(--color-border-card);
  border-radius: 10px;
  background: transparent;
  color: var(--color-brand-primary);
  cursor: pointer;
  font-size: 17px;
}

.stat-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.stat {
  display: grid;
  gap: 2px;
  padding: 12px 10px;
  border-radius: 10px;
  background: var(--color-surface-secondary);
  text-align: center;
}

.stat strong {
  color: var(--color-text-primary);
  font-size: 17px;
}

.stat span {
  color: var(--color-text-muted);
  font-size: 11.5px;
}

.primary-btn,
.secondary-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 46px;
  border-radius: 11px;
  cursor: pointer;
  font-size: 14.5px;
  font-weight: 550;
}

.primary-btn {
  border: 0;
  background: var(--color-brand-primary);
  color: #fff;
  box-shadow: 0 6px 16px rgba(138, 43, 226, 0.24);
}

.primary-btn.compact {
  width: auto;
  min-height: 44px;
  padding: 0 18px;
}

.secondary-btn {
  border: 1px solid var(--color-border-card);
  background: var(--color-surface-secondary);
  color: var(--color-text-secondary);
}

.secondary-btn.danger {
  color: var(--color-status-danger, #ef4444);
}

.secondary-btn:disabled,
.primary-btn:disabled {
  opacity: 0.55;
}

.ghost-btn {
  min-height: 38px;
  margin-top: 10px;
  padding: 0 14px;
  border: 1px solid var(--color-border-card);
  border-radius: 9px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 13px;
}

.link-btn {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-brand-primary);
  cursor: pointer;
  font-size: inherit;
  font-weight: 600;
  text-decoration: underline;
}

.backfill-progress {
  display: grid;
  justify-items: start;
}

.backfill-progress-labels {
  display: flex;
  justify-content: space-between;
  width: 100%;
  margin-bottom: 6px;
  color: var(--color-text-secondary);
  font-size: 12.5px;
}

.backfill-title {
  overflow: hidden;
  max-width: 70%;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.backfill-count {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.backfill-bar {
  width: 100%;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--color-surface-secondary);
}

.backfill-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--color-brand-primary);
  transition: width 0.35s ease;
}

.backfill-summary {
  margin: 10px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.backup-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.server-row {
  display: flex;
  gap: 8px;
}

.server-input {
  flex: 1;
  min-width: 0;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--color-border-card);
  border-radius: 11px;
  background: var(--color-surface-card);
  color: var(--color-text-primary);
  font-size: 13.5px;
}

.server-input:focus {
  border-color: var(--color-brand-primary);
  outline: none;
}

.server-hint {
  margin: 8px 0 0;
  color: var(--color-text-muted);
  font-size: 12px;
}

.failures-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(15, 23, 42, 0.45);
}

.failures-modal {
  width: 100%;
  max-height: 70vh;
  padding: 16px 18px calc(18px + env(safe-area-inset-bottom));
  overflow-y: auto;
  border-radius: 18px 18px 0 0;
  background: var(--color-surface-modal);
}

.failures-modal header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.failures-modal h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 16px;
  font-weight: 600;
}

.failures-modal header button {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: var(--color-surface-secondary);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 18px;
}

.failures-modal ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.failures-modal li {
  display: grid;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--color-surface-secondary);
}

.failures-modal li strong {
  color: var(--color-text-primary);
  font-size: 13.5px;
}

.failures-modal li span {
  color: var(--color-text-muted);
  font-size: 12px;
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
</style>
