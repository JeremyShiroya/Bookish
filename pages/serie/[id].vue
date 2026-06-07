<template>
  <BookGroupDetail
    back-to="/series"
    :books="seriesBooks"
    :title="series?.name || seriesName"
    kicker="Your series"
    empty-title="Series not found"
    empty-description="Books with matching series metadata will appear here."
    empty-icon="ri-book-shelf-line"
    :show-installment="true"
    :count-label="seriesCountLabel"
  />
</template>

<script setup>
import { computed } from 'vue';
import BookGroupDetail from '~/components/BookGroupDetail.vue';
import { useBooks } from '~/composables/useBooks';
import { formatSeriesCollectionProgress } from '~/composables/useSeriesProgress';

const route = useRoute();
const { seriesList } = useBooks();

const seriesName = computed(() => {
  try {
    return decodeURIComponent(String(route.params.id || 'Series'));
  } catch {
    return String(route.params.id || 'Series');
  }
});

const series = computed(() => (
  seriesList.value.find((item) => String(item.id) === String(route.params.id))
    || seriesList.value.find((item) => item.name === seriesName.value)
    || null
));

const seriesBooks = computed(() => (
  [...(series.value?.books || [])]
    .sort((a, b) => {
      const aOrder = Number(a.seriesInstallment);
      const bOrder = Number(b.seriesInstallment);
      if (Number.isFinite(aOrder) && Number.isFinite(bOrder)) return aOrder - bOrder;
      return String(a.title || '').localeCompare(String(b.title || ''));
    })
));

// Highest seriesTotal any book in the series has set
const derivedSeriesTotal = computed(() => {
  const totals = seriesBooks.value
    .map(b => Number(b.seriesTotal || 0))
    .filter(n => n > 0 && Number.isFinite(n));
  return totals.length ? Math.max(...totals) : null;
});

const seriesCountLabel = computed(() => (
  formatSeriesCollectionProgress(seriesBooks.value.length, derivedSeriesTotal.value)
));
</script>
