<template>
  <div class="authors-container">
    <div class="authors-header">
      <h1 class="authors-title">
        Authors <span class="authors-count">({{ allAuthors.length }})</span>
      </h1>
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
              <img v-if="author.image" :src="author.image" :alt="author.name" />
              <div v-else class="initial-avatar">{{ author.name.charAt(0) }}</div>
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
          icon="ri-group-line"
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
  padding: 0rem;
  margin: 0 auto;
}

.authors-header {
  margin-bottom: 2.5rem;
}

.authors-title {
  font-size: 1.5rem;
  font-weight: 400;
  color: #8A2BE2;
  margin: 0;
}

.authors-count {
  color: #9ca3af;
  font-weight: normal;
}

.authors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 2rem;
}

.author-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  padding: 1.5rem;
  background: white;
  border-radius: 1rem;
  border: 1px solid transparent;
}

.author-card:hover {
  transform: translateY(-5px);
  border-color: #E6E6FA;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
}

.author-avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  margin-bottom: 1rem;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
}

.author-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.initial-avatar {
  font-size: 3rem;
  font-weight: 400;
  color: #8A2BE2;
}

.author-name {
  font-size: 1.125rem;
  font-weight: 400;
  color: #233447;
  margin: 0 0 0.25rem 0;
}

.author-card:hover .author-name {
  color: #8A2BE2;
}

.book-count {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  background: linear-gradient(135deg, #8A2BE2 0%, #6A0DAD 100%);
  color: white;
  border-radius: 0.5rem;
  font-weight: 400;
  text-decoration: none;
  transition: all 0.2s;
}

.add-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(138, 43, 226, 0.4);
}
</style>
