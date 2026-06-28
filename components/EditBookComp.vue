<template>
  <div class="add-book-page">
    <div class="page-header">
      <div>
        <h1>Edit Book</h1>
        <p class="subtitle">Modify the book's metadata, update its cover, or fetch fresh details from the web.</p>
      </div>
      <button class="btn-cancel" @click="goBack">Back to Library</button>
    </div>

    <div v-if="isLoading" class="loading-state">
      <SkeletonLoader variant="form" />
    </div>

    <template v-else>
      <!-- Metadata Selection Modal -->
      <div v-if="showMetadataModal" class="metadata-modal-overlay" @click="closeMetadataModal">
        <div class="metadata-modal-container" @click.stop>
          <div class="metadata-modal-header">
            <h2>Select Metadata</h2>
            <button class="close-button" @click="closeMetadataModal">
              <i class="ri-close-line"></i>
            </button>
          </div>
          <div v-if="showMetadataProgress" class="metadata-loading">
            <MultiStepLoader
              :loading="true"
              :loading-states="metadataLoadingStates"
              :duration="1450"
              :loop="false"
              eyebrow="Metadata fetch in progress"
              detail="Publisher-site lookup runs after the normal providers return a publisher name."
            />
            <div v-if="!isFetchingMetadata" class="metadata-progress-actions">
              <p class="metadata-progress-summary">
                {{ metadataResults.length ? `${metadataResults.length} metadata option${metadataResults.length === 1 ? '' : 's'} ready.` : 'Search finished with no metadata options.' }}
              </p>
              <button class="btn-primary metadata-continue-button" type="button" @click="continueToMetadataResults">
                Continue
              </button>
            </div>
          </div>
          <div v-else-if="metadataResults.length === 0" class="metadata-empty">
            <p>No results found for "{{ editBook.title }}" by "{{ editBook.author || 'any' }}".</p>
          </div>
          <div v-else class="metadata-results">
            <div 
              v-for="result in metadataResults" 
              :key="result.googleId" 
              class="metadata-card"
              @click="selectMetadata(result)"
            >
              <img :src="result.cover || '/default-cover.png'" alt="Cover" class="metadata-cover" />
              <div class="metadata-info">
                <h4>{{ result.title }}</h4>
                <p class="metadata-author">{{ result.author }}</p>
                <div class="metadata-source-tags" v-if="metadataSourceTags(result).length">
                  <span
                    v-for="source in metadataSourceTags(result)"
                    :key="source"
                    class="metadata-source-tag"
                    :class="{ publisher: source === 'publisher' }"
                    :title="sourceTooltip(source, result)"
                  >
                    <i :class="source === 'publisher' ? 'ri-building-4-line' : 'ri-links-line'"></i>
                    {{ sourceLabel(source, result) }}
                  </span>
                </div>
                <p class="metadata-year" v-if="result.publishYear">{{ result.publishYear }} <span v-if="result.genre">• {{ result.genre }}</span></p>
                <p class="metadata-series" v-if="result.series">{{ result.series }} <span v-if="result.seriesInstallment">#{{ result.seriesInstallment }}</span></p>
                <GoodreadsRatingDisplay
                  v-if="result.webReview"
                  :web-review="result.webReview"
                  compact
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <CoverImageModal
        :visible="showCoverModal"
        :mode="coverModalMode"
        :loading="isSearchingCovers"
        :images="coverOptions"
        @close="closeCoverModal"
        @upload="triggerCoverInput"
        @search="searchBookCovers"
        @select="selectBookCover"
      />

      <!-- Blurb chooser — opens when picking metadata reveals multiple distinct blurbs -->
      <div v-if="showBlurbChooser" class="metadata-modal-overlay" @click="closeBlurbChooser">
        <div class="metadata-modal-container" @click.stop>
          <div class="metadata-modal-header">
            <div>
              <h2>Choose a description</h2>
              <p class="blurb-modal-subtitle">Multiple sources had different blurbs for this book — pick the one you prefer.</p>
            </div>
            <button class="close-button" type="button" @click="closeBlurbChooser">
              <i class="ri-close-line"></i>
            </button>
          </div>
          <div class="blurb-options">
            <button
              v-for="option in blurbOptions"
              :key="option.source + option.blurb.slice(0, 40)"
              class="blurb-option"
              :class="{ active: pendingBlurb === option.blurb }"
              type="button"
              @click="pickBlurb(option.blurb)"
            >
              <div class="blurb-option-source">
                <i class="ri-quill-pen-line"></i>
                {{ sourceLabel(option.source) }}
              </div>
              <p class="blurb-option-text">{{ option.blurb }}</p>
            </button>
          </div>
          <div class="blurb-modal-actions">
            <button class="btn-cancel" type="button" @click="closeBlurbChooser">Keep current</button>
          </div>
        </div>
      </div>

      <form @submit.prevent="handleUpdateBook" class="add-form">
        <!-- Media Section -->
        <div class="media-column">
          <!-- Cover Upload -->
          <div class="cover-container" @click="openCoverModal">
            <img v-if="coverPreview || editBook.cover" :src="coverPreview || editBook.cover" alt="Book Cover" class="cover-image" />
            <div v-else class="cover-placeholder">
              <i class="ri-image-add-line"></i>
              <span>Upload Cover</span>
            </div>
            <div class="cover-overlay" :class="{ 'active': coverPreview || editBook.cover }">
              <i class="ri-camera-line"></i>
              <span>Change Cover</span>
            </div>
            <input 
              type="file" 
              ref="coverInput" 
              @change="handleCoverChange" 
              accept="image/*" 
              style="display: none" 
            />
          </div>
          
          <div class="info-card">
            <div class="info-item">
              <span class="info-label">Format</span>
              <span class="info-value">{{ editBook.format ? editBook.format.toUpperCase() : 'Unknown' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Current Progress</span>
              <span class="info-value">{{ editBook.progress }}%</span>
            </div>
          </div>
        </div>

        <!-- Details Section -->
        <div class="details-column">
          <!-- Web Fetch CTA -->
          <div class="fetch-metadata-card">
            <div class="fetch-info">
              <i class="ri-file-search-line"></i>
              <div>
                <strong>Update with Web Metadata</strong>
                <p>Refresh the cover, blurb, and details using search data from the web.</p>
              </div>
            </div>
            <button type="button" class="btn-fetch" @click="fetchMetadata" :disabled="!editBook.title">
              Fetch Metadata
            </button>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="title">Book Title <span class="required">*</span></label>
              <input 
                type="text" 
                id="title" 
                v-model="editBook.title" 
                required 
                class="form-input"
                placeholder="e.g. The Lord of the Rings"
              />
            </div>
            <div class="form-group">
              <label for="author">Author <span class="required">*</span></label>
              <input 
                type="text" 
                id="author" 
                v-model="editBook.author" 
                required 
                class="form-input"
                placeholder="e.g. J.R.R. Tolkien"
              />
            </div>
          </div>

          <div class="form-group">
            <label for="blurb">Blurb / Description</label>
            <textarea 
              id="blurb" 
              v-model="editBook.blurb" 
              class="form-input textarea"
              placeholder="Book description..."
              rows="6"
            ></textarea>
          </div>

          <div class="form-group">
            <label>Book Type</label>
            <div class="radio-group">
              <label class="radio-option" :class="{ active: bookKind === 'standalone' }">
                <input type="radio" value="standalone" v-model="bookKind" @change="handleBookKindChange" />
                <span>Standalone</span>
              </label>
              <label class="radio-option" :class="{ active: bookKind === 'series' }">
                <input type="radio" value="series" v-model="bookKind" />
                <span>Series</span>
              </label>
            </div>
          </div>

          <div class="form-row" v-if="bookKind === 'series'">
            <div class="form-group">
              <label for="series">Series</label>
              <input 
                type="text" 
                id="series" 
                v-model="editBook.series" 
                placeholder="e.g. Middle-earth Universe"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="seriesInstallment">Number / Installment</label>
              <input
                type="text"
                id="seriesInstallment"
                v-model="editBook.seriesInstallment"
                placeholder="e.g. 1"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="seriesTotal">Total in Series</label>
              <input
                type="number"
                id="seriesTotal"
                v-model.number="editBook.seriesTotal"
                placeholder="e.g. 6"
                class="form-input"
                min="1"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="publishYear">Publish Year</label>
              <input 
                type="number" 
                id="publishYear" 
                v-model="editBook.publishYear" 
                placeholder="e.g. 1954"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="genre">Genre</label>
              <input 
                type="text" 
                id="genre" 
                v-model="editBook.genre" 
                placeholder="e.g. Fantasy, Adventure"
                class="form-input"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="status">Reading Status</label>
              <BookishSelect
                input-id="status"
                v-model="editBook.status"
                :options="['Unread', 'Reading', 'Read']"
              />
            </div>
            <div class="form-group">
              <label>Personal Rating</label>
              <div class="rating-input-container">
                <div class="star-rating">
                  <i 
                    v-for="n in 10" 
                    :key="n"
                    class="rating-star"
                    :class="{ 
                      'ri-star-fill': n <= editBook.rating,
                      'ri-star-line': n > editBook.rating,
                      'active': n <= editBook.rating 
                    }"
                    @click="editBook.rating = n"
                  ></i>
                </div>
                <span class="rating-display">{{ editBook.rating || 0 }}/10</span>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="web-review-label">Goodreads Rating & Reviews</label>
            <div class="readonly-review">
              <GoodreadsRatingDisplay :web-review="editBook.webReview" show-empty />
            </div>
          </div>

          <div class="page-actions">
            <button type="submit" class="btn-primary" :disabled="isUpdating">
              <i class="ri-save-line" v-if="!isUpdating"></i>
              <i class="ri-loader-4-line spinner" v-else></i>
              {{ isUpdating ? 'Saving Changes...' : 'Save Changes' }}
            </button>
          </div>
        </div>
      </form>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useBooks } from '~/composables/useBooks'
