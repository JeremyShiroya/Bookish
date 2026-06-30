<template>
  <div class="author-detail-page" v-if="author">
    <div class="author-layout">
      <!-- Left sidebar -->
      <aside class="author-sidebar">
        <button class="back-btn" @click="router.back()">
          <i class="ri-arrow-left-s-line"></i> Back
        </button>

        <div class="author-profile">
          <div class="avatar-frame" @click="handleImageClick">
            <img v-if="author.image" :src="author.image" :alt="author.name" class="avatar-img" />
            <div v-else class="avatar-initial">{{ author.name.charAt(0) }}</div>
            <div class="avatar-overlay">
              <i class="ri-camera-line"></i>
              <span>Change</span>
            </div>
            <div v-if="isScraping" class="avatar-loading">
              <i class="ri-loader-4-line spin-icon"></i>
            </div>
          </div>

          <h1 class="author-name">{{ author.name }}</h1>

          <div class="author-stats">
            <div class="stat-chip">
              <span class="stat-value">{{ collectionStats.books.owned }} / {{ collectionStats.books.totalLabel }}</span>
              <span class="stat-label">Books</span>
            </div>
            <div class="stat-chip">
              <span class="stat-value">{{ collectionStats.series.owned }} / {{ collectionStats.series.totalLabel }}</span>
              <span class="stat-label">Series</span>
            </div>
          </div>
          <p class="stats-caption">In your library / validated full-length total</p>

          <!-- Key details -->
          <div class="detail-list" v-if="hasAnyDetail">
            <div v-if="authorDetails.birthDate" class="detail-row">
              <i class="ri-cake-line detail-icon"></i>
              <div class="detail-content">
                <span class="detail-label">Born</span>
                <span class="detail-value">{{ authorDetails.birthDate }}<template v-if="authorAge"> (age {{ authorAge }})</template></span>
              </div>
            </div>
            <div v-if="authorDetails.deathDate" class="detail-row">
              <i class="ri-heart-pulse-line detail-icon"></i>
              <div class="detail-content">
                <span class="detail-label">Died</span>
                <span class="detail-value">{{ authorDetails.deathDate }}</span>
              </div>
            </div>
            <div v-if="authorDetails.nationality" class="detail-row">
              <i class="ri-map-pin-line detail-icon"></i>
              <div class="detail-content">
                <span class="detail-label">Nationality</span>
                <span class="detail-value">{{ authorDetails.nationality }}</span>
              </div>
            </div>
            <div v-if="authorDetails.spouseName" class="detail-row">
              <i class="ri-hearts-line detail-icon"></i>
              <div class="detail-content">
                <span class="detail-label">Spouse</span>
                <span class="detail-value">{{ authorDetails.spouseName }}</span>
              </div>
            </div>
            <div v-else-if="authorDetails.hasChildren !== null && !authorDetails.spouseName" class="detail-row">
              <i class="ri-hearts-line detail-icon"></i>
              <div class="detail-content">
                <span class="detail-label">Relationship</span>
                <span class="detail-value">Unknown</span>
              </div>
            </div>
            <div v-if="authorDetails.childrenCount !== null" class="detail-row">
              <i class="ri-user-smile-line detail-icon"></i>
              <div class="detail-content">
                <span class="detail-label">Children</span>
                <span class="detail-value">{{ authorDetails.childrenCount }}</span>
              </div>
            </div>
            <div v-if="authorDetails.latestWork" class="detail-row">
              <i class="ri-book-marked-line detail-icon"></i>
              <div class="detail-content">
                <span class="detail-label">Latest work</span>
                <span class="detail-value">{{ authorDetails.latestWork }}</span>
              </div>
            </div>
          </div>

          <!-- Bio -->
          <div class="bio-section" v-if="author.bio || bioLoading">
            <h3 class="bio-heading">About</h3>
            <div v-if="bioLoading" class="bio-skeleton-wrap">
              <span class="bio-skeleton wide"></span>
              <span class="bio-skeleton medium"></span>
              <span class="bio-skeleton short"></span>
            </div>
            <p v-else class="bio-text">{{ author.bio }}</p>
          </div>

          <!-- Notable works -->
          <div v-if="authorDetails.notableWorks?.length" class="notable-section">
            <h3 class="bio-heading">Notable Works</h3>
            <ul class="notable-list">
              <li v-for="work in authorDetails.notableWorks" :key="work" class="notable-item">{{ work }}</li>
            </ul>
          </div>
        </div>
      </aside>

      <!-- Main content area -->
      <main class="books-main">
        <section v-if="standaloneBooks.length" class="work-section">
          <header class="section-header">
            <h2>Standalone</h2>
            <div class="accent-line"></div>
          </header>
          <div class="books-grid">
            <LibraryBookCard
              v-for="book in standaloneBooks"
              :key="book.id"
              :book="book"
              :active="isBookActive(book)"
              @open="router.push(`/book/${book.id}`)"
              @play="handlePlay"
              @favourite="toggleFavourite(book.id)"
              @playlist="selectedPlaylistBook = book"
              @edit="router.push(`/edit/${book.id}`)"
              @delete="deleteAuthorBook(book)"
            />
          </div>
        </section>

        <section v-if="authorSeries.length" class="work-section">
          <header class="section-header">
            <h2>Series</h2>
            <div class="accent-line"></div>
          </header>
          <SeriesComp :items="authorSeries" :show-title="false" :show-empty="false" />
        </section>

        <div v-if="!standaloneBooks.length && !authorSeries.length" class="empty-state">
          <i class="ri-book-open-line"></i>
          <p>No books in your library for this author yet.</p>
        </div>
      </main>
    </div>

    <AddToPlaylistModal
      v-if="selectedPlaylistBook"
      :book="selectedPlaylistBook"
      @close="selectedPlaylistBook = null"
    />

    <AuthorImageModal
      :visible="showAuthorImageModal"
      :stage="authorImageStage"
      :loading="isScraping"
      :author-name="author.name"
      :images="imageOptions"
      @close="closeAuthorImageModal"
      @upload="triggerFileUpload"
      @search="searchAuthorImages"
      @select="selectImage"
      @image-error="removeImageOption"
    />

    <DeleteConfirmModal
      v-if="showDeleteModal && bookToDelete"
      :book="bookToDelete"
      @close="showDeleteModal = false; bookToDelete = null"
      @confirm="confirmDeleteAuthorBook"
    />
  </div>

  <div v-else-if="loading" class="loading-state">
    <SkeletonLoader variant="author-detail" />
  </div>

  <div v-else-if="error" class="error-state">
    <div class="error-card">
      <i class="ri-error-warning-line"></i>
      <h3>Unable to Load Profile</h3>
      <p>{{ error }}</p>
      <button @click="fetchAuthor" class="retry-btn">Try Again</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTTS } from '~/composables/useTTS'
