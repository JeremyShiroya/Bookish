<template>
  <div class="hidden-books-page">
    <MobileSettingsNav title="Hidden Books" back-to="/settings/storage" aria-label="Hidden books navigation" />

    <div class="hidden-body">
      <!-- Only the view toggle: the status/format filters would be filtering a
           list whose defining property is already "hidden". -->
      <div v-if="hiddenBooks.length" class="hidden-controls">
        <span class="hidden-count">
          {{ hiddenBooks.length }} hidden book{{ hiddenBooks.length === 1 ? '' : 's' }}
        </span>
        <div class="view-chips" role="group" aria-label="View">
          <button
            type="button"
            class="view-chip"
            :class="{ active: viewMode === 'grid' }"
            aria-label="Grid view"
            @click="viewMode = 'grid'"
          >
            <i class="ri-layout-grid-fill"></i>
          </button>
          <button
            type="button"
            class="view-chip"
            :class="{ active: viewMode === 'list' }"
            aria-label="List view"
            @click="viewMode = 'list'"
          >
            <i class="ri-list-unordered"></i>
          </button>
        </div>
      </div>

      <div v-if="hiddenBooks.length" :class="viewMode === 'list' ? 'book-list' : 'books-grid'">
        <LibraryBookCard
          v-for="book in hiddenBooks"
          :key="book.id"
          :book="book"
          :show-personal-rating="false"
          restore-only
          :class="{ 'mobile-list-book-card': viewMode === 'list' }"
          @open="router.push(`/book/${book.id}`)"
          @restore="handleRestore"
        />
      </div>

      <EmptyState
        v-else-if="!loading"
        title="No hidden books"
        description="Books you hide from your library will wait here until you restore them."
        icon="ri-eye-off-line"
      />
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import EmptyState from '~/components/shared/EmptyState.vue'
import LibraryBookCard from '~/components/shared/LibraryBookCard.vue'
import { useBooks } from '~/composables/useBooks'
import { useToast } from '~/composables/useToast'
import MobileSettingsNav from './MobileSettingsNav.vue'

const { listHiddenBooks, restoreHiddenBook } = useBooks()
const { addToast } = useToast()
const router = useRouter()

const hiddenBooks = ref([])
const viewMode = ref('grid')
const loading = ref(true)

const refresh = async () => {
  loading.value = true
  try {
    hiddenBooks.value = await listHiddenBooks()
  } finally {
    loading.value = false
  }
}

const handleRestore = async (book) => {
  // Drop it locally first so the card leaves immediately; the reload behind
  // this is what puts the book back into the rest of the app.
  hiddenBooks.value = hiddenBooks.value.filter((item) => item.id !== book.id)
  const restored = await restoreHiddenBook(book.id)
  addToast(
    restored ? `"${book.title}" is back in your library.` : 'That book could not be restored.',
    restored ? 'success' : 'error',
  )
  if (!restored) await refresh()
}

onMounted(refresh)
</script>

<style scoped>
.hidden-books-page {
  width: 100%;
}

.hidden-body {
  padding: 0 var(--mobile-page-padding-inline)
    calc(var(--mobile-bottom-nav-height, 72px) + env(safe-area-inset-bottom));
}

.hidden-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.hidden-count {
  color: var(--color-text-muted);
  font-size: var(--mobile-subtext-size, 0.85rem);
}

.view-chips {
  display: inline-flex;
  gap: 6px;
}

.view-chip {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 0;
  border-radius: var(--mobile-control-radius, 12px);
  background: var(--color-surface-secondary);
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 18px;
}

.view-chip.active {
  background: var(--color-surface-active);
  color: var(--color-brand-primary);
}

/* Same geometry as the Books page, so a hidden book looks like itself. */
.books-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px 14px;
  justify-content: start;
}

.book-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
</style>
