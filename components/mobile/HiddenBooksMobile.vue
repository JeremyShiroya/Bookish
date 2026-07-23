<template>
  <div class="hidden-books-page">
    <MobileSettingsNav title="Hidden Books" back-to="/settings/storage" aria-label="Hidden books navigation" />

    <div class="hidden-body">
      <p v-if="hiddenBooks.length" class="hidden-count">
        {{ hiddenBooks.length }} hidden book{{ hiddenBooks.length === 1 ? '' : 's' }}
      </p>

      <!-- The same controls row the Books, Playlist and Series pages use, so a
           hidden book is browsed exactly like any other shelf. -->
      <LibraryControlsRow
        v-if="hiddenBooks.length"
        v-model:status="selectedStatus"
        v-model:view="viewMode"
      />

      <div v-if="filteredBooks.length" :class="viewMode === 'list' ? 'book-list' : 'books-grid'">
        <LibraryBookCard
          v-for="book in filteredBooks"
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
        v-else-if="hiddenBooks.length"
        title="No books match this filter"
        description="Choose another reading status or format to see more books."
        icon="ri-filter-3-line"
      />

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
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import EmptyState from '~/components/shared/EmptyState.vue'
import LibraryBookCard from '~/components/shared/LibraryBookCard.vue'
import LibraryControlsRow from '~/components/shared/LibraryControlsRow.vue'
import { matchesFormatFilter, useBookishSettings } from '~/composables/useBookishSettings'
import { useBooks } from '~/composables/useBooks'
import { useToast } from '~/composables/useToast'
import MobileSettingsNav from './MobileSettingsNav.vue'

const { listHiddenBooks, restoreHiddenBook } = useBooks()
const { settings } = useBookishSettings()
const { addToast } = useToast()
const router = useRouter()

const hiddenBooks = ref([])
const viewMode = ref('grid')
const selectedStatus = ref('all')
const loading = ref(true)

const normalizedStatus = (book) => {
  const status = String(book.status || 'Unread').toLowerCase()
  if (status === 'read' || status === 'completed' || Number(book.progress) >= 100) return 'Read'
  if (status === 'reading') return 'Reading'
  return 'Unread'
}

const filteredBooks = computed(() => hiddenBooks.value.filter((book) => (
  matchesFormatFilter(book, settings.value.formatFilter)
  && (selectedStatus.value === 'all' || normalizedStatus(book) === selectedStatus.value)
)))

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

.hidden-count {
  margin: 0 0 10px;
  color: var(--color-text-muted);
  font-size: var(--mobile-subtext-size, 0.85rem);
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