import { useToast } from '~/composables/useToast'
import { fetchBookMetadataResults } from '~/composables/useBookMetadataSearch'
import { propagateSeriesTotal } from '~/composables/useSeriesProgress'
import { useCoverImageCache } from '~/composables/useCoverImageCache'
import CoverImageModal from './CoverImageModal.vue'
import GoodreadsRatingDisplay from './GoodreadsRatingDisplay.vue'
import MultiStepLoader from './MultiStepLoader.vue'

const props = defineProps({
  bookId: {
    type: String,
    required: true
  }
})

const router = useRouter()
const { fetchBookById, updateBook, books } = useBooks()
const { addToast } = useToast()
const { cacheCoverImage } = useCoverImageCache()

const editBook = ref({
  title: '',
  author: '',
  blurb: '',
  series: '',
  seriesInstallment: '',
  seriesTotal: null,
  publishYear: null,
  publisher: '',
  webReview: '',
  format: '',
  pages: 0,
  rating: 0,
  progress: 0,
  status: 'Unread',
  isFavourite: false,
  genre: ''
})

const isLoading = ref(true)
const isUpdating = ref(false)
const coverPreview = ref(null)
const coverInput = ref(null)

const showMetadataModal = ref(false)
const isFetchingMetadata = ref(false)
const metadataResults = ref([])
const showMetadataProgress = ref(false)
const showCoverModal = ref(false)
const coverModalMode = ref('choice')
const isSearchingCovers = ref(false)
const coverOptions = ref([])
const bookKind = ref('standalone')

