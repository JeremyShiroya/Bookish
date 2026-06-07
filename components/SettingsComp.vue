<template>
  <main class="settings-page">
    <section class="settings-hero" aria-labelledby="settings-title">
      <div>
        <span class="eyebrow">Bookish Settings</span>
        <h1 id="settings-title">Tune Bookish for your reading flow.</h1>
        <p>Reader defaults, library sorting, audiobook playback, metadata, and local storage in one place.</p>
      </div>
      <div class="hero-covers" aria-hidden="true">
        <div
          v-for="(book, index) in coverPreviewBooks"
          :key="book.id"
          class="hero-cover"
          :style="coverStyle(index)"
        >
          <img :src="resolveBookCover(book)" :alt="book.title" @error="(event) => coverFallback(event, book.title)" />
        </div>
        <div v-if="!coverPreviewBooks.length" class="hero-cover placeholder-cover">
          <i class="ri-book-open-line"></i>
        </div>
      </div>
    </section>

    <section class="stats-grid" aria-label="Library snapshot">
      <div v-for="stat in libraryStats" :key="stat.label" class="stat-item">
        <i :class="stat.icon"></i>
        <div>
          <strong>{{ stat.value }}</strong>
          <span>{{ stat.label }}</span>
        </div>
      </div>
    </section>

    <section class="settings-grid" aria-label="Settings controls">
      <article id="reading" class="settings-panel">
        <div class="panel-heading">
          <i class="ri-book-read-line"></i>
          <div>
            <h2>Reading</h2>
            <p>Defaults for EPUB and PDF sessions.</p>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-copy">
            <h3>App theme</h3>
            <p>Switch Bookish between light and dark mode.</p>
          </div>
          <div class="segmented-control" aria-label="App theme">
            <button
              v-for="theme in readerThemes"
              :key="theme.value"
              :class="{ active: settings.readerTheme === theme.value }"
              @click="setReaderTheme(theme.value)"
            >
              <i :class="theme.icon"></i>
              <span>{{ theme.label }}</span>
            </button>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-copy">
            <h3>Default zoom</h3>
            <p>{{ Math.round(settings.readerZoom * 100) }}% when opening a book.</p>
          </div>
          <div class="range-control">
            <i class="ri-subtract-line"></i>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              :value="settings.readerZoom"
              @input="setReaderZoom($event.target.value)"
            />
            <i class="ri-add-line"></i>
          </div>
        </div>
      </article>

      <article id="audio" class="settings-panel">
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
          <div class="select-wrap">
            <select :value="settings.ttsVoice" @change="setAudioVoice($event.target.value)">
              <option v-for="voice in ttsVoices" :key="voice.id" :value="voice.id">
                {{ voice.name }}
              </option>
            </select>
            <i class="ri-arrow-down-s-line"></i>
          </div>
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

      <article id="library" class="settings-panel">
        <div class="panel-heading">
          <i class="ri-archive-line"></i>
          <div>
            <h2>Library</h2>
            <p>How the Books page opens by default.</p>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-copy">
            <h3>Default view</h3>
            <p>{{ settings.libraryView === 'grid' ? 'Cover-rich grid' : 'Compact table' }}</p>
          </div>
          <div class="segmented-control" aria-label="Library view">
            <button :class="{ active: settings.libraryView === 'grid' }" @click="setLibraryView('grid')">
              <i class="ri-apps-2-line"></i>
              <span>Grid</span>
            </button>
            <button :class="{ active: settings.libraryView === 'table' }" @click="setLibraryView('table')">
              <i class="ri-list-unordered"></i>
              <span>Table</span>
            </button>
          </div>
        </div>

        <div class="setting-row setting-row--sort">
          <div class="setting-copy">
            <h3>Default sort</h3>
            <p>{{ defaultSortDescription }}</p>
          </div>
          <div class="chip-group chip-group--wrap" aria-label="Library sort">
            <button :class="{ active: settings.librarySort === 'name' && settings.librarySortDirection === 'asc' }" @click="setLibrarySort('name', 'asc')">
              A to Z
            </button>
            <button :class="{ active: settings.librarySort === 'name' && settings.librarySortDirection === 'desc' }" @click="setLibrarySort('name', 'desc')">
              Z to A
            </button>
            <button :class="{ active: settings.librarySort === 'rating' && settings.librarySortDirection === 'desc' }" @click="setLibrarySort('rating', 'desc')">
              Rating ↓
            </button>
            <button :class="{ active: settings.librarySort === 'rating' && settings.librarySortDirection === 'asc' }" @click="setLibrarySort('rating', 'asc')">
              Rating ↑
            </button>
            <button :class="{ active: settings.librarySort === 'year' && settings.librarySortDirection === 'desc' }" @click="setLibrarySort('year', 'desc')">
              Year ↓
            </button>
            <button :class="{ active: settings.librarySort === 'year' && settings.librarySortDirection === 'asc' }" @click="setLibrarySort('year', 'asc')">
              Year ↑
            </button>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-copy">
            <h3>Grid items per page</h3>
            <p>{{ settings.libraryGridItemsPerPage }} book cards per page.</p>
          </div>
          <div class="chip-group" aria-label="Grid items per page">
            <button
              v-for="option in gridItemsPerPageOptions"
              :key="option"
              :class="{ active: settings.libraryGridItemsPerPage === option }"
              @click="setLibraryGridItemsPerPage(option)"
            >
              {{ option }}
            </button>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-copy">
            <h3>Table items per page</h3>
            <p>{{ settings.libraryTableItemsPerPage }} book rows per page.</p>
          </div>
          <div class="chip-group" aria-label="Table items per page">
            <button
              v-for="option in tableItemsPerPageOptions"
              :key="option"
              :class="{ active: settings.libraryTableItemsPerPage === option }"
              @click="setLibraryTableItemsPerPage(option)"
            >
              {{ option }}
            </button>
          </div>
        </div>

        <div class="format-strip" v-if="formatStats.length">
          <div v-for="format in formatStats" :key="format.name" class="format-pill">
            <span>{{ format.name }}</span>
            <strong>{{ format.count }}</strong>
          </div>
        </div>
      </article>

      <article id="metadata" class="settings-panel">
        <div class="panel-heading">
          <i class="ri-file-search-line"></i>
          <div>
            <h2>Metadata</h2>
            <p>Covers, blurbs, authors, series, genres, and web ratings.</p>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-copy">
            <h3>Auto-fill preference</h3>
            <p>{{ settings.metadataAutoFill ? 'Prefer fetched metadata while adding books.' : 'Keep metadata fetches manual.' }}</p>
          </div>
          <label class="switch-control">
            <input
              type="checkbox"
              :checked="settings.metadataAutoFill"
              @change="setMetadataAutoFill($event.target.checked)"
            />
            <span></span>
          </label>
        </div>

        <div class="metadata-snapshot">
          <div>
            <strong>{{ booksWithCovers }}</strong>
            <span>books with covers</span>
          </div>
          <div>
            <strong>{{ booksWithWebReviews }}</strong>
            <span>web ratings saved</span>
          </div>
          <div>
            <strong>{{ genres.length }}</strong>
            <span>genres indexed</span>
          </div>
        </div>
      </article>

      <article id="storage" class="settings-panel">
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
            <p>Move your full Bookish library, playlists, reading content, audio session, and settings.</p>
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
      </article>
    </section>

    <section class="about-section" aria-labelledby="about-title">
      <img src="/Images/Logo.png" alt="Bookish" class="about-logo" />
      <h2 id="about-title">Bookish</h2>
      <p>Version {{ appVersion }} &bull; Build {{ buildNumber }}</p>
      <nav class="about-links" aria-label="Bookish links">
        <a href="#">Support Center</a>
        <a href="#">Release Notes</a>
        <a href="#">Privacy Policy</a>
      </nav>
      <small>© 2026 Bookish. Made with <i class="ri-heart-fill heart-icon"></i> for readers.</small>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useBooks } from '~/composables/useBooks'
