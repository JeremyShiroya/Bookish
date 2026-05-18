<template>
  <div class="home-container">
    <div v-if="loading && !initialized" class="home-loading">
      <div class="loader-spinner"></div>
      <p>Preparing your library...</p>
    </div>

    <template v-else-if="initialized">
      <section class="home-section">
        <div class="section-header">
          <h2 class="section-title">Recently Added</h2>
          <NuxtLink to="/books" class="show-all-btn">
            See all <i class="ri-arrow-right-s-line"></i>
          </NuxtLink>
        </div>
        <div v-if="recentlyAddedBooks.length > 0" class="recent-grid">
          <div
            v-for="book in recentlyAddedBooks.slice(0, 3)"
            :key="book.id"
            class="recent-card"
            @click="router.push(`/reader/${book.id}`)"
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
                {{ book.pages || "—" }} Pages • {{ book.format || "EPUB" }}
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
        <EmptyState
          v-else
          title="Your library is clear"
          description="Start building your digital library by uploading your first book."
          icon="ri-folder-add-line"
        >
          <template #action>
            <NuxtLink to="/books" class="add-btn">
              <i class="ri-add-line"></i>
              Add Book
            </NuxtLink>
          </template>
        </EmptyState>
      </section>

      <!-- Main Content Row: Popular Books and Your Authors -->
      <div class="main-content-row">
        <!-- Popular Books Column -->
        <section class="popular-column">
          <div class="section-header">
            <h2 class="section-title">Popular Books</h2>
          </div>
          <div v-if="popularBooks.length > 0" class="popular-grid">
            <div
              v-for="book in popularBooks"
              :key="book.id"
              class="popular-card"
              @click="router.push(`/reader/${book.id}`)"
            >
              <img :src="book.cover" :alt="book.title" class="popular-cover" />
              <div class="popular-info">
                <h4 class="popular-title">{{ book.title }}</h4>
                <p class="popular-author">{{ book.author }}</p>
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
          <EmptyState
            v-else
            title="No popular books"
            description="Add and rate books to see your favorites here."
            icon="ri-star-line"
          />
        </section>

        <!-- Your Authors Column -->
        <section class="your-authors-column">
          <div class="section-header">
            <h2 class="section-title">Your Authors</h2>
          </div>
          <div v-if="recentAuthors.length > 0" class="authors-list-card">
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
          <EmptyState
            v-else
            title="No authors yet"
            description="Your most read authors will appear here."
            icon="ri-group-line"
          />
        </section>
      </div>
    </template>
  </div>
</template>

<script setup>
import { useRouter } from "vue-router";
import { useBooks } from "~/composables/useBooks";
import { useTTS } from "~/composables/useTTS";
import EmptyState from "./EmptyState.vue";

const {
  books,
  recentlyReadBooks,
  recentlyAddedBooks,
  recentAuthors,
  popularBooks,
  loading,
  initialized,
} = useBooks();
const { play: playTTS } = useTTS();
const router = useRouter();

const handlePlay = (book) => {
  playTTS(book);
};

const getAuthorBookCount = (authorName) => {
  return books.value.filter((b) => b.author === authorName).length;
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
  color: #000;
  margin: 0;
}

.show-all-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  /* border: 1px solid #cccccc; */
  padding: 0.5rem 1rem;
  border-radius: 10px;
  text-decoration: none;
  color: #6b7280;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.show-all-btn:hover {
  border: 1px solid #cccccc;
  background: #e5e7eb;
  transform: translateY(-2px);
}

.recent-grid {
  display: flex;
  gap: 2rem;
  overflow-x: auto;
  padding: 2.5rem 0.5rem 0.5rem;
  scroll-snap-type: x mandatory;
}

.recent-grid::-webkit-scrollbar {
  display: none;
}

.recent-card {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 280px;
  height: 130px;
  border-radius: 16px;
  cursor: pointer;
  scroll-snap-align: start;
  transition: transform 0.3s ease;
  color: white;
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
    rgba(20, 20, 25, 0.7) 0%,
    rgba(20, 20, 25, 0.4) 100%
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
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.recent-meta {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.85);
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
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
}

.recent-card:hover .recent-go-btn {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.8);
  transform: translateY(-50%) scale(1.05);
}

.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: linear-gradient(135deg, #8a2be2 0%, #6a0dad 100%);
  color: white;
  border-radius: 0.5rem;
  font-weight: 400;
  text-decoration: none;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.add-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(138, 43, 226, 0.4);
}

/* Main Content Layout */
.main-content-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  margin-bottom: 6rem;
  padding: 0 0.5rem; /* align with recent-grid padding */
}

.popular-column {
  grid-column: span 2;
}

.your-authors-column {
  grid-column: span 1;
}

/* Popular Books */
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
  box-shadow: 0 8px 15px rgba(0, 0, 0, 0.15);
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
  color: var(--text-color);
  margin: 0 0 0.25rem 0;
  line-height: 1.3;
  padding-right: 2.5rem; /* leave space for play button */
}

.popular-author {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin: 0 0 1rem 0;
}

.popular-blurb {
  font-size: 0.85rem;
  color: var(--text-muted);
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
  background: var(--primary-color);
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 6px var(--primary-shadow);
  transition: all 0.2s;
}

.popular-play-btn:hover {
  transform: scale(1.1);
  background: var(--primary-dark);
}

/* Your Authors */
.authors-list-card {
  background: var(--surface-color);
  border-radius: 20px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-top: 1.5rem;
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.05);
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
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
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
  background: var(--primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 400;
  color: var(--primary-color);
}

.author-list-info {
  display: flex;
  flex-direction: column;
}

.author-list-name {
  font-size: 1.05rem;
  font-weight: 400;
  color: var(--text-color);
  margin: 0 0 0.25rem 0;
}

.author-list-count {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin: 0;
}

@media (max-width: 1024px) {
  .main-content-row {
    grid-template-columns: 1fr;
  }
}

.home-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10rem 0;
  gap: 1.5rem;
  color: #6b7280;
}

.loader-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(138, 43, 226, 0.1);
  border-top-color: #8a2be2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
