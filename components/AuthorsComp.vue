<template>
  <div class="authors-container">

    <div class="authors-header">
      <h1 class="authors-title">Authors</h1>
    </div>

    <div v-if="loading && !initialized" class="authors-loading">
      <SkeletonLoader variant="authors-grid" :count="8" />
    </div>

    <template v-else-if="initialized">
      <div v-if="allAuthors.length > 0" class="authors-grid">
        <div
          v-for="author in allAuthors"
          :key="author.id"
          class="author-card"
          @click="router.push(`/author/${author.id}`)"
        >
          <div class="author-avatar">
            <img
              v-if="author.image"
              :src="author.image"
              :alt="author.name"
            />
            <div v-else class="initial-avatar">
              {{ author.name.charAt(0).toUpperCase() }}
            </div>
          </div>

          <div class="author-info">
            <h3 class="author-name">{{ author.name }}</h3>
            <p class="book-count">{{ author.bookCount }} {{ author.bookCount === 1 ? 'book' : 'books' }}</p>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <EmptyState
        v-else
        title="No authors found"
        description="Start adding books and their authors will appear here automatically."
        icon="ri-team-line"
      >
        <template #action>
          <NuxtLink to="/books" class="add-btn">
            <i class="ri-add-line"></i>
            Explore Library
          </NuxtLink>
        </template>
      </EmptyState>
    </template>

  </div>
</template>

<script setup>
import { useRouter } from "vue-router";
import { useBooks } from "~/composables/useBooks";
import EmptyState from "./EmptyState.vue";

const { allAuthors, loading, initialized } = useBooks();
const router = useRouter();
</script>

<style scoped>
.authors-container {
  margin: 0 auto;
}

/* ── Header ──────────────────────────────────────────────────── */

.authors-header {
  margin-bottom: 2rem;
}

.authors-title {
  font-size: 1.5rem;
  font-weight: 400;
  color: var(--color-brand-primary);
  margin: 0;
}

/* ── Grid ────────────────────────────────────────────────────── */

.authors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.5rem;
}

/* ── Card ────────────────────────────────────────────────────── */

.author-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  cursor: pointer;
  padding: 0.85rem 0.75rem;
  border-radius: 10px;
  background: transparent;
  border: none;
  transition: background 0.18s ease;
}

.author-card:hover {
  background: var(--color-surface-hover);
}

/* ── Avatar circle ───────────────────────────────────────────── */

.author-avatar {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 50%;
  overflow: hidden;
  margin-bottom: 0.9rem;
  background: var(--color-surface-muted);
  flex-shrink: 0;
  transition:
    transform 0.25s cubic-bezier(0.34, 1.46, 0.64, 1),
    box-shadow 0.25s ease;
}

.author-card:hover .author-avatar {
  transform: scale(1.06);
  box-shadow: 0 8px 28px rgba(138, 43, 226, 0.25);
}

.author-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.initial-avatar {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-brand-primary-soft);
  color: var(--color-brand-primary);
  font-size: 2.2rem;
  font-weight: 600 !important;
  line-height: 1;
}

/* ── Info ────────────────────────────────────────────────────── */

.author-info {
  width: 100%;
  min-width: 0;
}

.author-name {
  font-size: 0.9rem;
  font-weight: 400;
  color: var(--color-text-primary);
  margin: 0 0 0.18rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.18s;
}

.author-card:hover .author-name {
  color: var(--color-brand-primary);
}

.book-count {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0;
  white-space: nowrap;
}

/* ── Empty state ─────────────────────────────────────────────── */

.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: var(--gradient-brand-primary);
  color: var(--color-text-on-brand);
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  transition: transform 0.2s, box-shadow 0.2s;
}

.add-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-brand-button-hover);
}
</style>
