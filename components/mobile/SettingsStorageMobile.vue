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
          <strong>{{ totalBookCount }}</strong>
          <span>Total books</span>
        </div>
        <div class="stat">
          <strong>{{ hiddenCount }}</strong>
          <span>Hidden books</span>
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
          <p>Fill missing covers, authors, blurbs, genres, years, ratings and series details from the web.</p>
        </div>
      </div>

      <!-- Automatic top-up runs on its own in the background; the manual button
           below is for when the user wants it now. -->
      <label class="auto-row">
        <div class="auto-copy">
          <h3>Keep details up to date automatically</h3>
          <p>{{ autoStatusLabel }}</p>
        </div>
        <input
          type="checkbox"
          class="auto-switch"
          :checked="settings.metadataAutoFill"
          @change="setAutoMetadata($event.target.checked)"
        />
      </label>

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

    <!-- Scanned folders -->
    <section class="card">
      <div class="card-head">
        <i class="ri-folder-open-line"></i>
        <div>
          <h2>Scanned folders</h2>
          <p>Folders Pages checks for new PDF and EPUB books on every app open.</p>
        </div>
      </div>

      <ul v-if="scanFolders.length" class="folder-list">
        <li v-for="folder in scanFolders" :key="folder">
          <i class="ri-folder-3-line"></i>
          <span>{{ folderLabel(folder) }}</span>
          <button type="button" :aria-label="`Stop scanning ${folder}`" @click="removeScanFolder(folder)">
            <i class="ri-close-line"></i>
          </button>
        </li>
      </ul>
      <p v-else class="folder-empty">No folders selected — the device scan is off.</p>

      <div class="folder-chips">
        <button
          v-for="suggestion in folderSuggestions"
          :key="suggestion"
          type="button"
          class="folder-chip"
          @click="addScanFolder(suggestion)"
        >
          + {{ suggestion }}
        </button>
      </div>

      <form class="server-row" @submit.prevent="addScanFolder(newFolderInput)">
        <input
          v-model="newFolderInput"
          class="server-input"
          type="text"
          placeholder="Folder name or full path"
          aria-label="Folder to scan"
        />
        <button class="primary-btn compact" type="submit">Add</button>
      </form>

      <button class="secondary-btn scan-now" type="button" @click="scanNow">
        <i class="ri-refresh-line"></i>
        Scan device now
      </button>
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
      <div v-if="hiddenCount" class="hidden-actions">
        <!-- Reviewing them one by one is the common case; restoring the lot at
             once is the blunt instrument, so it comes second. -->
        <button class="primary-btn" type="button" @click="router.push('/settings/hidden')">
          <i class="ri-eye-line"></i>
          View hidden books
        </button>
        <button class="secondary-btn" type="button" @click="restoreHidden">
          <i class="ri-refresh-line"></i>
          Restore all
        </button>
      </div>
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
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLibraryBackfill } from '~/composables/useMetadataBackfill'
import { useAutoMetadata } from '~/composables/useAutoMetadata'
import { useBookishSettings } from '~/composables/useBookishSettings'
import {
  DEFAULT_SCAN_FOLDERS,
  normalizeScanFolder,
  readScanFolders,
  syncDeviceLibrary,
  writeScanFolders,
} from '~/composables/useDeviceLibrarySync'
import { isNativeCapacitorPlatform } from '~/composables/useNativePlatform'
import { useBooks } from '~/composables/useBooks'
import { useBookStorage } from '~/composables/useBookStorage'
import { useToast } from '~/composables/useToast'

const { books, updateBook, restoreHiddenBooks, countHiddenBooks } = useBooks()
const { getStorageSummary } = useBookStorage()
const { addToast } = useToast()
const router = useRouter()

// Every book in the library, hidden ones included — the two stats below it
// then read as a whole and a part of that whole.
const totalBookCount = computed(() => (books.value?.length || 0) + hiddenCount.value)

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

// The run itself lives in the composable, not here: this page only starts it
// and watches. Owning the loop in component scope meant navigating away threw
// the progress state (and the apparent run) away mid-sweep.
const { state: backfill, start: runLibraryBackfill, stop: stopLibraryBackfill } = useLibraryBackfill()
const { settings, updateSettings } = useBookishSettings()
const { state: autoMeta } = useAutoMetadata()
const showFailures = ref(false)