const createMetadataLoadingStates = () => [
  { id: 'core', text: 'Searching core metadata providers', status: 'pending' },
  { id: 'publisherName', text: 'Reading publisher names from book records', status: 'pending' },
  { id: 'publisherSearch', text: 'Finding real publisher book pages', status: 'pending' },
  { id: 'publisherScrape', text: 'Scraping publisher blurbs and cover images', status: 'pending' },
  { id: 'merge', text: 'Merging publisher results into choices', status: 'pending' },
]

const metadataLoadingStates = ref(createMetadataLoadingStates())

const resetMetadataProgress = () => {
  metadataLoadingStates.value = createMetadataLoadingStates()
}

const closeMetadataModal = () => {
  showMetadataModal.value = false
  if (!isFetchingMetadata.value) {
    showMetadataProgress.value = false
  }
}

const continueToMetadataResults = () => {
  showMetadataProgress.value = false
}

const updateMetadataProgress = (event) => {
  const index = metadataLoadingStates.value.findIndex((state) => state.id === event.id)
  if (index === -1) return
  const current = metadataLoadingStates.value[index]
  metadataLoadingStates.value[index] = {
    ...current,
    status: event.status,
    detail: event.detail || current.detail,
  }
}

watch(
  () => editBook.value.status,
  (status) => {
    if (status === 'Read') {
      editBook.value.progress = 100
    }
  },
)

