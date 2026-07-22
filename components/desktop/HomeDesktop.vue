<template>
  <div class="home-container">
    <div v-if="loading && !initialized" class="home-loading">
      <HomeSkeleton />
    </div>

    <EmptyState
      v-else-if="error && books.length === 0"
      title="Library could not load"
      :description="error"
      icon="ri-error-warning-line"
    >
      <template #action>
        <button class="add-btn retry-btn" @click="retryLoadLibrary">
          <i class="ri-refresh-line"></i>
          Retry
        </button>
      </template>
    </EmptyState>

    <!-- A brand-new library gets one welcoming hero instead of an empty
         state per section. -->
    <EmptyState
      v-else-if="initialized && books.length === 0"
      illustration="library"
      title="Your library awaits"
      description="Add your first book and Pages will keep your reading, listening and progress right here."
    >
      <template #action>
        <NuxtLink to="/add" class="add-btn">
          <i class="ri-add-line"></i>
          Add your first book
        </NuxtLink>
      </template>
    </EmptyState>

    <template v-else-if="initialized">
      <div class="desktop-home">
        <section v-if="recentlyAddedBooks.length > 0" class="home-section">
          <div class="section-header">
            <h2 class="section-title">Recently Added</h2>
            <NuxtLink to="/books" class="show-all-btn">
              See all <i class="ri-arrow-right-s-line"></i>
            </NuxtLink>
          </div>
          <div class="recent-grid">
            <div
              v-for="book in recentlyAddedBooks.slice(0, 3)"
              :key="book.id"
              class="recent-card"
              @click="router.push(`/book/${book.id}`)"
            >
              <div class="recent-card-bg-container">
                <div
                  class="recent-bg"
                  :style="{ backgroundImage: `url(${book.cover})` }"
                ></div>
                <div class="recent-bg-overlay"></div>
              </div>
              <img :src="book.cover" :alt="book.title" class="recent-cover" />
              <div class="recent-info">
                <h4 class="recent-title">{{ book.title }}</h4>
                <p class="recent-meta">
                  {{ book.pages || "-" }} Pages - {{ book.format || "EPUB" }}
                </p>
              </div>
              <button
                class="recent-go-btn"
                title="Listen"
                @click.stop="handlePlay(book)"
              >
                <i class="ri-play-line"></i>
              </button>
            </div>
          </div>
        </section>

        <div class="main-content-row">
          <!-- Sections with nothing to show stay hidden; the page simply
               displays whatever content exists. -->
          <section v-if="popularBooks.length > 0" class="popular-column">
            <div class="section-header">
              <h2 class="section-title">Popular Books</h2>
            </div>
            <div class="popular-grid">
              <div
                v-for="book in popularBooks"
                :key="book.id"
                class="popular-card"
                @click="router.push(`/book/${book.id}`)"
              >
                <img :src="book.cover" :alt="book.title" class="popular-cover" />
                <div class="popular-info">
                  <h4 class="popular-title">{{ book.title }}</h4>
                  <p class="popular-author">{{ book.author }}</p>
                  <div class="popular-rating" v-if="getGoodreadsRating(book)">
                    <GoodreadsRatingDisplay :web-review="book.webReview" compact />
                  </div>
                  <p class="popular-blurb">{{ truncate(book.blurb, 90) }}</p>
                </div>
                <button
                  class="popular-play-btn"
                  title="Listen"
                  @click.stop="handlePlay(book)"
                >
                  <i class="ri-play-fill"></i>
                </button>
              </div>
            </div>
          </section>

          <section v-if="recentAuthors.length > 0" class="your-authors-column">
            <div class="section-header">
              <h2 class="section-title">Your Authors</h2>
            </div>
            <div class="authors-list-card">
              <div
                v-for="author in recentAuthors"
                :key="author.id"
                class="author-list-item"
                @click="router.push(`/author/${author.id}`)"
              >
                <div class="author-list-avatar">
                  <img
                    v-if="author.image"
                    :src="author.image"
                    :alt="author.name"
                  />
                  <div v-else class="author-initial">
                    {{ author.name.charAt(0) }}
                  </div>
                </div>
                <div class="author-list-info">
                  <p class="author-list-name">{{ author.name }}</p>
                  <p class="author-list-count">
                    {{ getAuthorBookCount(author.name) }} Books
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { useRouter } from "vue-router";
import { useBooks } from "~/composables/useBooks";
import { getGoodreadsRating } from "~/composables/useGoodreadsRating";
import { useTTS } from "~/composables/useTTS";
import EmptyState from "../shared/EmptyState.vue";
import GoodreadsRatingDisplay from "../shared/GoodreadsRatingDisplay.vue";
import HomeSkeleton from "../shared/HomeSkeleton.vue";

const {
  books,
  recentlyAddedBooks,
  recentAuthors,
  popularBooks,
  loading,
  initialized,
  error,
  fetchAllData,
} = useBooks();
const { play: playTTS, togglePlay: toggleTTS, ttsBook, ttsStatus } = useTTS();
const router = useRouter();

const handlePlay = (book) => {
  if (ttsBook.value?.id === book.id && ttsStatus.value !== "idle") {
    toggleTTS();
    return;
  }
  playTTS(book);
};

const getAuthorBookCount = (authorName) => {
  return books.value.filter((b) => b.author === authorName).length;
};

const retryLoadLibrary = () => {
  fetchAllData(true);
};