import { useToast } from '~/composables/useToast'
import { useBooks } from '~/composables/useBooks'
import { useLibraryStore } from '~/composables/useLibraryStore'
import { fetchAuthorImageResults } from '~/composables/useAuthorImageSearch'
import { buildAuthorCollectionStats, groupAuthorWorks } from '~/composables/useAuthorDetails'
import AuthorImageModal from './AuthorImageModal.vue'
import LibraryBookCard from './LibraryBookCard.vue'
import AddToPlaylistModal from './AddToPlaylistModal.vue'
import SeriesComp from './SeriesComp.vue'
import DeleteConfirmModal from './DeleteConfirmModal.vue'

const route = useRoute()
const router = useRouter()
const { play: playTTS, togglePlay: toggleTTS, ttsBook, ttsStatus } = useTTS()
const { addToast } = useToast()
const {
  fetchAllData,
  authors: globalAuthors,
  books: globalBooks,
  initialized,
  toggleFavourite,
  deleteBook,
  fetchAndStoreAuthorDetails,
} = useBooks()

const author = ref(null)
const loading = ref(true)
const error = ref(null)
const isScraping = ref(false)
const bioLoading = ref(false)
const showAuthorImageModal = ref(false)
const authorImageStage = ref('choice')
const imageOptions = ref([])
const selectedPlaylistBook = ref(null)
const showDeleteModal = ref(false)
const bookToDelete = ref(null)