const openCoverModal = () => {
  coverModalMode.value = 'choice'
  showCoverModal.value = true
}

const closeCoverModal = () => {
  showCoverModal.value = false
  coverModalMode.value = 'choice'
}

const triggerCoverInput = () => {
  closeCoverModal()
  coverInput.value?.click()
}

const goBack = () => {
  router.push('/books')
}

onMounted(async () => {
  try {
    // Find book in already loaded books first for instant feel
    const existing = books.value.find(b => b.id.toString() === props.bookId.toString())
    if (existing) {
      editBook.value = JSON.parse(JSON.stringify(existing))
    } else {
      // Fallback to fetch if not found
      const fetched = fetchBookById(props.bookId)
      if (fetched) {
        editBook.value = fetched
      } else {
        addToast('Book not found', 'error')
        router.push('/books')
      }
    }
    bookKind.value = editBook.value.series || editBook.value.seriesInstallment ? 'series' : 'standalone'
  } catch (err) {
    console.error('Error loading book:', err)
    addToast('Failed to load book details', 'error')
  } finally {
    isLoading.value = false
  }
})

const handleCoverChange = (event) => {
  const file = event.target.files[0]
  if (file) {
    closeCoverModal()
    const reader = new FileReader()
    reader.onload = (e) => { 
      coverPreview.value = e.target.result 
      editBook.value.cover = e.target.result
    }
    reader.readAsDataURL(file)
  }
}

const searchBookCovers = async () => {
  if (!editBook.value.title) {
    addToast('Enter a title before searching for covers.', 'error')
    return
  }

  coverModalMode.value = 'picker'
  isSearchingCovers.value = true
  coverOptions.value = []

  try {
    const query = new URLSearchParams()
    query.append('title', editBook.value.title)
    if (editBook.value.author) query.append('author', editBook.value.author)
    if (editBook.value.publisher) query.append('publisher', editBook.value.publisher)

    const response = await fetch(`/api/books/search-covers?${query.toString()}`)
    const data = await response.json()
    coverOptions.value = data.images || []
    if (!coverOptions.value.length) {
      addToast('No cover images found on the web.', 'error')
    }
  } catch (error) {
    console.error('Failed to search covers:', error)
    addToast('Failed to search for cover images.', 'error')
  } finally {
    isSearchingCovers.value = false
  }
}

const selectBookCover = (imageUrl) => {
  // Close immediately so the user isn't waiting on the cache round-trip.
  closeCoverModal()
  editBook.value.cover = imageUrl
  coverPreview.value = imageUrl
  cacheCoverImage(imageUrl)
    .then((cached) => {
      if (cached) {
        editBook.value.cover = cached
        coverPreview.value = cached
      }
    })
    .catch((error) => {
      console.warn('Cover caching failed:', error)
    })
}

