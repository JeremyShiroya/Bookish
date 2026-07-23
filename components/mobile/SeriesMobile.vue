<template>
  <div class="series-container">
    <MobileTopNav />


    <div v-if="showSkeleton" class="series-loading">
      <MobileSkeleton page="series" :count="4" />
    </div>

    <div v-if="!showSkeleton && seriesSource.length" class="series-controls">
      <LibraryControlsRow
        :built-in-filters="false"
        :sections="filterSections"
        :values="filterValues"
        hide-view
        @update:values="filterValues = $event"
      />
    </div>

    <div v-if="!showSkeleton && visibleSeriesList.length > 0" class="series-grid">
      <SeriesCollageCard
        v-for="series in visibleSeriesList"
        :key="series.id"
        :series="series"
        @open="openSeries"
      />
    </div>

    <EmptyState
      v-else-if="!showSkeleton && seriesSource.length"
      title="No series match this filter"
      description="Choose another sort, status or collection filter to see more."
      icon="ri-filter-3-line"
    />

    <EmptyState
      v-else-if="showEmpty && !showSkeleton && !seriesSource.length"
      illustration="series"
      title="No series yet"
      description="Books that share a series name group here automatically — refresh a book's details to pick up its series."
    >
      <template #action>
        <NuxtLink to="/books" class="add-btn">
          <i class="ri-add-line"></i>
          Explore Library
        </NuxtLink>
      </template>
    </EmptyState>

    <MobileBottomNav />
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useBooks } from "~/composables/useBooks";
import EmptyState from "../shared/EmptyState.vue";
import LibraryControlsRow from "../shared/LibraryControlsRow.vue";
import SeriesCollageCard from "../shared/SeriesCollageCard.vue";
import MobileBottomNav from "./MobileBottomNav.vue";
import MobileSkeleton from "./MobileSkeleton.vue";
import MobileTopNav from "./MobileTopNav.vue";

const { seriesList, loading, initialized } = useBooks();
const router = useRouter();
const props = defineProps({
  items: {
    type: Array,
    default: null,
  },
  title: {
    type: String,
    default: "Series",
  },
  showTitle: {
    type: Boolean,
    default: true,
  },
  showEmpty: {
    type: Boolean,
    default: true,
  },
});

// When the parent passes `items`, this is a section of another page that has
// already loaded — only the standalone Series page waits on the library.
const showSkeleton = computed(() => !props.items && loading.value && !initialized.value);

const seriesSource = computed(() => props.items || seriesList.value);

// A series is a group, not a book, so the library-wide Status/Format pair does
// not apply — these three describe the group itself.
const filterSections = [
  {
    key: 'sort',
    label: 'Name',
    icon: 'ri-sort-alphabet-asc',
    options: [
      { value: 'az', label: 'A – Z' },
      { value: 'za', label: 'Z – A' },
    ],
  },
  {
    key: 'status',
    label: 'Status',
    icon: 'ri-bookmark-line',
    options: [
      { value: 'all', label: 'All' },
      { value: 'Unread', label: 'Unread' },
      { value: 'Reading', label: 'Reading' },
      { value: 'Read', label: 'Read' },
    ],
  },
  {
    key: 'collected',
    label: 'Books collected',
    icon: 'ri-stack-line',
    options: [
      { value: 'any', label: 'No filter' },
      { value: 'complete', label: 'All collected' },
      { value: 'partial', label: 'Some collected' },
    ],
  },
];

const filterValues = ref({ sort: 'az', status: 'all', collected: 'any' });

const bookStatus = (book) => {
  const status = String(book?.status || 'Unread').toLowerCase();
  if (status === 'read' || status === 'completed' || Number(book?.progress) >= 100) return 'Read';
  if (status === 'reading') return 'Reading';
  return 'Unread';
};

// How much of the series is on the shelf. Without a known total there is
// nothing to be complete OR incomplete against, so such a series answers
// neither filter rather than guessing.
const collectionState = (series) => {
  const total = Number(series?.seriesTotal || 0);
  if (!Number.isFinite(total) || total <= 0) return 'unknown';
  return series.books.length >= total ? 'complete' : 'partial';
};

const visibleSeriesList = computed(() => {
  const { sort, status, collected } = filterValues.value;
  const filtered = sortedSeriesList.value.filter((series) => {
    // A status filter keeps a series that HAS a book you are at that stage
    // with — a series is rarely all one thing.
    if (status !== 'all' && !series.books.some((book) => bookStatus(book) === status)) return false;
    if (collected !== 'any' && collectionState(series) !== collected) return false;
    return true;
  });
  const direction = sort === 'za' ? -1 : 1;
  return [...filtered].sort((a, b) => direction
    * String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }));
});

const sortedSeriesList = computed(() =>
  seriesSource.value.map((series) => ({
    ...series,
    books: [...series.books].sort((a, b) => {
      const aIdx = Number(a.seriesInstallment) || Infinity;
      const bIdx = Number(b.seriesInstallment) || Infinity;
      return aIdx - bIdx;
    }),
  }))
);

const openSeries = (series) => {
  router.push(`/serie/${series.id}`);
};
</script>

<style scoped>
.series-container {
  margin: 0 auto;
  padding-top: calc(4.85rem + env(safe-area-inset-top));
  padding-bottom: calc(var(--mobile-bottom-nav-height, 72px) + env(safe-area-inset-bottom));
}





.series-loading {
  padding: 0.5rem 0;
}

.series-controls {
  padding: 0 var(--mobile-page-padding-inline);
}

.series-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.25rem;
}

.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 10px;
  background: var(--gradient-brand-primary);
  color: var(--color-text-on-brand);
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  transition: transform 0.2s, box-shadow 0.2s;
}

.add-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-brand-button-hover);
}



  .series-grid {
    grid-template-columns: 1fr;
    gap: 16px;
    padding: 0 var(--mobile-page-padding-inline);
  }

  .add-btn {
    min-height: var(--mobile-touch-target);
    border-radius: var(--mobile-control-radius);
    font-size: var(--mobile-subtext-size);
  }

</style>