import {
  useBookishSettings,
  LIBRARY_GRID_ITEMS_PER_PAGE_OPTIONS,
  LIBRARY_TABLE_ITEMS_PER_PAGE_OPTIONS,
} from '~/composables/useBookishSettings'
import { useBookStorage } from '~/composables/useBookStorage'
import { useLibraryBackup } from '~/composables/useLibraryBackup'
import { useTTS } from '~/composables/useTTS'
import { useToast } from '~/composables/useToast'

const { books, authors, collections, genres, recentlyAddedBooks, fetchAllData } = useBooks()
const { settings, updateSettings, loadSettings } = useBookishSettings()
const { getStorageSummary } = useBookStorage()
const { createDownload, importBookishData, wipeBookishData } = useLibraryBackup()
const { ttsVoices, setSpeed, setVolume, setVoice, stop: stopTTS } = useTTS()
const { addToast } = useToast()
const runtimeConfig = useRuntimeConfig()
const appVersion = runtimeConfig.public.appVersion || '0.0.0'
const buildNumber = runtimeConfig.public.buildNumber || 'dev'

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

const readerThemes = [
  { value: 'light', label: 'Light', icon: 'ri-sun-line' },
  { value: 'dark', label: 'Dark', icon: 'ri-moon-line' },
]

const speedOptions = [0.75, 1, 1.25, 1.5, 2]