const fetchMetadata = async () => {
  if (!editBook.value.title) return;
  
  isFetchingMetadata.value = true;
  showMetadataProgress.value = true;
  showMetadataModal.value = true;
  metadataResults.value = [];
  resetMetadataProgress();

  try {
    metadataResults.value = await fetchBookMetadataResults(
      editBook.value.title,
      editBook.value.author,
      editBook.value.publisher,
      { onProgress: updateMetadataProgress },
    );
  } catch (error) {
    console.error('Failed to fetch metadata:', error);
    addToast('Failed to fetch metadata from the web.', 'error');
  } finally {
    isFetchingMetadata.value = false;
  }
}

const showBlurbChooser = ref(false)
const blurbOptions = ref([])
const pendingBlurb = ref('')

const sourceLabel = (source, result = null) => {
  switch (source) {
    case 'googleBooks': return 'Google Books'
    case 'goodreads': return 'Goodreads'
    case 'openLibrary': return 'Open Library'
    case 'internetArchive': return 'Internet Archive'
    case 'kobo': return 'Kobo'
    case 'publisher': {
      const publisher = result?.publisherSource
      const name = publisher?.name
      const site = publisher?.site
      if (name && site) return `Publisher site: ${name} (${site})`
      if (site) return `Publisher site: ${site}`
      if (name) return `Publisher site: ${name}`
      return "Publisher's site"
    }
    default: return source
  }
}

const sourceTooltip = (source, result) => {
  if (source !== 'publisher') return sourceLabel(source, result)
  const publisher = result?.publisherSource
  const details = []
  if (publisher?.url) details.push(`Publisher page: ${publisher.url}`)
  if (publisher?.searchedName) details.push(`Found by searching publisher record: ${publisher.searchedName}`)
  return details.length ? details.join('\n') : sourceLabel(source, result)
}

const metadataSourceTags = (result) => {
  if (Array.isArray(result?.sourceTags) && result.sourceTags.length) return result.sourceTags
  const id = String(result?.googleId || '')
  if (id.startsWith('ia:')) return ['internetArchive']
  if (id.startsWith('/works/')) return ['openLibrary']
  if (id.startsWith('gb:')) return ['googleBooks']
  if (id.includes('goodreads.com')) return ['goodreads']
  if (id.includes('kobo.com')) return ['kobo']
  return []
}

const openBlurbChooser = (options) => {
  blurbOptions.value = options
  pendingBlurb.value = editBook.value.blurb
  showBlurbChooser.value = true
}

const closeBlurbChooser = () => {
  showBlurbChooser.value = false
  blurbOptions.value = []
}

const pickBlurb = (blurb) => {
  pendingBlurb.value = blurb
  editBook.value.blurb = blurb
  closeBlurbChooser()
  addToast('Description updated', 'success')
}

const selectMetadata = (result) => {
  editBook.value.title = result.title || editBook.value.title;
  editBook.value.author = result.author || editBook.value.author;
  editBook.value.blurb = result.blurb || editBook.value.blurb;
  editBook.value.publishYear = result.publishYear || editBook.value.publishYear;
  editBook.value.publisher = result.publisher || editBook.value.publisher;
  editBook.value.series = result.series || editBook.value.series;
  editBook.value.seriesInstallment = result.seriesInstallment || editBook.value.seriesInstallment;
  editBook.value.seriesTotal = result.seriesTotal ? Number(result.seriesTotal) : (editBook.value.seriesTotal || null);
  editBook.value.webReview = result.webReview || editBook.value.webReview;
  editBook.value.genre = result.genre || editBook.value.genre;
  if (editBook.value.series || editBook.value.seriesInstallment) {
    bookKind.value = 'series';
  }

  // Close immediately; cache the cover in the background so the user doesn't wait.
  showMetadataModal.value = false;
  addToast('Metadata applied successfully', 'success');

  if (result.cover) {
    editBook.value.cover = result.cover;
    coverPreview.value = result.cover;
    cacheCoverImage(result.cover)
      .then((cached) => {
        if (cached) {
          editBook.value.cover = cached;
          coverPreview.value = cached;
        }
      })
      .catch((error) => {
        console.warn('Cover caching failed:', error);
      });
  }

  // Offer a blurb chooser when sources disagreed on the description.
  const options = Array.isArray(result.blurbOptions) ? result.blurbOptions : [];
  if (options.length > 1) {
    openBlurbChooser(options);
  }
}

