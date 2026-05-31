<template>
  <div class="author-split-wrapper" v-if="author">
    <!-- Sophisticated Background -->
    <div class="page-background"></div>

    <div class="split-container">
      <!-- Left Column: Author Info & Sidebar -->
      <aside class="author-sidebar">
        <button class="minimal-back-btn" @click="router.back()">
          <i class="ri-arrow-left-s-line"></i> Back
        </button>

        <div class="author-profile-card">
          <div class="image-frame" @click="handleImageClick">
            <img v-if="author.image" :src="author.image" :alt="author.name" class="sidebar-avatar" />
            <div v-else class="sidebar-initial">{{ author.name.charAt(0) }}</div>
            <div class="image-edit-overlay">
              <i class="ri-camera-line"></i>
              <span>Change Image</span>
            </div>
            <div v-if="isScraping" class="image-loading-overlay">
              <span class="mini-skeleton circle"></span>
            </div>
          </div>
          
          <h1 class="sidebar-name">{{ author.name }}</h1>

          <div class="sidebar-stats">
            <div class="stat-item">
              <span class="stat-value">{{ author.books?.length || 0 }}</span>
              <span class="stat-label">Works</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-value">{{ totalPages }}</span>
              <span class="stat-label">Pages</span>
            </div>
          </div>
          <div class="about-section">
            <h3 class="section-subtitle">About the Author</h3>
            <div class="bio-content">
              <p v-if="author.bio" class="bio-text">{{ author.bio }}</p>
              <div v-else class="bio-loading">
                <span class="bio-skeleton wide"></span>
                <span class="bio-skeleton medium"></span>
                <span class="bio-skeleton short"></span>
              </div>
              <a v-if="author.bio" :href="`https://en.wikipedia.org/wiki/${author.name.replace(/\s+/g, '_')}`" target="_blank" class="wiki-link">
                Source: Wikipedia <i class="ri-external-link-line"></i>
              </a>
            </div>
          </div>
        </div>
      </aside>

      <!-- Right Column: Books & Gallery -->
      <main class="books-main-content">
        <header class="gallery-heading">
          <h2>Books</h2>
          <div class="accent-line"></div>
        </header>

        <div class="books-grid-modern">
          <div 
            v-for="book in author.books" 
            :key="book.id" 
            class="book-card-horizontal"
            @click="router.push(`/reader/${book.id}`)"
          >
            <div class="book-card-bg-container">
              <div class="book-bg" :style="{ backgroundImage: `url(${resolveBookCover(book)})` }"></div>
              <div class="book-bg-overlay"></div>
            </div>
            <div class="book-cover">
              <img :src="resolveBookCover(book)" :alt="book.title" />
              <div class="cover-overlay">
                <button class="play-btn" @click.stop="handlePlay(book)">
                  <i class="ri-play-fill"></i>
                </button>
              </div>
            </div>
            <div class="book-info-minimal">
              <h3 class="book-title">{{ book.title }}</h3>
              <p v-if="book.series" class="book-series-text">{{ book.series }}</p>
              <div v-if="book.genre" class="book-genre-tag-minimal">
                <i class="ri-price-tag-3-line"></i>
                <span>{{ book.genre }}</span>
              </div>
              
              <div class="book-meta-footer-horizontal">
                <div class="meta-item-simple">
                  <i class="ri-star-fill star-icon"></i>
                  <span>{{ book.rating || '—' }}</span>
                </div>
                <div class="meta-item-simple">
                  <i class="ri-book-read-line"></i>
                  <span>{{ book.progress }}%</span>
                </div>
                <div class="meta-item-simple">
                  <i class="ri-pages-line"></i>
                  <span>{{ book.pages || 0 }}p</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="!author.books?.length" class="no-books-state">
          <i class="ri-book-open-line"></i>
          <p>No books available for this author yet.</p>
        </div>
      </main>
    </div>

    <!-- Edit Choice Modal -->
    <div v-if="showEditChoice" class="modal-overlay" @click="showEditChoice = false">
      <div class="choice-modal" @click.stop>
        <h3>Change Author Image</h3>
        <p>Choose how you'd like to update the photo</p>
        <div class="choice-grid">
          <button class="choice-btn" @click="triggerFileUpload">
            <i class="ri-upload-2-line"></i>
            <div class="choice-text">
              <strong>Upload</strong>
              <span>From your computer</span>
            </div>
          </button>
          <button class="choice-btn" @click="scrapeAuthorImage">
            <i class="ri-global-line"></i>
            <div class="choice-text">
              <strong>Scrape Web</strong>
              <span>Find web portraits</span>
            </div>
          </button>
        </div>
        <button class="modal-close-btn" @click="showEditChoice = false">Cancel</button>
      </div>
    </div>

    <!-- Image Picker Modal -->
    <div v-if="showImagePicker" class="modal-overlay" @click="showImagePicker = false">
      <div class="picker-modal" @click.stop>
        <div class="picker-header">
          <h3>Select Author Image</h3>
          <p v-if="!isScraping">Found {{ imageOptions.length }} results for {{ author.name }}</p>
          <p v-else>Searching for author images...</p>
        </div>

        <!-- Loader inside modal -->
        <div v-if="isScraping" class="picker-loader">
          <SkeletonLoader variant="authors-grid" :count="6" />
        </div>

        <div v-else class="picker-grid">
          <div 
            v-for="(img, idx) in imageOptions" 
            :key="idx" 
            class="picker-item"
            @click="selectImage(img)"
          >
            <img :src="img" alt="Author option" loading="lazy" @error="removeImageOption(img)" />
            <div class="picker-item-overlay">
              <i class="ri-check-line"></i>
            </div>
          </div>
        </div>
        <div class="picker-footer">
          <button class="modal-close-btn" @click="showImagePicker = false">Cancel</button>
        </div>
      </div>
    </div>
  </div>

  <div v-else-if="loading" class="loading-overlay">
    <SkeletonLoader variant="author-detail" />
  </div>

  <div v-else-if="error" class="error-overlay">
    <div class="error-card">
      <i class="ri-error-warning-line"></i>
      <h3>Unable to Load Profile</h3>
      <p>{{ error }}</p>
      <button @click="fetchAuthor" class="retry-btn">Try Again</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTTS } from '~/composables/useTTS';