const coverPreviewBooks = computed(() => recentlyAddedBooks.value.slice(0, 3))

const statusCounts = computed(() => {
  return books.value.reduce((counts, book) => {
    const status = book.status || 'Unread'
    counts[status] = (counts[status] || 0) + 1
    return counts
  }, {})
})

const booksWithCovers = computed(() => books.value.filter(book => !!book.cover).length)
const booksWithWebReviews = computed(() => books.value.filter(book => !!book.webReview).length)

const libraryStats = computed(() => [
  { label: 'Books', value: books.value.length, icon: 'ri-book-open-line' },
  { label: 'Authors', value: authors.value.length, icon: 'ri-group-line' },
  { label: 'Playlists', value: collections.value.length, icon: 'ri-play-list-2-line' },
  { label: 'Reading', value: statusCounts.value.Reading || 0, icon: 'ri-bookmark-3-line' },
  { label: 'Finished', value: statusCounts.value.Completed || statusCounts.value.Read || 0, icon: 'ri-checkbox-circle-line' },
])

const formatStats = computed(() => {
  const counts = books.value.reduce((result, book) => {
    const format = (book.format || 'unknown').toUpperCase()
    result[format] = (result[format] || 0) + 1
    return result
  }, {})

  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
})

const currentVoiceName = computed(() => {
  return ttsVoices.value.find(voice => voice.id === settings.value.ttsVoice)?.name || 'Default narrator'
})

const formattedStorageSize = computed(() => formatBytes(storageSummary.value.totalBytes))