const handleBookKindChange = () => {
  if (bookKind.value === 'standalone') {
    editBook.value.series = ''
    editBook.value.seriesInstallment = ''
    editBook.value.seriesTotal = null
  }
}

const handleUpdateBook = async () => {
  if (isUpdating.value) return
  
  isUpdating.value = true;
  const cachedCover = await cacheCoverImage(editBook.value.cover);

  const bookToUpdate = {
    ...editBook.value,
    progress: editBook.value.status === 'Read' ? 100 : editBook.value.progress,
    cover: cachedCover || editBook.value.cover,
  }
  
  if (bookKind.value === 'standalone' || !bookToUpdate.series || bookToUpdate.series.trim() === '') {
    bookToUpdate.series = null
    bookToUpdate.seriesInstallment = null
    bookToUpdate.seriesTotal = null
  }
  
  try {
    await updateBook(bookToUpdate);
    if (bookToUpdate.series && Number(bookToUpdate.seriesTotal) > 0) {
      await propagateSeriesTotal({
        seriesName: bookToUpdate.series,
        seriesTotal: bookToUpdate.seriesTotal,
        books: books.value,
        updateBook,
      });
    }
    addToast('Book updated successfully', 'success');
    router.push('/books');
  } catch (error) {
    console.error('Update error:', error);
    addToast('Failed to update book', 'error');
  } finally {
    isUpdating.value = false;
  }
}
</script>

<style scoped>
.add-book-page {
  padding: 0rem;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2.5rem;
}

.page-header h1 {
  font-size: 1.5rem;
  font-weight: 400;
  color: var(--color-text-primary);
  margin: 0 0 0.5rem 0;
  letter-spacing: -0.02em;
}

.subtitle {
  font-size: 1rem;
  color: var(--color-text-muted);
  margin: 0;
}

.btn-cancel {
  padding: 0.75rem 1.5rem;
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-card);
  border-radius: 10px;
  color: var(--color-text-primary);
  font-weight: 400;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-cancel:hover {
  background: var(--color-surface-hover);
}

.loading-state {
  width: 100%;
}

.spinner {
  display: inline-block;
  animation: spin 0.85s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.add-form {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 3rem;
  background: var(--color-surface-card);
  padding: 2.5rem;
  border-radius: 20px;
  border: 1px solid var(--color-border-card);
}

.media-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.cover-container {
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: 12px;
  background: var(--color-surface-secondary);
  border: 2px dashed var(--color-border-subtle);
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-container:hover {
  border-color: var(--color-brand-primary);
  background: var(--color-surface-active);
}

.cover-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-text-muted);
}

.cover-placeholder i {
  font-size: 2.5rem;
}

.cover-placeholder span {
  font-size: 0.95rem;
  font-weight: 400;
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-overlay {
  position: absolute;
  inset: 0;
  background: var(--color-background-overlay-strong);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-text-on-brand);
  opacity: 0;
  transition: opacity 0.2s;
  gap: 0.5rem;
}

.cover-container:hover .cover-overlay.active {
  opacity: 1;
}

.cover-overlay i {
  font-size: 2rem;
}

