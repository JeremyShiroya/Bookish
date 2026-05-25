<template>
  <div class="genres-container">
    <div class="genres-header">
      <h1 class="genres-title">
        Genres <span class="genres-count">({{ genresList.length }})</span>
      </h1>
    </div>

    <div v-if="genresList.length > 0" class="genres-grid">
      <div 
        v-for="genre in genresList" 
        :key="genre.id" 
        class="genre-card"
        :style="getGenreStyle(genre.name)"
      >
        <div class="genre-icon">
          <i :class="getGenreIcon(genre.name)"></i>
        </div>
        <h3 class="genre-name">{{ genre.name }}</h3>
        <div class="genre-overlay"></div>
      </div>
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else
      title="Searching for genres"
      description="Genres will be automatically extracted from the books you add to your library."
      icon="ri-planet-line"
    >
      <template #action>
        <NuxtLink to="/books" class="add-btn">
          <i class="ri-add-line"></i>
          Explore Library
        </NuxtLink>
      </template>
    </EmptyState>
  </div>
</template>

<script setup>
import { useBooks } from "~/composables/useBooks";
import EmptyState from "./EmptyState.vue";

const { genresList } = useBooks();

const getGenreIcon = (genre) => {
  const icons = {
    "Sci-Fi": "ri-rocket-2-line",
    "Fantasy": "ri-magic-line",
    "Thriller": "ri-knife-blood-line",
    "Crime": "ri-spy-line",
    "Philosophy": "ri-mental-health-line",
    "Non-Fiction": "ri-microscope-line",
    "Science": "ri-test-tube-line",
    "Mystery": "ri-question-mark",
    "Action": "ri-sword-line",
    "Dystopian": "ri-skull-line",
    "Psychological": "ri-psychotherapy-line",
    "Politics": "ri-government-line",
    "Romance": "ri-heart-2-line",
    "Drama": "ri-u-disk-line" // placeholder or better icon
  };
  return icons[genre] || "ri-book-line";
};

const getGenreStyle = (genre) => {
  const gradients = [
    "var(--gradient-genre-aurora)",
    "var(--gradient-genre-seafoam)",
    "var(--gradient-genre-rose)",
    "var(--gradient-genre-mint)",
    "var(--gradient-genre-noir)",
    "var(--gradient-genre-forest)"
  ];
  
  // Use a hash of the genre name to pick a stable gradient
  let hash = 0;
  for (let i = 0; i < genre.length; i++) {
    hash = genre.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  
  return {
    background: gradients[index]
  };
};
</script>

<style scoped>
.genres-container {
  padding: 0rem;
  margin: 0 auto;
}

.genres-header {
  margin-bottom: 2.5rem;
}

.genres-title {
  font-size: 1.5rem;
  font-weight: 400;
  color: var(--color-brand-primary);
  margin: 0;
}

.genres-count {
  color: var(--color-text-subtle);
  font-weight: normal;
}

.genres-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.5rem;
}

.genre-card {
  height: 140px;
  border-radius: 1rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  color: var(--color-text-on-brand);
}

.genre-card:hover {
  transform: translateY(-5px);
  box-shadow: var(--shadow-card-hover);
}

.genre-icon {
  position: absolute;
  top: 1rem;
  right: 1rem;
  font-size: 2.5rem;
  opacity: 0.2;
  transition: all 0.3s ease;
}

.genre-card:hover .genre-icon {
  opacity: 0.4;
  transform: scale(1.1);
}

.genre-name {
  font-size: 1.25rem;
  font-weight: 400;
  margin: 0;
  z-index: 2;
  position: relative;
}

.genre-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(to top, var(--color-background-overlay-faint) 0%, transparent 100%);
  z-index: 1;
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  background: var(--gradient-brand-primary);
  color: var(--color-text-on-brand);
  border-radius: 0.5rem;
  font-weight: 400;
  text-decoration: none;
  transition: all 0.2s;
}

.add-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px var(--shadow-brand-glow);
}
</style>