import { useToast } from '~/composables/useToast';
import { useBooks } from '~/composables/useBooks';
import { useLibraryStore } from '~/composables/useLibraryStore';
import { fetchAuthorImageResults } from '~/composables/useAuthorImageSearch';

const route = useRoute();
const router = useRouter();
const { play: playTTS } = useTTS();
const { addToast } = useToast();
const { fetchAllData, authors: globalAuthors, books: globalBooks, initialized } = useBooks();

const author = ref(null);
const loading = ref(true);
const error = ref(null);
const isScraping = ref(false);
const showEditChoice = ref(false);
const showImagePicker = ref(false);
const imageOptions = ref([]);

const fetchAuthor = () => {
  const authorName = decodeURIComponent(route.params.id);
  const authorBooks = globalBooks.value.filter(b => b.author === authorName);
  const authorInfo = globalAuthors.value.find(a => a.name === authorName);

  if (authorBooks.length > 0) {
    author.value = {
      name: authorName,
      image: authorInfo?.image ?? authorBooks.find(b => b.authorImage)?.authorImage ?? null,
      bio: authorInfo?.bio ?? authorBooks.find(b => b.authorBio)?.authorBio ?? null,
      books: authorBooks,
    };
    error.value = null;
  } else if (initialized.value) {
    error.value = 'Author not found in your library.';
    author.value = null;
  }
  loading.value = false;
};

watchEffect(() => {
  if (!initialized.value) {
    loading.value = true;
    return;
  }
  fetchAuthor();
});

const handleImageClick = () => {
  showEditChoice.value = true;
};

const triggerFileUpload = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      await updateAuthorImage(reader.result);
      addToast('Image uploaded successfully', 'success');
    };
    reader.readAsDataURL(file);
  };
  input.click();
  showEditChoice.value = false;
};

