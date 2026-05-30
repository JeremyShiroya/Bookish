<template>
  <div class="collections-container">
    <div class="collections-header">
      <h1 class="collections-title">
        Playlists <span class="collections-count">({{ collections.length }})</span>
      </h1>
    </div>

    <div v-if="collectionsWithBooks.length > 0" class="collections-grid">
      <div
        v-for="collection in collectionsWithBooks"
        :key="collection.id"
        class="collection-card"
        @click="router.push(`/playlists/${collection.id}`)"
      >
        <div class="stacked-covers">
          <div 
            v-for="i in 3" 
            :key="i" 
            class="cover-item"
            :class="{ 'placeholder-cover': i > collection.previewBooks.length }"
            :style="getStackStyle(i - 1)"
          >
            <img v-if="i <= collection.previewBooks.length" :src="collection.previewBooks[i-1].cover" :alt="collection.previewBooks[i-1].title" />
            <div v-else class="placeholder-content">
              <i class="ri-book-line"></i>
            </div>
          </div>
        </div>
        
        <div class="collection-info">
          <h3 class="collection-name">{{ collection.name }}</h3>
          <p class="collection-description">{{ collection.description }}</p>
          <div class="collection-meta">
            <span class="book-count">
              <i class="ri-book-3-line"></i>
              {{ collection.bookCount }} books
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else
      title="No playlists yet"
      description="Organize your library by creating playlists for favorites, moods, genres, or reading plans."
      icon="ri-play-list-2-line"
    >
      <template #action>
        <button class="add-btn">
          <i class="ri-add-line"></i>
          Create Playlist
        </button>
      </template>
    </EmptyState>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useBooks } from "~/composables/useBooks";
import EmptyState from "./EmptyState.vue";

const { collections, books } = useBooks();
const router = useRouter();

const collectionsWithBooks = computed(() => {
  return collections.value.map(collection => {
    const bookIds = collection.bookIds || []
    const previewBooks = books.value
      .filter(b => bookIds.slice(0, 3).includes(b.id))
      .sort((a, b) => {
          // Keep the order of bookIds if possible for the stack
          return bookIds.indexOf(a.id) - bookIds.indexOf(b.id);
      });
    return {
      ...collection,
      bookCount: bookIds.length,
      previewBooks
    };
  });
});

const getStackStyle = (index) => {
  const offsets = [
    { x: 0, y: 0, rotate: 0, z: 3 },
    { x: 12, y: -8, rotate: 4, z: 2 },
    { x: 24, y: -16, rotate: 8, z: 1 }
  ];
  
  const style = offsets[index] || offsets[0];
  
  return {
    transform: `translate(${style.x}px, ${style.y}px) rotate(${style.rotate}deg)`,
    zIndex: style.z
  };
};
</script>

<style scoped>
.collections-container {
  padding: 0rem;
  margin: 0 auto;
}

.collections-header {
  margin-bottom: 2.5rem;
}

.collections-title {
  font-size: 1.5rem;
  font-weight: 400;
  color: var(--color-brand-primary);
  margin: 0;
}

.collections-count {
  color: var(--color-text-subtle);
  font-weight: normal;
  font-size: 1.25rem;
}

.collections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.5rem;
  justify-content: start;
}

.collection-card {
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.collection-card:hover {
  transform: translateY(-8px);
}

.stacked-covers {
  position: relative;
  width: 175px;
  height: 250px;
  margin-bottom: 1.5rem;
  margin-left: 10px; /* Offset for the stack spread */
}

.cover-item {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: var(--shadow-card-hover);
  background: var(--color-surface-muted);
  transition: all 0.4s ease;
}

.collection-card:hover .cover-item:nth-child(2) {
  transform: translate(25px, -15px) rotate(8deg) !important;
}

.collection-card:hover .cover-item:nth-child(3) {
  transform: translate(50px, -30px) rotate(16deg) !important;
}

.cover-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: all 0.3s ease;
}

.placeholder-cover {
  background: var(--color-surface-secondary);
  border: 2px dashed var(--color-border-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: none;
}

.placeholder-content {
  color: var(--color-text-subtle);
  font-size: 2.5rem;
  opacity: 0.5;
}

.collection-info {
  margin-top: 0.5rem;
}

.collection-name {
  font-size: 1.25rem;
  font-weight: 400;
  color: var(--color-text-secondary);
  margin: 0 0 0.5rem 0;
  transition: color 0.3s ease;
}

.collection-card:hover .collection-name {
  color: var(--color-brand-primary);
}

.collection-description {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0 0 1rem 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.collection-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.book-count {
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--color-brand-primary);
  background: var(--color-surface-active);
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

@media (max-width: 640px) {
  .collections-grid {
    grid-template-columns: 1fr;
    gap: 3rem;
  }
  
  .stacked-covers {
      margin: 0 auto 1.5rem auto;
  }
  
  .collection-info {
      text-align: center;
  }
  
  .collection-meta {
      justify-content: center;
  }
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
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.add-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px var(--shadow-brand-glow);
}
</style>
