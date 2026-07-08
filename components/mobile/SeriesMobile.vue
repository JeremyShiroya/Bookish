<template>
  <div class="series-container">
    <MobileTopNav />


    <div v-if="showSkeleton" class="series-loading">
      <MobileSkeleton page="series" :count="4" />
    </div>

    <div v-else-if="sortedSeriesList.length > 0" class="series-grid">
      <SeriesCollageCard
        v-for="series in sortedSeriesList"
        :key="series.id"
        :series="series"
        @open="openSeries"
      />
    </div>

    <EmptyState
      v-else-if="showEmpty && !showSkeleton"
      title="No series detected"
      description="Books that share series metadata will automatically group here."
      icon="ri-book-shelf-line"
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
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useBooks } from "~/composables/useBooks";
import EmptyState from "../shared/EmptyState.vue";
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

const sortedSeriesList = computed(() =>
  (props.items || seriesList.value).map((series) => ({
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