const scrapeAuthorImage = async () => {
  if (!author.value) return;
  try {
    isScraping.value = true;
    showEditChoice.value = false;
    showImagePicker.value = true;
    imageOptions.value = [];
    const images = await fetchAuthorImageResults(author.value.name);
    if (images.length > 0) {
      imageOptions.value = images;
    } else {
      showImagePicker.value = false;
      addToast('Could not find any suitable images on the web.', 'error');
    }
  } catch (err) {
    console.error('Scrape failed:', err);
    showImagePicker.value = false;
    addToast('Failed to search for images.', 'error');
  } finally {
    isScraping.value = false;
  }
};

const selectImage = async (imgUrl) => {
  showImagePicker.value = false;
  await updateAuthorImage(imgUrl);
  addToast('Author image updated', 'success');
};

const removeImageOption = (imgUrl) => {
  imageOptions.value = imageOptions.value.filter(img => img !== imgUrl);
};

const updateAuthorImage = async (newImageUrl) => {
  try {
    isScraping.value = true;
    const authorName = author.value.name;
    await useLibraryStore().updateAuthorImage(authorName, newImageUrl);
    if (author.value) author.value = { ...author.value, image: newImageUrl };
    await fetchAllData(true);
  } catch (err) {
    console.error('Update failed:', err);
    addToast('Failed to update image.', 'error');
  } finally {
    isScraping.value = false;
  }
};

const totalPages = computed(() => {
  if (!author.value?.books) return 0;
  return author.value.books.reduce((acc, b) => acc + (b.pages || 0), 0);
});

const handlePlay = (book) => {
  playTTS(book);
};

const resolveBookCover = (book) => {
  if (book.cover && !book.cover.startsWith('blob:')) return book.cover;
  return '/placeholder-book.png';
};
</script>

<style scoped>
.author-split-wrapper {
  position: relative;
  min-height: 100vh;
  background-color: var(--app);
  padding: 0;
  margin: -2.5rem;
  width: calc(100% + 5rem);
  overflow-x: hidden;
  z-index: 1;
}

.page-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--color-brand-primary-faint) 0%, transparent 100%);
  z-index: -1;
}

.split-container {
  display: grid;
  grid-template-columns: 350px 1fr;
  min-height: 100vh;
}

/* Left Column / Sidebar */
.author-sidebar {
  background: var(--color-surface-card);
  padding: 3rem 2rem;
  border-right: 1px solid var(--color-border-card);
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}

.minimal-back-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 0.9rem;
  cursor: pointer;
  margin-bottom: 2rem;
  transition: color 0.2s;
}

.minimal-back-btn:hover {
  color: var(--primary-color);
}

.author-profile-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.image-frame {
  width: 180px;
  height: 180px;
  border-radius: 50%;
  padding: 6px;
  background: var(--primary-color);
  margin-bottom: 1.5rem;
  box-shadow: var(--shadow-brand-glow);
  position: relative;
  cursor: pointer;
  overflow: hidden;
}

.sidebar-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  border: 4px solid var(--color-brand-primary-soft);
}

.sidebar-initial {
  width: 100%;
  height: 100%;
  background: var(--color-surface-secondary);
  color: var(--primary-color);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 4rem;
  border: 4px solid white;
}

.image-edit-overlay {
  position: absolute;
  inset: 6px;
  background: var(--color-background-overlay-soft);
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-text-on-brand);
  opacity: 0;
  transition: opacity 0.3s;
  font-size: 0.8rem;
  gap: 0.25rem;
}

.image-frame:hover .image-edit-overlay {
  opacity: 1;
}

.image-loading-overlay {
  position: absolute;
  inset: 6px;
  background: var(--color-text-on-image-secondary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
}

.sidebar-name {
  font-size: 1.75rem;
  font-weight: 500;
  margin: 0 0 0.5rem 0;
  color: var(--text-color);
}

.sidebar-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  margin-bottom: 0.5rem;
  width: 100%;
}

.stat-item {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 400;
  color: var(--text-color);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
}

.stat-divider {
  width: 1px;
  height: 25px;
  background: var(--border-color);
}

.about-section {
  text-align: left;
  width: 100%;
  margin-bottom: 1.5rem;
}

.section-subtitle {
  font-size: 0.9rem;
  font-weight: 400;
  color: var(--text-color);
  margin-bottom: 10px;
}

.bio-content {
  background: var(--color-surface-card);
  padding: 10px 0;
  border-radius: 16px;
}

