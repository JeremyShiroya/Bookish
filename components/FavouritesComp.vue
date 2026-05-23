<template>
  <div class="favourites-container">
    <div class="favourites-header">
      <h1 class="favourites-title">
        Favourites <span class="favourites-count">({{ favourites.length }})</span>
      </h1>
    </div>

    <div v-if="loading && !initialized" class="favourites-loading">
        <SkeletonLoader variant="favourites-grid" :count="6" />
    </div>

    <template v-else-if="initialized">
        <div v-if="favourites.length > 0" class="books-grid">
          <div
            v-for="book in favourites"
            :key="book.id"
            class="book-card"
            @click="router.push(`/reader/${book.id}`)"
          >
            <div class="book-cover">
              <img :src="book.cover" :alt="book.title" />
              <button 
                class="heart-btn active" 
                title="Remove from favorites"
                @click.stop="toggleFavourite(book.id)"
              >
                <i class="ri-heart-fill"></i>
              </button>
              <button class="play-btn" title="Play">
                <i class="ri-play-fill"></i>
              </button>
            </div>
            <div class="book-info">
              <h3 class="book-title">{{ book.title }}</h3>
              <p class="book-author">{{ book.author }}</p>
            </div>
          </div>
        </div>
        
        <EmptyState
          v-else
          title="No favorites yet"
          description="Books you mark as favorite will appear here for quick access."
          icon="ri-heart-line"
        >
          <template #action>
            <NuxtLink to="/books" class="explore-btn">
              Explore Library
            </NuxtLink>
          </template>
        </EmptyState>
    </template>
  </div>
</template>

<script setup>
import { useBooks } from "~/composables/useBooks";
import EmptyState from "./EmptyState.vue";

const { favourites, toggleFavourite, loading, initialized } = useBooks();
const router = useRouter();
</script>

<style scoped>
.favourites-container {
  padding: 0rem;
  margin: 0 auto;
}

.favourites-header {
  margin-bottom: 2rem;
}

.favourites-title {
  font-size: 1.5rem;
  font-weight: 400;
  color: #8A2BE2;
  margin: 0;
}

.favourites-count {
  color: #9ca3af;
  font-weight: normal;
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 200px);
  gap: 1.5rem;
  justify-content: start;
}

@media (max-width: 480px) {
  .books-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.favourites-loading {
  padding: 0.5rem 0;
}

.book-card {
  display: flex;
  flex-direction: column;
  cursor: pointer;
  width: 200px;
  transition: all 0.3s ease;
}

.book-card:hover {
  transform: translateY(-5px);
}

.book-cover {
  width: 100%;
  aspect-ratio: 7/10;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  margin-bottom: 0.75rem;
  transition: all 0.3s ease;
  position: relative;
}

.heart-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  border: none;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transform: translateY(-10px);
  transition: all 0.3s ease;
  color: #ef4444;
}

.play-btn {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: #8A2BE2;
  border-radius: 50%;
  border: none;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transform: translateY(10px);
  transition: all 0.3s ease;
}

.play-btn i {
  color: #fff;
  font-size: 24px;
}

.book-card:hover .heart-btn,
.book-card:hover .play-btn {
  opacity: 1;
  transform: translateY(0);
}

.book-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: all 0.3s ease;
}

.book-info {
  text-align: left;
}

.book-title {
  font-size: 0.875rem;
  font-weight: 400;
  color: #1f2937;
  margin: 0 0 0.25rem 0;
}

.book-author {
  font-size: 0.75rem;
  color: #6b7280;
  margin: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5rem 0;
  color: #9ca3af;
}

.empty-state i {
  font-size: 4rem;
  margin-bottom: 1rem;
}
</style>