const storageMessage = computed(() => {
  if (!storageSummary.value.available) {
    return storageSummary.value.error || 'Bookish cannot inspect local storage right now.'
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
    addToast('Bookish backup exported', 'success')
  } catch (error) {
    console.error('[Settings] Failed to export Bookish data:', error)
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

  const confirmed = window.confirm('Importing a backup will replace the current Bookish data in this browser. Continue?')
  if (!confirmed) return

  backupLoading.value = true
  try {
    const backup = JSON.parse(await file.text())
    stopTTS()
    await importBookishData(backup)
    loadSettings()
    await fetchAllData(true)
    await refreshStorageSummary()
    addToast('Bookish backup imported', 'success')
  } catch (error) {
    console.error('[Settings] Failed to import Bookish data:', error)
    addToast(error?.message || 'Could not import Bookish backup', 'error')
  } finally {
    backupLoading.value = false
  }
}

const wipeData = async () => {
  const confirmed = window.confirm('This will permanently remove all Bookish books, playlists, reading content, progress, audio state, and settings from this browser. Continue?')
  if (!confirmed) return

  wipeLoading.value = true
  try {
    stopTTS()
    await wipeBookishData()
    loadSettings()
    await fetchAllData(true)
    await refreshStorageSummary()
    addToast('Bookish data wiped from this browser', 'success')
  } catch (error) {
    console.error('[Settings] Failed to wipe Bookish data:', error)
    addToast(error?.message || 'Could not wipe Bookish data', 'error')
  } finally {
    wipeLoading.value = false
  }
}

const setReaderTheme = (readerTheme) => updateSettings({ readerTheme })
const setReaderZoom = (value) => updateSettings({ readerZoom: Number(value) })

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

const setLibraryView = (libraryView) => updateSettings({ libraryView })
const setLibrarySort = (librarySort, librarySortDirection) => updateSettings({ librarySort, librarySortDirection })
const setLibraryGridItemsPerPage = (libraryGridItemsPerPage) => updateSettings({ libraryGridItemsPerPage })
const setLibraryTableItemsPerPage = (libraryTableItemsPerPage) => updateSettings({ libraryTableItemsPerPage })
const setMetadataAutoFill = (metadataAutoFill) => updateSettings({ metadataAutoFill })

const gridItemsPerPageOptions = LIBRARY_GRID_ITEMS_PER_PAGE_OPTIONS
const tableItemsPerPageOptions = LIBRARY_TABLE_ITEMS_PER_PAGE_OPTIONS

const defaultSortDescription = computed(() => {
  const { librarySort, librarySortDirection } = settings.value
  if (librarySort === 'name') return librarySortDirection === 'asc' ? 'Title A to Z' : 'Title Z to A'
  if (librarySort === 'rating') return librarySortDirection === 'desc' ? 'Highest rated first' : 'Lowest rated first'
  return librarySortDirection === 'desc' ? 'Newest releases first' : 'Oldest releases first'
})

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

const generateCoverPlaceholder = (title) => {
  const colors = getThemeCssVars([
    { name: '--color-book-cover-placeholder-one', fallback: '#8A2BE2' },
    { name: '--color-book-cover-placeholder-two', fallback: '#6A0DAD' },
    { name: '--color-book-cover-placeholder-three', fallback: '#2f7d62' },
    { name: '--color-book-cover-placeholder-four', fallback: '#b45309' },
    { name: '--color-brand-secondary', fallback: '#2563eb' },
  ])
  const hash = [...(title || 'Book')].reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const color = colors[hash % colors.length]
  const initial = title?.trim()?.[0]?.toUpperCase() || '?'
  const displayTitle = title && title.length > 18 ? `${title.substring(0, 18)}...` : title || 'Book'
  const softText = getThemeCssVar('--color-book-cover-placeholder-text-soft', 'rgba(255,255,255,0.24)')
  const strongText = getThemeCssVar('--color-book-cover-placeholder-text-strong', 'rgba(255,255,255,0.75)')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="${color}"/><text x="100" y="126" font-family="serif" font-size="96" fill="${softText}" text-anchor="middle" dominant-baseline="middle">${initial}</text><text x="100" y="230" font-family="sans-serif" font-size="11" fill="${strongText}" text-anchor="middle">${displayTitle}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const resolveBookCover = (book) => book.cover || generateCoverPlaceholder(book.title)

const coverFallback = (event, title) => {
  event.target.src = generateCoverPlaceholder(title)
}

const coverStyle = (index) => ({
  transform: `translateX(${(index - 1) * -26}px) rotate(${(index - 1) * -7}deg)`,
})

onMounted(refreshStorageSummary)
</script>

<style scoped>
.settings-page {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.settings-hero,
.settings-panel,
.stat-item,
.about-section {
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-card);
  border-radius: 10px;
}

.settings-hero {
  min-height: 220px;
  padding: 1.5rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(180px, 260px);
  gap: 1.5rem;
  align-items: center;
  overflow: hidden;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 0.6rem;
  border-radius: 999px;
  background: var(--color-brand-primary-soft);
  color: var(--color-brand-primary-hover);
  font-size: 0.74rem;
  margin-bottom: 0.75rem;
}

.settings-hero h1,
.panel-heading h2,
.setting-copy h3,
.about-section h2 {
  color: var(--color-text-primary);
  margin: 0;
}

.settings-hero h1 {
  max-width: 640px;
  font-size: clamp(1.7rem, 3vw, 2.5rem);
  line-height: 1.08;
}

.settings-hero p,
.panel-heading p,
.setting-copy p,
.stat-item span,
.metadata-snapshot span,
.storage-metric span,
.about-section p,
.about-section small {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.84rem;
  line-height: 1.45;
}

.settings-hero p {
  max-width: 640px;
  margin-top: 0.75rem;
  font-size: 0.95rem;
}

.hero-covers {
  min-height: 170px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-cover {
  width: 92px;
  aspect-ratio: 2 / 3;
  border-radius: 7px;
  overflow: hidden;
  box-shadow: var(--shadow-card-raised);
  margin-left: -16px;
  background: var(--color-surface-secondary);
}

.hero-cover:first-child {
  margin-left: 0;
}

.hero-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.placeholder-cover {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-brand-primary);
  border: 1px dashed var(--color-border-strong);
  box-shadow: none;
}

.placeholder-cover i {
  font-size: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(120px, 1fr));
  gap: 0.75rem;
  min-width: 0;
}

.stat-item {
  min-height: 78px;
  padding: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.stat-item i,
.panel-heading > i {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-brand-primary-muted);
  color: var(--color-brand-primary);
  font-size: 1.2rem;
  flex-shrink: 0;
}

.stat-item strong,
.metadata-snapshot strong,
.storage-metric strong {
  display: block;
  color: var(--color-text-primary);
  font-size: 1.2rem;
  line-height: 1;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  min-width: 0;
}

.settings-panel {
  padding: 1.25rem;
  min-width: 0;
}

.panel-heading {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border-subtle);
  min-width: 0;
}

.panel-heading h2 {
  font-size: 1.1rem;
}

.panel-heading > div,
.setting-copy {
  min-width: 0;
}

.setting-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, auto);
  gap: 1rem;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 1px solid var(--color-border-subtle);
}