const truncate = (text, length) => {
  if (!text) return "";
  if (text.length <= length) return text;
  return text.substring(0, length).trim() + "...";
};
</script>

<style scoped>
.home-container {
  padding: 0rem;
  margin: 0 auto;
}

.desktop-home {
  display: block;
}

.home-section {
  margin-bottom: 2.5rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 400;
  color: var(--color-brand-primary);
  margin: 0;
}

.show-all-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  text-decoration: none;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.show-all-btn:hover {
  color: var(--color-text-primary);
}

.recent-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 2rem;
  padding: 2.5rem 0.5rem 0.5rem;
}

.recent-grid::-webkit-scrollbar {
  display: none;
}

.recent-card {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
  height: 130px;
  border-radius: 16px;
  cursor: pointer;
  scroll-snap-align: start;
  transition: transform 0.3s ease;
  color: var(--color-text-on-brand);
  text-decoration: none;
  background: transparent;
  z-index: 1;
  overflow: visible;
}

.recent-card-bg-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 16px;
  overflow: hidden;
  z-index: -1;
}

.recent-bg {
  position: absolute;
  top: -20px;
  left: -20px;
  right: -20px;
  bottom: -20px;
  background-size: cover;
  background-position: center;
  filter: blur(25px) saturate(150%);
  transform: scale(1.2);
}

.recent-bg-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    135deg,
    var(--color-background-overlay-strong) 0%,
    var(--color-background-overlay-faint) 100%
  );
}

.recent-card:hover {
  transform: translateY(-5px);
}

.recent-cover {
  position: absolute;
  left: 15px;
  bottom: 10px;
  width: 95px;
  height: 145px;
  border-radius: 10px;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.recent-card:hover .recent-cover {
  transform: scale(1.05);
}

.recent-info {
  margin-left: 130px;
  padding-right: 50px;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.recent-title {
  font-size: 1.1rem;
  font-weight: 400;
  line-height: 1.3;
  margin: 0 0 0.5rem 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--color-text-on-brand);
  text-shadow: var(--shadow-text-on-image);
}

.recent-meta {
  font-size: 0.8rem;
  color: var(--color-text-on-image-secondary);
  margin: 0;
  font-weight: 400;
}

.recent-go-btn {
  position: absolute;
  right: 15px;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid var(--color-border-on-image-strong);
  background: var(--color-surface-on-image-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-on-brand);
  cursor: pointer;
  transition: all 0.3s ease;
}

.recent-card:hover .recent-go-btn {
  background: var(--color-surface-on-image-hover);
  border-color: var(--color-text-on-image-secondary);
  transform: translateY(-50%) scale(1.05);
}

.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: var(--gradient-brand-primary);
  color: var(--color-text-on-brand);
  border-radius: 0.5rem;
  font-weight: 400;
  text-decoration: none;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.add-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px var(--shadow-brand-glow);
}

.retry-btn {
  border: none;
  cursor: pointer;
  font-family: inherit;
}

.main-content-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4rem;
  margin-bottom: 6rem;
  padding: 0 0.5rem;
}

.popular-column {
  grid-column: span 2;
}

.your-authors-column {
  grid-column: span 1;
}

.popular-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2rem;
  margin-top: 1.5rem;
}

.popular-card {
  display: flex;
  gap: 1.5rem;
  background: transparent;
  cursor: pointer;
  position: relative;
  transition: transform 0.3s ease;
}

.popular-card:hover {
  transform: translateY(-2px);
}

.popular-cover {
  width: 110px;
  height: 165px;
  border-radius: 8px;
  object-fit: cover;
  box-shadow: var(--shadow-cover);
  flex-shrink: 0;
}

.popular-info {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  flex: 1;
  padding-top: 0.25rem;
  position: relative;
}

.popular-title {
  font-size: 1.25rem;
  font-weight: 400;
  color: var(--color-text-primary);
  margin: 0 0 0.25rem 0;
  line-height: 1.3;
  padding-right: 2.5rem;
}

.popular-author {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin: 0 0 0.5rem 0;
}

.popular-rating {
  margin: 0 0 0.75rem 0;
}

.popular-rating :deep(.goodreads-rating) {
  flex-wrap: wrap;
  row-gap: 0.2rem;
}

.popular-blurb {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  line-height: 1.6;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.popular-play-btn {
  position: absolute;
  top: 0;
  right: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-brand-primary);
  color: var(--color-text-on-brand);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--shadow-brand-button);
  transition: all 0.2s;
}

.popular-play-btn:hover {
  transform: scale(1.1);
  background: var(--color-brand-primary-hover);
}

.authors-list-card {
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-top: 1.5rem;
}

.author-list-item {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  cursor: pointer;
  transition: transform 0.2s;
}

.author-list-item:hover {
  transform: translateX(5px);
}

.author-list-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: var(--shadow-control-subtle);
  flex-shrink: 0;
}

.author-list-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.author-initial {
  width: 100%;
  height: 100%;
  background: var(--color-brand-primary-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 400;
  color: var(--color-brand-primary);
}

.author-list-info {
  display: flex;
  flex-direction: column;
}

.author-list-name {
  font-size: 1.05rem;
  font-weight: 400;
  color: var(--color-text-primary);
  margin: 0 0 0.25rem 0;
}

.author-list-count {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin: 0;
}

.home-loading {
  padding: 0.5rem;
}

@media (max-width: 1024px) {
  .main-content-row {
    grid-template-columns: 1fr;
  }

  .recent-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

</style>
