<template>
  <div class="add-book-page">
    <MobileSettingsNav title="Add Book" back-to="/books" aria-label="Book form navigation" />

    <!-- Metadata Selection Modal -->
    <div v-if="showMetadataModal" class="metadata-modal-overlay" @click="closeMetadataModal">
      <div class="metadata-modal-container" @click.stop>
        <div class="metadata-modal-header">
          <h2>Select Metadata</h2>
          <button class="close-button" @click="closeMetadataModal">
            <i class="ri-close-line"></i>
          </button>
        </div>
        <div class="metadata-modal-body">
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
            <p>No results found for "{{ newBook.title }}" by "{{ newBook.author || 'any' }}".</p>
          </div>
          <div v-else class="metadata-results">
          <label v-if="coverPreview" class="keep-cover-option">
            <input v-model="keepCurrentCover" type="checkbox" />
            <span>Keep my current book cover</span>
          </label>
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

    <!-- Blurb chooser — appears after picking metadata when sources disagree on the blurb -->
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

    <form @submit.prevent="saveBook" class="add-form">
      <!-- Media Section -->
      <div class="media-column">
        <!-- Cover Upload -->
        <div class="cover-container" @click="openCoverModal">
          <img v-if="coverPreview" :src="coverPreview" alt="Book Cover" class="cover-image" />
          <div v-else class="cover-placeholder">
            <i class="ri-image-add-line"></i>
            <span>Upload Cover</span>
          </div>
          <div class="cover-overlay" :class="{ 'active': coverPreview }">
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

        <!-- Document Upload -->
        <div class="document-section">
          <div 
            class="document-dropzone" 
            :class="{ 'has-file': documentFile, 'is-processing': isProcessing }"
            @click="triggerDocumentInput"
          >
            <div class="dropzone-icon">
              <i v-if="isProcessing" class="ri-loader-4-line spinner"></i>
              <i v-else-if="documentFile" class="ri-file-text-fill text-success"></i>
              <i v-else class="ri-upload-cloud-2-line"></i>
            </div>
            <div class="doc-info">
              <span class="doc-title">{{ isProcessing ? 'Processing File...' : (documentFile ? documentFile.name : 'Select Book Document') }}</span>
              <span class="doc-subtitle">{{ documentFile && !isProcessing ? formatFileSize(documentFile.size) : 'Supports .epub, .pdf, .txt' }}</span>
            </div>
          </div>
          <input
            type="file"
            ref="documentInput"
            @change="handleDocumentChange"
            accept=".epub,.pdf,.mobi,.azw3,.txt"
            style="display: none"
            required
          />
          <p v-if="extractionError" class="error-message">
            <i class="ri-error-warning-line"></i> {{ extractionError }}
          </p>
        </div>
      </div>

      <!-- Details Section -->
      <div class="details-column">
        <!-- Web Fetch CTA -->
        <div class="fetch-metadata-card">
          <div class="fetch-info">
            <i class="ri-file-search-line"></i>
            <div>
              <strong>Auto-fill Details</strong>
              <p>Search the web to automatically fetch book covers, blurbs, and details.</p>
            </div>
          </div>
          <button type="button" class="btn-fetch" @click="fetchMetadata" :disabled="!newBook.title">
            Fetch Metadata
          </button>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="title">Book Title <span class="required">*</span></label>
            <input 
              type="text" 
              id="title" 
              v-model="newBook.title" 
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
              v-model="newBook.author" 
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
            v-model="newBook.blurb" 
            class="form-input textarea"
            placeholder="Book description..."
            rows="4"
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
              v-model="newBook.series" 
              placeholder="e.g. Middle-earth Universe"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="seriesInstallment">Number / Installment</label>
            <input
              type="text"
              id="seriesInstallment"
              v-model="newBook.seriesInstallment"
              placeholder="e.g. 1"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="seriesTotal">Total in Series</label>
            <input
              type="number"
              id="seriesTotal"
              v-model.number="newBook.seriesTotal"
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
              v-model="newBook.publishYear" 
              placeholder="e.g. 1954"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="genre">Genre</label>
            <input 
              type="text" 
              id="genre" 
              v-model="newBook.genre" 
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
              v-model="newBook.status"
              :options="['Unread', 'Reading', 'Read']"
            />
          </div>
        </div>

        <div class="form-group">
          <label class="web-review-label">Goodreads Rating & Reviews</label>
          <div class="readonly-review">
            <GoodreadsRatingDisplay :web-review="newBook.webReview" show-empty />
          </div>
        </div>

        <div class="page-actions">
          <button type="submit" class="btn-primary" :disabled="!documentFile || isProcessing">
            <i class="ri-add-line" v-if="!isProcessing"></i>
            <i class="ri-loader-4-line spinner" v-else></i>
            {{ isProcessing ? 'Adding Book...' : 'Add Book to Library' }}
          </button>
        </div>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { reconcileStatusProgress, useBooks } from '~/composables/useBooks'