const setAutoMetadata = (on) => updateSettings({ metadataAutoFill: !!on })

// A plain-language read on what the background top-up is doing right now.
const autoStatusLabel = computed(() => {
  if (!settings.value.metadataAutoFill) return 'Off — details are only filled when you tap the button below.'
  if (autoMeta.running) return 'Checking your library now…'
  if (autoMeta.totalUpdated) return `On — filled ${autoMeta.totalUpdated} book${autoMeta.totalUpdated === 1 ? '' : 's'} so far this session.`
  return 'On — checks your library in the background every few minutes.'
})

const backfillPercent = computed(() => (
  backfill.total ? Math.round((backfill.current / backfill.total) * 100) : 0
))

const startBackfill = async () => {
  if (backfill.running) return
  try {
    // Keeps running if the user navigates away; the toast fires from the run
    // itself so the result is reported even when this page is long gone.
    await runLibraryBackfill({
      books: books.value,
      updateBook,
      onDone: ({ total, updated, stopped }) => {
        if (!total) addToast('All books already have their details.', 'success')
        else if (stopped) addToast('Metadata fetch stopped.', 'info')
        else addToast(`Metadata fetch complete — updated ${updated} of ${total} books.`, 'success')
      },
    })
  } catch (error) {
    console.error('[Storage] Metadata backfill failed:', error)
    addToast('Metadata fetch failed — please try again.', 'error')
  }
}

const stopBackfill = () => {
  stopLibraryBackfill()
}

// ── Scanned folders ─────────────────────────────────────────────────────────

const scanFolders = ref(readScanFolders())
const newFolderInput = ref('')

const folderSuggestions = computed(() => (
  ['Download', 'Documents', 'Books']
    .filter((name) => !scanFolders.value.includes(normalizeScanFolder(name)))
))

const folderLabel = (folder) => (
  folder === DEFAULT_SCAN_FOLDERS[0] ? 'All storage' : folder.replace('/storage/emulated/0/', '')
)

const addScanFolder = (value) => {
  const normalized = normalizeScanFolder(value)
  if (!normalized) return
  if (scanFolders.value.includes(normalized)) {
    addToast('That folder is already being scanned.', 'info')
    return
  }
  scanFolders.value = writeScanFolders([...scanFolders.value, normalized])
  newFolderInput.value = ''
}

const removeScanFolder = (folder) => {
  scanFolders.value = writeScanFolders(scanFolders.value.filter((item) => item !== folder))
}

const scanNow = () => {
  if (!isNativeCapacitorPlatform()) {
    addToast('Device scanning runs in the installed mobile app.', 'info')
    return
  }
  syncDeviceLibrary()
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

.folder-list {
  display: grid;
  gap: 6px;
  margin: 0 0 10px;
  padding: 0;
  list-style: none;
}

.folder-list li {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) 30px;
  align-items: center;
  column-gap: 8px;
  padding: 9px 10px;
  border-radius: 10px;
  background: var(--color-surface-secondary);
  color: var(--color-text-primary);
  font-size: 13.5px;
}

.folder-list li i {
  color: var(--color-brand-primary);
}

.folder-list li span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-list li button {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 16px;
}

.folder-empty {
  margin: 0 0 10px;
  color: var(--color-text-muted);
  font-size: 12.5px;
}

.folder-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.folder-chip {
  min-height: 30px;
  padding: 0 11px;
  border: 1px dashed var(--color-border-card);
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 12.5px;
}

.scan-now {
  margin-top: 10px;
}

.auto-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;
  padding: 12px 14px;
  border: 1px solid var(--color-border-card);
  border-radius: 12px;
  background: var(--color-surface-secondary);
}

.auto-copy h3 {
  margin: 0 0 3px;
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 600;
}

.auto-copy p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.35;
}

.auto-switch {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  accent-color: var(--color-brand-primary);
}

/* Two stacked full-width buttons. Without a gap they touched, and the purple
   button's glow bled straight onto the one below it. */
.hidden-actions {
  display: grid;
  gap: 10px;
  margin-top: 14px;
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