// Author details are mirrored onto every one of the author's book records, but
// a partial/older record can miss a field — so read each field from the first
// book that actually has it rather than trusting books[0] alone.
const authorDetails = computed(() => {
  const books = author.value?.books || []
  if (!books.length) return {}
  const pick = (key) => {
    for (const book of books) {
      const value = book[key]
      if (value !== undefined && value !== null && value !== '') return value
    }
    return null
  }
  return {
    birthDate: pick('authorBirthDate'),
    deathDate: pick('authorDeathDate'),
    nationality: pick('authorNationality'),
    notableWorks: pick('authorNotableWorks') || [],
    validatedBooksCount: pick('authorValidatedBooksCount'),
    validatedSeriesCount: pick('authorValidatedSeriesCount'),
    latestWork: pick('authorLatestWork'),
    spouseName: pick('authorSpouseName'),
    hasChildren: pick('authorHasChildren'),
    childrenCount: pick('authorChildrenCount'),
    version: pick('authorDetailsVersion'),
  }
})

// Books in the user's library by this author.
const ownedBooksCount = computed(() => author.value?.books?.length || 0)

const hasAnyDetail = computed(() => {
  const d = authorDetails.value
  return !!(d.birthDate || d.deathDate || d.nationality || d.spouseName || d.childrenCount !== null || d.latestWork)
})

const authorAge = computed(() => {
  const { birthDate, deathDate } = authorDetails.value
  if (!birthDate) return null
  const birthYear = parseInt(birthDate.slice(-4), 10)
  if (!birthYear) return null
  const endYear = deathDate ? parseInt(deathDate.slice(-4), 10) : new Date().getFullYear()
  const age = endYear - birthYear
  return age > 0 && age < 130 ? age : null
})

const fetchAuthor = () => {
  const authorName = decodeURIComponent(route.params.id)
  const authorBooks = globalBooks.value.filter(b => b.author === authorName)
  const authorInfo = globalAuthors.value.find(a => a.name === authorName)

  if (authorBooks.length > 0) {
    author.value = {
      name: authorName,
      image: authorInfo?.image ?? authorBooks.find(b => b.authorImage)?.authorImage ?? null,
      bio: authorInfo?.bio ?? authorBooks.find(b => b.authorBio)?.authorBio ?? null,
      books: authorBooks,
    }
    error.value = null
  } else if (initialized.value) {
    error.value = 'Author not found in your library.'
    author.value = null
  }
  loading.value = false
}

watchEffect(() => {
  if (!initialized.value) {
    loading.value = true
    return
  }
  fetchAuthor()
})

// Fetch bio and details on first visit if this author has none stored yet
const detailsFetchedFor = ref(null)
watch(author, async (current) => {
  if (!current?.name || detailsFetchedFor.value === current.name) return
  const needsFetch = !current.bio || !hasAnyDetail.value || authorDetails.value.version !== 5
  if (!needsFetch) return
  detailsFetchedFor.value = current.name
  bioLoading.value = true
  try {
    await fetchAndStoreAuthorDetails(current.name, { force: true })
  } finally {
    bioLoading.value = false
  }
})

const handleImageClick = () => {
  authorImageStage.value = 'choice'
  showAuthorImageModal.value = true
}

const closeAuthorImageModal = () => {
  if (isScraping.value) return
  showAuthorImageModal.value = false
  authorImageStage.value = 'choice'
}