.setting-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.setting-copy h3 {
  font-size: 0.96rem;
  margin-bottom: 0.2rem;
}

.segmented-control,
.chip-group {
  display: inline-flex;
  justify-content: flex-end;
  gap: 0.35rem;
  flex-wrap: wrap;
  min-width: 0;
}

.segmented-control button,
.chip-group button {
  min-height: 36px;
  border: 1px solid var(--color-border-card);
  background: var(--color-surface-card);
  color: var(--color-text-muted);
  border-radius: 8px;
  padding: 0 0.8rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
}

.segmented-control button:hover,
.chip-group button:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.segmented-control button.active,
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

.select-wrap {
  position: relative;
  width: min(260px, 100%);
  min-width: 0;
}

.select-wrap select {
  width: 100%;
  min-height: 38px;
  appearance: none;
  border: 1px solid var(--color-border-card);
  border-radius: 8px;
  background: var(--color-surface-card);
  color: var(--color-text-primary);
  padding: 0 2.25rem 0 0.8rem;
  font-family: inherit;
}

.select-wrap i {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  pointer-events: none;
}

.format-strip,
.metadata-snapshot,
.storage-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  padding-top: 1rem;
}

.format-pill,
.metadata-snapshot > div,
.storage-metric {
  min-height: 64px;
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  padding: 0.8rem;
}