.info-card {
  padding: 1.25rem;
  background: var(--color-surface-secondary);
  border: 1px solid var(--color-border-subtle);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-subtle);
  font-weight: 400;
}

.info-value {
  font-size: 0.95rem;
  color: var(--color-text-primary);
}

.details-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.fetch-metadata-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem;
  border: 1px solid var(--color-brand-primary);
  border-radius: 12px;
  margin-bottom: 0.5rem;
}

.fetch-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.fetch-info i {
  font-size: 2rem;
  color: var(--color-brand-primary);
}

.web-review-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.goodreads-svg-inline {
  width: 18px;
  height: 18px;
}

.fetch-info .goodreads-svg {
  width: 40px;
  height: 40px;
}

.fetch-info strong {
  display: block;
  font-size: 1rem;
  color: var(--color-text-primary);
}

.fetch-info p {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.btn-fetch {
  padding: 0.75rem 1.5rem;
  background: var(--color-brand-primary);
  color: var(--color-text-on-brand);
  border: none;
  border-radius: 8px;
  font-weight: 400;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: var(--shadow-brand-button);
}

.btn-fetch:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-brand-button-hover);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: 0.9rem;
  font-weight: 400;
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.radio-group {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.form-group .radio-option {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.8rem 1rem;
  background: var(--color-surface-secondary);
  border: 1px solid var(--color-border-subtle);
  border-radius: 10px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.form-group .radio-option:hover,
.form-group .radio-option.active {
  border-color: var(--color-brand-primary);
  background: var(--color-surface-active);
  color: var(--color-text-primary);
}

.form-group .radio-option input {
  accent-color: var(--color-brand-primary);
}

.required {
  color: var(--color-status-danger-bright);
}

.form-input {
  width: 100%;
  padding: 0.85rem 1rem;
  background: var(--color-surface-secondary);
  border: 1px solid var(--color-border-subtle);
  border-radius: 10px;
  font-size: 0.95rem;
  color: var(--color-text-primary);
  transition: all 0.2s;
  font-family: inherit;
}

.form-input.textarea {
  resize: vertical;
  min-height: 120px;
}

.form-input:focus {
  outline: none;
  background: var(--color-surface-primary);
  border-color: var(--color-brand-primary);
  box-shadow: var(--shadow-focus-ring);
}

.select-wrapper {
  position: relative;
}

.custom-select {
  appearance: none;
  cursor: pointer;
  padding-right: 2.5rem;
}

.select-icon {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  pointer-events: none;
}

.rating-input-container {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0.5rem 0;
}

.star-rating {
  display: flex;
  gap: 0.25rem;
}

.rating-star {
  font-size: 1.75rem;
  color: var(--color-border-strong);
  cursor: pointer;
  transition: all 0.2s;
}

.rating-star:hover,
.rating-star.active {
  color: var(--color-status-star);
  transform: scale(1.1);
}

.rating-display {
  font-size: 1.1rem;
  color: var(--color-text-secondary);
  font-weight: 400;
  background: var(--color-surface-tertiary);
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
}

.readonly-review {
  padding: 1rem;
  background: var(--color-surface-secondary);
  border: 1px solid var(--color-border-subtle);
  border-radius: 10px;
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.readonly-review :deep(.goodreads-rating),
.metadata-info :deep(.goodreads-rating) {
  flex-wrap: wrap;
  row-gap: 0.25rem;
}

.page-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1.5rem;
  padding-top: 2rem;
  border-top: 1px solid var(--color-border-subtle);
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 2rem;
  background: var(--gradient-brand-primary);
  border: none;
  border-radius: 10px;
  color: var(--color-text-on-brand);
  font-weight: 400;
  font-size: 1rem;
  cursor: pointer;
  box-shadow: var(--shadow-brand-button);
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-brand-button-hover);
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* Metadata Modal Styles (Reused from AddBookComp) */
.metadata-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-background-overlay-strong);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.metadata-modal-container {
  background: var(--color-surface-primary);
  border-radius: 20px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: var(--shadow-modal);
}

.metadata-modal-header {
  padding: 1.5rem 2rem;
  border-bottom: 1px solid var(--color-surface-tertiary);
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  background: var(--color-surface-primary);
  z-index: 1;
}

.metadata-modal-header h2 {
  font-size: 1.25rem;
  margin: 0;
  font-weight: 400;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--color-text-muted);
}