const triggerFileUpload = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      await updateAuthorImage(reader.result)
      addToast('Image uploaded successfully', 'success')
    }
    reader.readAsDataURL(file)
  }
  input.click()
  showAuthorImageModal.value = false
}

const searchAuthorImages = async () => {
  if (!author.value) return
  try {
    isScraping.value = true
    authorImageStage.value = 'results'
    imageOptions.value = []
    const images = await fetchAuthorImageResults(author.value.name)
    if (images.length > 0) {
      imageOptions.value = images
    } else {
      addToast('Could not find any suitable images on the web.', 'error')
    }
  } catch (err) {
    console.error('Scrape failed:', err)
    addToast('Failed to search for images.', 'error')
  } finally {
    isScraping.value = false
  }
}

const selectImage = async (image) => {
  showAuthorImageModal.value = false
  await updateAuthorImage(image.url)
  addToast('Author image updated', 'success')
}

const removeImageOption = (image) => {
  imageOptions.value = imageOptions.value.filter(option => option.url !== image.url)
}

const updateAuthorImage = async (newImageUrl) => {
  try {
    isScraping.value = true
    const authorName = author.value.name
    await useLibraryStore().updateAuthorImage(authorName, newImageUrl)
    if (author.value) author.value = { ...author.value, image: newImageUrl }
    await fetchAllData(true)
  } catch (err) {
    console.error('Update failed:', err)
    addToast('Failed to update image.', 'error')
  } finally {
    isScraping.value = false
  }
}

const authorWorks = computed(() => groupAuthorWorks(author.value?.books || []))
const standaloneBooks = computed(() => authorWorks.value.standaloneBooks)
const authorSeries = computed(() => authorWorks.value.seriesGroups)
const collectionStats = computed(() => buildAuthorCollectionStats({
  ownedBooks: ownedBooksCount.value,
  totalBooks: authorDetails.value.validatedBooksCount,
  ownedSeries: authorSeries.value.length,
  totalSeries: authorDetails.value.validatedSeriesCount,
}))

const handlePlay = (book) => {
  if (ttsBook.value?.id === book.id && ttsStatus.value !== 'idle') {
    toggleTTS()
    return
  }
  playTTS(book)
}

const isBookActive = (book) => (
  ttsBook.value?.id === book.id && ttsStatus.value !== 'idle'
)

const deleteAuthorBook = (book) => {
  bookToDelete.value = book
  showDeleteModal.value = true
}

const confirmDeleteAuthorBook = async () => {
  if (bookToDelete.value) {
    await deleteBook(bookToDelete.value.id)
    fetchAuthor()
  }
  showDeleteModal.value = false
  bookToDelete.value = null
}
</script>

<style scoped>
.author-detail-page {
  min-height: 100vh;
}

.author-layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  min-height: 100vh;
  gap: 0;
}

/* Sidebar */
.author-sidebar {
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-card);
  border-radius: 10px;
  padding: 1.5rem;
  position: sticky;
  top: 0;
  height: fit-content;
  max-height: calc(100vh - 3rem);
  overflow-y: auto;
  align-self: start;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  cursor: pointer;
  margin-bottom: 1.5rem;
  padding: 0;
  transition: color 0.2s;
}

.back-btn:hover {
  color: var(--color-brand-primary);
}

.author-profile {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

/* Avatar */
.avatar-frame {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  margin-bottom: 1.25rem;
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
  border: 3px solid var(--color-brand-primary-soft);
  overflow: hidden;
  box-shadow: var(--shadow-cover);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.avatar-initial {
  width: 100%;
  height: 100%;
  background: var(--color-brand-primary-muted);
  color: var(--color-brand-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3.5rem;
  font-weight: 500;
}

.avatar-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
  opacity: 0;
  transition: opacity 0.2s;
  font-size: 0.8rem;
  gap: 0.2rem;
}

.avatar-frame:hover .avatar-overlay {
  opacity: 1;
}

.avatar-loading {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 1.5rem;
  z-index: 5;
}

.spin-icon {
  animation: spin 0.85s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.author-name {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 0.75rem;
  line-height: 1.2;
}

/* Stats */
.author-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  margin-bottom: 1.25rem;
}

.stat-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.1;
}

.stat-total {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-muted);
}