.bio-text {
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--color-text-muted);
  margin: 0 0 1rem 0;
}

.bio-loading {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1rem;
}

.wiki-link {
  font-size: 0.75rem;
  color: var(--primary-color);
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-weight: 400;
}

.wiki-link:hover {
  text-decoration: underline;
}

/* Right Column: Main Content */
.books-main-content {
  padding: 1rem 3rem;
}

.gallery-heading {
  margin-bottom: 30px;
}

.gallery-heading h2 {
  font-size: 1.5rem;
  font-weight: 400;
  color: var(--text-color);
  margin-bottom: 0.75rem;
}

.accent-line {
  width: 60px;
  height: 4px;
  background: var(--primary-color);
  border-radius: 2px;
}

.books-grid-modern {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 2rem;
}

/* Horizontal Card Style (Matching BooksComp exactly) */
.book-card-horizontal {
  display: flex;
  flex-direction: row;
  gap: 1.25rem;
  background: transparent;
  border-radius: 16px;
  padding: 1.25rem;
  border: 1px solid var(--color-border-on-image);
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  color: var(--color-text-on-brand);
  z-index: 1;
}

.book-card-horizontal:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-card-hover);
  border-color: var(--color-border-on-image-strong);
}

.book-card-bg-container {
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: 16px;
  overflow: hidden;
}

.book-bg {
  position: absolute;
  inset: -20px;
  background-size: cover;
  background-position: center;
  filter: blur(25px) saturate(150%);
  transform: scale(1.2);
}

.book-bg-overlay {
  position: absolute;
  inset: 0;
  background: var(--gradient-image-card-overlay);
}

.book-cover {
  width: 110px;
  aspect-ratio: 2/3;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: var(--shadow-cover);
  flex-shrink: 0;
  position: relative;
  transition: all 0.3s ease;
}

.book-card-horizontal:hover .book-cover {
  box-shadow: var(--shadow-cover-hover);
}

.book-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.book-card-horizontal:hover .book-cover img {
  transform: scale(1.05);
}

.cover-overlay {
  position: absolute;
  inset: 0;
  background: var(--gradient-cover-action-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 10;
}

.book-card-horizontal:hover .cover-overlay {
  opacity: 1;
}

.play-btn {
  background: var(--color-surface-on-image-hover);
  backdrop-filter: blur(4px);
  border: 1px solid var(--color-border-on-image-strong);
  border-radius: 50%;
  width: 44px;
  height: 44px;
  color: var(--color-text-on-brand);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.play-btn:hover {
  transform: scale(1.1);
  background: var(--color-brand-primary);
  border-color: var(--color-brand-primary);
}

.book-info-minimal {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  padding: 0.25rem 0;
  text-align: left;
}

.book-title {
  font-size: 1.15rem;
  font-weight: 500;
  color: var(--color-surface-primary);
  margin: 0 0 0.25rem 0;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-shadow: var(--shadow-text-on-image);
}

.book-series-text {
  font-size: 0.8rem;
  color: var(--color-brand-lavender);
  margin: 0 0 0.25rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}

.book-genre-tag-minimal {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  color: var(--color-text-on-image-muted);
  background: var(--color-border-on-image);
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  margin-bottom: 0.75rem;
  width: fit-content;
}

.book-meta-footer-horizontal {
  display: flex;
  gap: 1rem;
  margin-top: auto;
  font-size: 0.85rem;
  color: var(--color-surface-glass);
}

.meta-item-simple {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.meta-item-simple i {
  color: var(--color-text-on-image-subtle);
}

.star-icon {
  color: var(--color-status-star) !important;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-background-overlay-faint);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.choice-modal {
  background: var(--color-surface-primary);
  padding: 2.5rem;
  border-radius: 24px;
  width: 90%;
  max-width: 450px;
  text-align: center;
  box-shadow: var(--shadow-modal);
}

.choice-modal h3 {
  margin-bottom: 0.5rem;
  font-weight: 400;
}

.choice-modal p {
  color: var(--text-muted);
  margin-bottom: 2rem;
  font-size: 0.95rem;
}

.choice-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 2rem;
}

.choice-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem 1rem;
  background: var(--color-surface-secondary);
  border: 1px solid var(--color-border-subtle);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.choice-btn:hover {
  border-color: var(--primary-color);
  background: var(--color-surface-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--color-brand-primary-faint);
}

.choice-btn i {
  font-size: 1.75rem;
  color: var(--primary-color);
}

.choice-text strong {
  display: block;
  font-size: 0.95rem;
  margin-bottom: 0.15rem;
}

.choice-text span {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.modal-close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.9rem;
  cursor: pointer;
}

.no-books-state {
  text-align: center;
  padding: 6rem 0;
  color: var(--text-muted);
}

.no-books-state i {
  font-size: 3rem;
  margin-bottom: 1rem;
}

/* Loading State */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-surface-glass);
  backdrop-filter: blur(4px);
  padding: 2.5rem;
  z-index: 2000;
}