.format-pill {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.format-pill span {
  color: var(--color-text-muted);
  font-size: 0.8rem;
}

.format-pill strong {
  color: var(--color-brand-primary-hover);
}

.switch-control {
  position: relative;
  width: 52px;
  height: 30px;
}

.switch-control input {
  opacity: 0;
  width: 0;
  height: 0;
}

.switch-control span {
  position: absolute;
  inset: 0;
  background: var(--color-border-strong);
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.16s ease;
}

.switch-control span::before {
  content: "";
  position: absolute;
  width: 22px;
  height: 22px;
  left: 4px;
  top: 4px;
  border-radius: 50%;
  background: var(--color-surface-primary);
  box-shadow: var(--shadow-control-subtle);
  transition: transform 0.16s ease;
}

.switch-control input:checked + span {
  background: var(--color-brand-primary);
}

.switch-control input:checked + span::before {
  transform: translateX(22px);
}

.storage-status-line {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.75rem;
  margin-top: 1rem;
  min-height: 42px;
  padding: 0.65rem 0.75rem;
  /* background-color: var(--color-status-success-soft); */
  border-radius: 8px;
  border: 1px solid var(--color-border-card);
  color: var(--color-status-success);
  font-size: 0.85rem;
}

.storage-status-line.warning {
  color: var(--color-status-warning);
}

.data-portability {
  margin-top: 1rem;
  padding-top: 1rem;
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
  min-height: 36px;
  border: 1px solid var(--color-border-card);
  border-radius: 8px;
  background: var(--color-surface-card);
  color: var(--color-text-secondary);
  padding: 0 0.75rem;
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

.icon-action {
  margin-left: auto;
  width: 34px;
  height: 34px;
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

.about-section {
  min-height: 240px;
  padding: 2.2rem 1.5rem;
  text-align: center;
  background: var(--color-surface-card);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
}

.about-logo {
  width: 36px;
  height: 36px;
  object-fit: cover;
}

.about-section h2 {
  font-size: 1.45rem;
  margin-top: 0.4rem;
}

.heart-icon{
  color: red;
}

.about-links {
  display: flex;
  justify-content: center;
  gap: 2rem;
  flex-wrap: wrap;
  margin: 1rem 0 0.6rem;
}

.about-links a {
  color: var(--color-text-primary);
  text-decoration: none;
  font-size: 0.86rem;
}

.about-links a:hover {
  color: var(--color-brand-primary-hover);
}

.spin {
  display: inline-block;
  animation: spin 0.85s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 1180px) {
  .stats-grid {
    grid-template-columns: repeat(3, minmax(140px, 1fr));
  }

  .settings-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .settings-hero {
    grid-template-columns: 1fr;
    padding: 1rem;
  }

  .hero-covers {
    justify-content: flex-start;
    min-height: 140px;
  }

  .stats-grid,
  .format-strip,
  .metadata-snapshot,
  .storage-grid {
    grid-template-columns: 1fr;
  }

  .setting-row {
    grid-template-columns: 1fr;
  }

  .segmented-control,
  .chip-group {
    justify-content: flex-start;
  }

  .select-wrap,
  .range-control {
    width: 100%;
  }

  .settings-panel {
    padding: 1rem;
  }
}

@media (max-width: 480px) {
  .settings-page {
    gap: 0.75rem;
  }

  .settings-hero,
  .settings-panel,
  .stat-item,
  .about-section {
    border-radius: 7px;
  }

  .settings-hero,
  .settings-panel {
    padding: 0.8rem;
  }

  .settings-hero h1 {
    font-size: 1.4rem;
  }

  .stat-item {
    min-height: 64px;
    padding: 0.75rem;
  }

  .panel-heading {
    align-items: flex-start;
    gap: 0.65rem;
  }

  .setting-row {
    gap: 0.75rem;
  }

  .segmented-control,
  .chip-group {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
  }

  .chip-group[aria-label="Playback speed"] {
    grid-template-columns: 1fr;
  }

  .segmented-control button,
  .chip-group button {
    width: 100%;
    min-width: 0;
    padding: 0 0.5rem;
  }

  .range-control {
    grid-template-columns: 16px minmax(0, 1fr) 16px;
    gap: 0.35rem;
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

  .about-section {
    min-height: 220px;
    padding: 1.75rem 0.8rem;
  }

  .about-links {
    gap: 0.8rem;
  }
}
</style>
