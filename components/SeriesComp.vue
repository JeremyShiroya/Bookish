<template>
  <div class="series-container">
    <div class="series-header">
      <h1 class="series-title">
        Series <span class="series-count">({{ seriesList.length }})</span>
      </h1>
    </div>

    <div v-if="seriesList.length > 0" class="series-grid">
      <div v-for="series in seriesList" :key="series.name" class="series-card">
        <div class="stacked-covers">
          <!-- Always render 3 layers -->
          <div 
            v-for="i in 3" 
            :key="i"
            class="cover-item"
            :class="{ 'placeholder-cover': i > series.books.length }"
            :style="getStackStyle(i - 1)"
          >
            <!-- Real book cover if available -->
            <img v-if="i <= series.books.length" :src="series.books[i-1].cover" :alt="series.books[i-1].title" />
            <!-- Placeholder content -->
            <div v-else class="placeholder-content">
              <i class="ri-book-line"></i>
            </div>
          </div>
        </div>
        
        <div class="series-info">
          <h3 class="series-name">{{ series.name }}</h3>
          <p class="series-author">by {{ series.author }}</p>
          <div class="series-meta">
            <span class="book-count">
              <i class="ri-book-3-line"></i>
              {{ series.books.length }} books
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else
      title="No series detected"
      description="Books that are part of the same collection will automatically group into series here."
      icon="ri-book-shelf-line"
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

const { seriesList } = useBooks();

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
.series-container {
  padding: 0rem;
  margin: 0 auto;
}

.series-header {
  margin-bottom: 2.5rem;
}

.series-title {
  font-size: 1.5rem;
  font-weight: 400;
  color: var(--color-brand-primary);
  margin: 0;
}

.series-count {
  color: var(--color-text-subtle);
  font-weight: normal;
  font-size: 1.25rem;
}

.series-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.5rem;
  justify-content: start;
}

.series-card {
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.series-card:hover {
  transform: translateY(-8px);
}

.stacked-covers {
  position: relative;
  width: 168px;
  height: 240px;
  margin-bottom: 1.5rem;
  margin-left: 10px;
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

.series-card:hover .cover-item:nth-child(2) {
  transform: translate(25px, -15px) rotate(8deg) !important;
}

.series-card:hover .cover-item:nth-child(3) {
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

.series-info {
  margin-top: 0.5rem;
}

.series-name {
  font-size: 1.25rem;
  font-weight: 400;
  color: var(--color-text-secondary);
  margin: 0 0 0.25rem 0;
}

.series-card:hover .series-name {
  color: var(--color-brand-primary);
}

.series-author {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0 0 1rem 0;
}

.series-meta {
  display: flex;
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