.stat-label {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-top: 0.1rem;
}

.stats-caption {
  text-align: center;
  font-size: 0.68rem;
  color: var(--color-text-subtle);
  margin: -0.5rem 0 1.25rem;
}

/* Detail list */
.detail-list {
  width: 100%;
  border: 1px solid var(--color-border-card);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 1.25rem;
  text-align: left;
}

.detail-row {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid var(--color-border-subtle);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-icon {
  color: var(--color-brand-primary);
  font-size: 0.85rem;
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.detail-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.detail-label {
  font-size: 0.68rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1.2;
}

.detail-value {
  font-size: 0.8rem;
  color: var(--color-text-primary);
  line-height: 1.3;
}

/* Bio */
.bio-section,
.notable-section {
  width: 100%;
  text-align: left;
  margin-bottom: 1rem;
}

.bio-heading {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 0.5rem;
}

.bio-text {
  font-size: 0.82rem;
  line-height: 1.65;
  color: var(--color-text-secondary);
  margin: 0;
}

.bio-skeleton-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.bio-skeleton {
  display: block;
  height: 0.75rem;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    var(--color-surface-tertiary) 25%,
    var(--color-surface-hover) 37%,
    var(--color-surface-tertiary) 63%
  );
  background-size: 400% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

.bio-skeleton.wide { width: 100%; }
.bio-skeleton.medium { width: 78%; }
.bio-skeleton.short { width: 52%; }

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Notable works */
.notable-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.notable-item {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  padding: 0.2rem 0;
  border-bottom: 1px solid var(--color-border-subtle);
  line-height: 1.4;
}

.notable-item:last-child {
  border-bottom: none;
}

/* Main content */
.books-main {
  padding: 0 0 2rem 2rem;
  min-width: 0;
}

.work-section {
  margin-bottom: 2.5rem;
}

.section-header {
  margin-bottom: 1.25rem;
}

.section-header h2 {
  font-size: 1.25rem;
  font-weight: 500;
  color: var(--color-text-primary);
  margin: 0 0 0.5rem;
}

.accent-line {
  width: 40px;
  height: 3px;
  background: var(--color-brand-primary);
  border-radius: 2px;
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

/* Empty / loading / error states */
.empty-state {
  text-align: center;
  padding: 5rem 0;
  color: var(--color-text-muted);
}

.empty-state i {
  font-size: 2.5rem;
  margin-bottom: 0.75rem;
  display: block;
}

.loading-state {
  padding: 2rem;
}

.error-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.error-card {
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-card);
  border-radius: 10px;
  padding: 2rem;
  text-align: center;
  max-width: 360px;
}

.error-card i {
  font-size: 2.5rem;
  color: var(--color-status-danger);
  margin-bottom: 0.75rem;
}

.error-card h3 {
  margin: 0 0 0.5rem;
  color: var(--color-text-primary);
}

.error-card p {
  color: var(--color-text-muted);
  margin: 0 0 1.25rem;
  font-size: 0.9rem;
}

.retry-btn {
  background: var(--color-brand-primary);
  color: var(--color-text-on-brand);
  border: none;
  border-radius: 7px;
  padding: 0.5rem 1.25rem;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background 0.15s;
}

.retry-btn:hover {
  background: var(--color-brand-primary-hover);
}

@media (max-width: 900px) {
  .author-layout {
    grid-template-columns: 1fr;
  }

  .author-sidebar {
    position: relative;
    top: auto;
    max-height: none;
    height: auto;
  }

  .books-main {
    padding: 1.5rem 0 2rem;
  }
}
</style>