import { useToast } from '~/composables/useToast'
import { useBookStorage } from '~/composables/useBookStorage'
import { fetchBookMetadataResults } from '~/composables/useBookMetadataSearch'
import { fetchCoverImageResults } from '~/composables/useCoverSearch'
import { propagateSeriesTotal } from '~/composables/useSeriesProgress'
import { useCoverImageCache } from '~/composables/useCoverImageCache'
import { useApiEndpoint } from '~/composables/useApiEndpoint'
import BookishSelect from '~/components/shared/BookishSelect.vue'
import CoverImageModal from '~/components/shared/CoverImageModal.vue'
import GoodreadsRatingDisplay from '~/components/shared/GoodreadsRatingDisplay.vue'
import MultiStepLoader from '~/components/shared/MultiStepLoader.vue'
import MobileSettingsNav from './MobileSettingsNav.vue'

const router = useRouter()
const { addBook, books, updateBook } = useBooks()
const { addToast } = useToast()
const { saveBookContent } = useBookStorage()
const { cacheCoverImage } = useCoverImageCache()
const { apiUrl } = useApiEndpoint()
const extractedContent = ref(null)
const extractedTocTitles = ref([])
const extractedSource = ref(null)
const extractedTocItems = ref([])
const extractedPdfManifest = ref(null)

const newBook = ref({
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
  progress: 0,
  status: 'Unread',
  isFavourite: false,
  genre: ''
})

const coverPreview = ref(null)
// When checked, applying a metadata result leaves the existing cover alone.
const keepCurrentCover = ref(false)
const documentFile = ref(null)
const coverInput = ref(null)
const documentInput = ref(null)
const isProcessing = ref(false)
const extractionError = ref(null)

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
  () => newBook.value.status,
  (status, previous) => {
    if (status === previous) return
    newBook.value.progress = reconcileStatusProgress(status, newBook.value.progress)
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
const triggerDocumentInput = () => documentInput.value.click()

const goBack = () => {
  router.push('/books')
}

const handleCoverChange = (event) => {
  const file = event.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => { coverPreview.value = e.target.result }
    reader.readAsDataURL(file)
  }
}