.mini-skeleton,
.bio-skeleton {
  display: block;
  background: linear-gradient(
    90deg,
    var(--skeleton-color, var(--color-skeleton-base)) 25%,
    var(--skeleton-shimmer, var(--color-skeleton-shimmer)) 37%,
    var(--skeleton-color, var(--color-skeleton-base)) 63%
  );
  background-size: 400% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
  border-radius: 6px;
}

.mini-skeleton.circle {
  width: 24px;
  height: 24px;
  border-radius: 50%;
}

.bio-skeleton {
  height: 0.8rem;
  border-radius: 999px;
}

.bio-skeleton.wide {
  width: 100%;
}

.bio-skeleton.medium {
  width: 78%;
}

.bio-skeleton.short {
  width: 52%;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@media (max-width: 1024px) {
  .split-container {
    grid-template-columns: 1fr;
  }
  .author-sidebar {
    position: relative;
    height: auto;
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
  }
  .books-main-content {
    padding: 3rem 1.5rem;
  }
}
/* Picker Modal Styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-background-overlay-faint);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999; /* Higher than playbar */
}

.picker-modal {
  background: var(--color-surface-primary);
  padding: 2.5rem;
  border-radius: 24px;
  width: 90%;
  max-width: 900px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-modal);
  animation: modalSlideUp 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
  color: var(--color-text-primary);
}

@keyframes modalSlideUp {
  from { opacity: 0; transform: translateY(40px); }
  to { opacity: 1; transform: translateY(0); }
}

.picker-header {
  margin-bottom: 2rem;
  text-align: center;
}

.picker-header h3 {
  font-size: 1.75rem;
  font-weight: 400;
  color: var(--color-text-primary);
  margin-bottom: 0.5rem;
}

.picker-header p {
  color: var(--color-text-muted);
}

.picker-loader {
  padding: 1rem 0;
  flex: 1;
}

.picker-loader span {
  color: var(--color-text-muted);
  font-size: 1rem;
}

.picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.5rem;
  overflow-y: auto;
  padding: 1rem;
  margin-bottom: 1rem;
  flex: 1;
}

/* Custom scrollbar for picker grid */
.picker-grid::-webkit-scrollbar {
  width: 8px;
}

.picker-grid::-webkit-scrollbar-track {
  background: var(--color-surface-tertiary);
  border-radius: 10px;
}

.picker-grid::-webkit-scrollbar-thumb {
  background: var(--color-border-strong);
  border-radius: 10px;
}

.picker-grid::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-subtle);
}

.picker-item {
  position: relative;
  width: 100%;
  padding-bottom: 125%; /* 4:5 aspect ratio */
  height: 0;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  box-shadow: var(--shadow-control-subtle);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: var(--color-surface-secondary);
}

.picker-item:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-brand-button-hover);
}

.picker-item img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.picker-item-overlay {
  position: absolute;
  inset: 0;
  background: var(--color-brand-primary-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-on-brand);
  font-size: 2.5rem;
  opacity: 0;
  transition: opacity 0.3s;
}

.picker-item:hover .picker-item-overlay {
  opacity: 1;
}

.picker-footer {
  display: flex;
  justify-content: center;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-surface-tertiary);
}

.modal-close-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  padding: 0.5rem 2rem;
  transition: all 0.2s;
}

.modal-close-btn:hover {
  color: var(--primary-color);
  transform: scale(1.05);
}
</style>