.metadata-results {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.metadata-card {
  display: flex;
  gap: 1.5rem;
  padding: 1rem;
  border: 1px solid var(--color-surface-tertiary);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.metadata-card:hover {
  background: var(--color-surface-secondary);
  border-color: var(--color-brand-primary);
}

/* Blurb chooser */
.blurb-modal-subtitle {
  margin: 0.35rem 0 0;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  line-height: 1.4;
}

.blurb-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  overflow-y: auto;
}

.blurb-option {
  text-align: left;
  padding: 1rem;
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-card);
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-family: inherit;
  transition: background-color 0.2s, border-color 0.2s;
}

.blurb-option:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-brand-primary);
}

.blurb-option.active {
  border-color: var(--color-brand-primary);
  background: var(--color-surface-hover);
}

.blurb-option-source {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-brand-primary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.blurb-option-text {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  line-height: 1.55;
  white-space: pre-wrap;
}

.blurb-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem 1.25rem;
  border-top: 1px solid var(--color-border-card);
}

.metadata-cover {
  width: 80px;
  height: 120px;
  flex-shrink: 0;
  object-fit: cover;
  border-radius: 6px;
}

.metadata-info {
  flex: 1;
  min-width: 0;
}

.metadata-info h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  overflow-wrap: anywhere;
}

.metadata-author {
  color: var(--color-text-muted);
  font-size: 0.9rem;
  margin: 0 0 0.25rem 0;
}

.metadata-source-tags {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin: 0.2rem 0 0.35rem;
}

.metadata-source-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  max-width: 100%;
  padding: 0.25rem 0.45rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: 999px;
  background: var(--color-surface-secondary);
  color: var(--color-text-muted);
  font-size: 0.72rem;
  line-height: 1.15;
  white-space: nowrap;
}

.metadata-source-tag.publisher {
  border-color: var(--color-brand-primary);
  background: var(--color-brand-primary-faint);
  color: var(--color-brand-primary);
  white-space: normal;
  overflow-wrap: anywhere;
}

.metadata-source-tag i {
  font-size: 0.78rem;
  flex-shrink: 0;
}

.metadata-year {
  font-size: 0.85rem;
  color: var(--color-text-subtle);
}

.metadata-loading, .metadata-empty {
  padding: 1.5rem;
  color: var(--color-text-muted);
}

.metadata-progress-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.5rem 1.25rem;
  border-top: 1px solid var(--color-border-subtle);
}

.metadata-progress-summary {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

.metadata-continue-button {
  min-width: 110px;
  justify-content: center;
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .add-form {
    grid-template-columns: 1fr;
    padding: 1.5rem;
  }

  .media-column,
  .details-column {
    min-width: 0;
  }

  .media-column {
    max-width: 300px;
    margin: 0 auto;
  }

  /* minmax(0, 1fr) keeps the track from growing to the 10-star row's
     min-content width, which would otherwise overflow the viewport. */
  .form-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .form-group {
    min-width: 0;
  }

  .fetch-metadata-card {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .fetch-info {
    min-width: 0;
  }

  .btn-fetch {
    width: 100%;
    justify-content: center;
  }

  .rating-input-container {
    flex-wrap: wrap;
    gap: 0.5rem 0.75rem;
  }

  .star-rating {
    flex-wrap: wrap;
  }

  .rating-star {
    font-size: 1.5rem;
  }

  .page-actions {
    flex-direction: column;
  }

  .btn-primary {
    width: 100%;
    justify-content: center;
  }
}
</style>