const searchBookCovers = async () => {
  if (!newBook.value.title) {
    addToast('Enter a title before searching for covers.', 'error')
    return
  }

  coverModalMode.value = 'picker'
  isSearchingCovers.value = true
  coverOptions.value = []

  try {
    coverOptions.value = await fetchCoverImageResults(
      newBook.value.title,
      newBook.value.author,
      newBook.value.publisher,
    )
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
  // Close immediately so the user isn't waiting on the cache round-trip;
  // cache the cover in the background and swap to the local URL when it lands.
  closeCoverModal()
  coverPreview.value = imageUrl
  cacheCoverImage(imageUrl)
    .then((cached) => {
      if (cached) coverPreview.value = cached
    })
    .catch((error) => {
      console.warn('Cover caching failed:', error)
    })
}

const generateCoverPlaceholder = (title) => {
  const colors = getThemeCssVars([
    { name: '--color-book-cover-placeholder-one', fallback: '#8A2BE2' },
    { name: '--color-book-cover-placeholder-two', fallback: '#6A0DAD' },
    { name: '--color-book-cover-placeholder-three', fallback: '#9370DB' },
    { name: '--color-book-cover-placeholder-four', fallback: '#BA55D3' },
    { name: '--color-book-cover-placeholder-five', fallback: '#DDA0DD' },
  ])
  const hash = [...title].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const color = colors[hash % colors.length]
  const initial = title.trim()[0]?.toUpperCase() || '?'
  const displayTitle = title.length > 18 ? `${title.substring(0, 18)}...` : title
  const softText = getThemeCssVar('--color-book-cover-placeholder-text-soft', 'rgba(255,255,255,0.25)')
  const strongText = getThemeCssVar('--color-book-cover-placeholder-text-strong', 'rgba(255,255,255,0.65)')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="${color}"/><text x="100" y="130" font-family="serif" font-size="100" fill="${softText}" text-anchor="middle" dominant-baseline="middle">${initial}</text><text x="100" y="230" font-family="sans-serif" font-size="11" fill="${strongText}" text-anchor="middle">${displayTitle}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const handleDocumentChange = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  extractionError.value = null
  documentFile.value = file
  extractedContent.value = null
  extractedTocTitles.value = []
  extractedSource.value = null
  extractedTocItems.value = []
  extractedPdfManifest.value = null
  const extension = file.name.split('.').pop().toLowerCase()
  newBook.value.format = extension

  if (!newBook.value.title) {
    newBook.value.title = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')
  }

  if (['txt', 'html', 'htm'].includes(extension)) {
    isProcessing.value = true
    const reader = new FileReader()
    reader.onload = (e) => {
      extractedContent.value = e.target.result
      isProcessing.value = false
    }
    reader.onerror = () => {
      extractionError.value = 'Could not read file.'
      isProcessing.value = false
    }
    reader.readAsText(file)

  } else if (extension === 'epub') {
    isProcessing.value = true
    try {
      const { extractEpub } = await import('~/composables/useEpubExtractor.js')
      const result = await extractEpub(file)
      extractedContent.value = result.content
      extractedTocTitles.value = result.tocTitles ?? []
      newBook.value.pages = result.pages || 0
      // Auto-populate cover from the EPUB's embedded cover image if the user
      // hasn't already selected one manually.
      if (result.cover && !coverPreview.value) {
        coverPreview.value = result.cover
      }
    } catch (err) {
      extractionError.value = `Could not extract EPUB content. The book will be added without in-app reading.`
    } finally {
      isProcessing.value = false
    }

  } else if (extension === 'pdf') {
    isProcessing.value = true
    try {
      const { extractPdf } = await import('~/composables/usePdfExtractor.js')
      const result = await extractPdf(file)
      extractedContent.value = result.content
      extractedSource.value = result.source ?? null
      extractedTocItems.value = result.tocItems ?? []
      extractedPdfManifest.value = result.pdfManifest ?? null
      newBook.value.pages = result.pages || 0
    } catch (err) {
      extractionError.value = 'Could not extract PDF text. The book will be added without in-app reading.'
    } finally {
      isProcessing.value = false
    }

  }
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const fetchMetadata = async () => {
  if (!newBook.value.title) return;
  
  isFetchingMetadata.value = true;
  showMetadataProgress.value = true;
  showMetadataModal.value = true;
  metadataResults.value = [];
  resetMetadataProgress();

  try {
    metadataResults.value = await fetchBookMetadataResults(
      newBook.value.title,
      newBook.value.author,
      newBook.value.publisher,
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
  pendingBlurb.value = newBook.value.blurb
  showBlurbChooser.value = true
}

const closeBlurbChooser = () => {
  showBlurbChooser.value = false
  blurbOptions.value = []
}

const pickBlurb = (blurb) => {
  pendingBlurb.value = blurb
  newBook.value.blurb = blurb
  closeBlurbChooser()
  addToast('Description updated', 'success')
}

const selectMetadata = (result) => {
  newBook.value.title = result.title || newBook.value.title;
  newBook.value.author = result.author || newBook.value.author;
  newBook.value.blurb = result.blurb || newBook.value.blurb;
  newBook.value.publishYear = result.publishYear || newBook.value.publishYear;
  newBook.value.publisher = result.publisher || newBook.value.publisher;
  newBook.value.series = result.series || newBook.value.series;
  newBook.value.seriesInstallment = result.seriesInstallment || newBook.value.seriesInstallment;
  newBook.value.seriesTotal = result.seriesTotal ? Number(result.seriesTotal) : (newBook.value.seriesTotal || null);
  newBook.value.webReview = result.webReview || newBook.value.webReview;
  newBook.value.genre = result.genre || newBook.value.genre;
  if (newBook.value.series || newBook.value.seriesInstallment) {
    bookKind.value = 'series';
  }

  // Close the metadata modal immediately — caching the cover image is async and was
  // making the user wait for the network round-trip before the modal dismissed.
  showMetadataModal.value = false;
  addToast('Metadata applied successfully', 'success');

  // Cache the cover in the background; the form preview updates whenever it lands.
  if (result.cover && !(keepCurrentCover.value && coverPreview.value)) {
    coverPreview.value = result.cover;
    cacheCoverImage(result.cover)
      .then((cached) => {
        if (cached) coverPreview.value = cached;
      })
      .catch((error) => {
        console.warn('Cover caching failed:', error);
      });
  }

  // If multiple sources had different blurbs for this book, give the user a choice.
  const options = Array.isArray(result.blurbOptions) ? result.blurbOptions : [];
  if (options.length > 1) {
    openBlurbChooser(options);
  }
}

const handleBookKindChange = () => {
  if (bookKind.value === 'standalone') {
    newBook.value.series = ''
    newBook.value.seriesInstallment = ''
    newBook.value.seriesTotal = null
  }
}

const getPdfSourceForStorage = async () => {
  if (extractedSource.value) return extractedSource.value
  if (newBook.value.format === 'pdf' && documentFile.value) {
    return await documentFile.value.arrayBuffer()
  }
  return null
}

const saveBook = async () => {
  if (!documentFile.value || isProcessing.value) return
  
  isProcessing.value = true;
  const cachedCover = await cacheCoverImage(coverPreview.value);

  const bookToSave = {
    ...newBook.value,
    progress: reconcileStatusProgress(newBook.value.status, newBook.value.progress),
    cover: cachedCover || generateCoverPlaceholder(newBook.value.title || 'Book')
  }
  
  if (bookKind.value === 'standalone' || !bookToSave.series || bookToSave.series.trim() === '') {
    bookToSave.series = null
    bookToSave.seriesInstallment = null
    bookToSave.seriesTotal = null
  }
  
  try {
    const savedBook = await addBook(bookToSave);
    if (savedBook.series && Number(savedBook.seriesTotal) > 0) {
      await propagateSeriesTotal({
        seriesName: savedBook.series,
        seriesTotal: savedBook.seriesTotal,
        books: books.value,
        updateBook,
      });
    }
    const pdfSourceForStorage = bookToSave.format === 'pdf'
      ? await getPdfSourceForStorage()
      : extractedSource.value

    if ((extractedContent.value || pdfSourceForStorage) && savedBook?.id) {
      try {
        await saveBookContent(savedBook.id, {
          content: extractedContent.value,
          pages: savedBook.pages || 0,
          tocTitles: extractedTocTitles.value,
          source: pdfSourceForStorage,
          tocItems: extractedTocItems.value,
          format: savedBook.format || newBook.value.format,
          pdfTocChecked: (savedBook.format || newBook.value.format) === 'pdf',
          pdfTextMapVersion: (savedBook.format || newBook.value.format) === 'pdf' ? 2 : undefined,
          pdfManifest: extractedPdfManifest.value,
        });
      } catch (storageErr) {
        console.error('IndexedDB write failed:', storageErr);
        if (bookToSave.format === 'pdf' && pdfSourceForStorage) {
          try {
            await saveBookContent(savedBook.id, {
              content: null,
              pages: savedBook.pages || newBook.value.pages || 0,
              tocTitles: [],
              source: pdfSourceForStorage,
              tocItems: extractedTocItems.value,
              format: savedBook.format || newBook.value.format,
              pdfTocChecked: (savedBook.format || newBook.value.format) === 'pdf',
            });
            addToast('Book added. PDF pages were saved, but extracted text was too large to keep.', 'warning');
            router.push('/books');
            return;
          } catch (fallbackErr) {
            console.error('IndexedDB PDF fallback write failed:', fallbackErr);
          }
        }
        addToast('Book added, but content could not be saved for in-app reading.', 'warning');
        router.push('/books');
        return;
      }
    }

    addToast('Book added to library successfully', 'success');
    router.push('/books');
  } catch (error) {
    console.error('Save error:', error);
    addToast('Failed to add book to library', 'error');
  } finally {
    isProcessing.value = false;
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
  transition: background-color 0.2s, border-color 0.2s;
}

.btn-cancel:hover {
  background: var(--color-surface-hover);
}

.add-form {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 3rem;
  background: var(--color-surface-card);
  padding: 2.5rem;
  border-radius: 20px;
  border: 1px solid var(--color-border-card);
  box-shadow: var(--shadow-form-shell);
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
  background: var(--color-surface-card);
  border: 2px dashed var(--color-border-card);
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-container:hover {
  border-color: var(--color-border-focus);
  background: var(--color-surface-tertiary);
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

.document-dropzone {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-card);
  border-radius: 12px;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;
}

.document-dropzone:hover {
  border-color: var(--color-border-focus);
  background: var(--color-surface-hover);
}

.document-dropzone.has-file {
  background: var(--color-status-success-soft);
  border-color: var(--color-status-success-strong);
}

.document-dropzone.is-processing {
  background: var(--color-status-warning-soft);
  border-color: var(--color-status-warning-border);
  pointer-events: none;
}

.dropzone-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--color-surface-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-control-subtle);
  font-size: 1.5rem;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.text-success {
  color: var(--color-status-success-strong);
}

.doc-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.doc-title {
  font-size: 0.95rem;
  font-weight: 400;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.doc-subtitle {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.error-message {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--color-status-danger-bright);
  display: flex;
  align-items: center;
  gap: 0.25rem;
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
  background: var(--color-surface-card);
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

.btn-fetch:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(100%);
  box-shadow: none;
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
  border: 1px solid var(--color-border-card);
  border-radius: 10px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.form-group .radio-option:hover,
.form-group .radio-option.active {
  border-color: var(--color-border-focus);
  background: var(--color-surface-tertiary);
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
  border: 1px solid var(--color-border-card);
  border-radius: 10px;
  font-size: 0.95rem;
  color: var(--color-text-primary);
  transition: all 0.2s;
  font-family: inherit;
}

.form-input.textarea {
  resize: vertical;
  min-height: 100px;
}

.form-input::placeholder {
  color: var(--color-text-muted);
}

.form-input:focus {
  outline: none;
  background: var(--color-surface-tertiary);
  border-color: var(--color-border-focus);
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
  border-top: 1px solid var(--color-border-card);
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
  filter: grayscale(100%);
}

.spinner {
  display: inline-block;
  animation: spin 0.85s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Metadata Modal Styles */
.metadata-modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-background-overlay-soft);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  padding: 1rem;
}

.metadata-modal-container {
  background: var(--color-surface-primary);
  width: 100%;
  max-width: 600px;
  max-height: calc(100dvh - 24px);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-modal);
  overflow: hidden;
}

.metadata-modal-body {
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.metadata-modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--color-border-subtle);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metadata-modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--color-text-primary);
}

.close-button {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 6px;
}

.close-button:hover {
  background: var(--color-surface-secondary);
  color: var(--color-text-primary);
}

.metadata-loading, .metadata-empty {
  padding: 1.5rem;
  color: var(--color-text-muted);
}

.metadata-progress-actions {
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.5rem 1.25rem;
  border-top: 1px solid var(--color-border-subtle);
  background: var(--color-surface-primary);
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

.metadata-results {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.metadata-card {
  display: flex;
  gap: 1.5rem;
  padding: 1rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--color-surface-primary);
}

.metadata-card:hover {
  border-color: var(--color-brand-primary);
  background: var(--color-surface-active);
  transform: translateY(-2px);
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
  width: 70px;
  height: 105px;
  flex-shrink: 0;
  object-fit: cover;
  border-radius: 6px;
  box-shadow: var(--shadow-control-subtle);
}

.metadata-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.25rem;
}

.metadata-info h4 {
  overflow-wrap: anywhere;
}

.metadata-source-tags {
  flex-wrap: wrap;
}

.metadata-info h4 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--color-text-primary);
  line-height: 1.3;
}

.metadata-author {
  margin: 0;
  font-size: 0.95rem;
  color: var(--color-text-muted);
}

.metadata-source-tags {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin: 0.2rem 0 0.1rem;
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

.metadata-year, .metadata-series, .metadata-review {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.metadata-review {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.add-form {
  grid-template-columns: 1fr;
  padding: 1.5rem;
}

/* Grid/flex children default to min-width:auto, so wide non-wrapping cards
   would push the form past the viewport. Allow the tracks to shrink. */
.media-column,
.details-column {
  min-width: 0;
}

.media-column {
  flex-direction: row;
}

.cover-container {
  width: 150px;
  flex-shrink: 0;
}

.document-section {
  flex: 1;
  min-width: 0;
}

/* minmax(0, 1fr) stops the track from growing to the 10-star row's
   min-content width (which otherwise overflows the viewport). */
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

.add-book-page {
  padding: 1rem;
}

.media-column {
  flex-direction: column;
}

.cover-container {
  width: 200px;
  margin: 0 auto;
}

.page-header {
  flex-direction: column;
  gap: 1rem;
}
.keep-cover-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin-bottom: 4px;
  border-radius: 8px;
  background: var(--color-surface-secondary);
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  cursor: pointer;
}

.keep-cover-option input {
  accent-color: var(--color-brand-primary);
}
</style>
