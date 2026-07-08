<template>
  <div class="mobile-skeleton" :class="`ms-${page}`" aria-hidden="true">
    <!-- Home: search bar, continue-reading card, 3-up book rail, series list -->
    <template v-if="page === 'home'">
      <span class="sk sk-search"></span>

      <span class="sk-title"></span>
      <span class="sk sk-continue"></span>

      <span class="sk-title"></span>
      <div class="sk-book-grid">
        <div v-for="n in 3" :key="`hb-${n}`" class="sk-book">
          <span class="sk sk-cover"></span>
          <span class="sk sk-line w80"></span>
          <span class="sk sk-line w55"></span>
        </div>
      </div>

      <span class="sk-title"></span>
      <div class="sk-series-list">
        <span v-for="n in 2" :key="`hs-${n}`" class="sk sk-series"></span>
      </div>
    </template>

    <!-- Books: controls row, then a 3-up cover grid -->
    <template v-else-if="page === 'books'">
      <div class="sk-controls">
        <span class="sk sk-chip"></span>
        <span class="sk sk-toggle"></span>
      </div>
      <div class="sk-book-grid">
        <div v-for="n in count" :key="`b-${n}`" class="sk-book">
          <span class="sk sk-cover"></span>
          <span class="sk sk-line w80"></span>
          <span class="sk sk-line w55"></span>
        </div>
      </div>
    </template>

    <!-- Series: full-width 3:2 collage cards -->
    <template v-else-if="page === 'series'">
      <div class="sk-series-list">
        <span v-for="n in count" :key="`s-${n}`" class="sk sk-series"></span>
      </div>
    </template>

    <!-- Favourites: controls row, then the same 3-up grid -->
    <template v-else-if="page === 'favourites'">
      <div class="sk-controls">
        <span class="sk sk-chip"></span>
        <span class="sk sk-toggle"></span>
      </div>
      <div class="sk-book-grid">
        <div v-for="n in count" :key="`f-${n}`" class="sk-book">
          <span class="sk sk-cover"></span>
          <span class="sk sk-line w80"></span>
          <span class="sk sk-line w55"></span>
        </div>
      </div>
    </template>

    <!-- Playlists: 3:2 cards, one per row -->
    <template v-else-if="page === 'playlists'">
      <div class="sk-series-list">
        <span v-for="n in count" :key="`p-${n}`" class="sk sk-series"></span>
      </div>
    </template>
  </div>
</template>

<script setup>
// Skeletons shaped like the mobile pages they stand in for. The shared
// SkeletonLoader is proportioned for the wide layouts and read as the wrong
// page while a mobile screen was loading.
defineProps({
  page: {
    type: String,
    required: true,
    validator: (value) => ['home', 'books', 'series', 'favourites', 'playlists'].includes(value),
  },
  count: {
    type: Number,
    default: 6,
  },
})
</script>

<style scoped>
.mobile-skeleton {
  display: grid;
  gap: 14px;
  padding: 0 var(--mobile-page-padding-inline);
}

.sk {
  display: block;
  border-radius: 8px;
  background: linear-gradient(
    90deg,
    var(--color-surface-secondary) 25%,
    var(--color-surface-hover) 37%,
    var(--color-surface-secondary) 63%
  );
  background-size: 400% 100%;
  animation: sk-shimmer 1.4s ease infinite;
}

@keyframes sk-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

@media (prefers-reduced-motion: reduce) {
  .sk {
    animation: none;
  }
}

/* Section heading placeholder */
.sk-title {
  width: 42%;
  height: 18px;
  border-radius: 6px;
  background: var(--color-surface-secondary);
}

.sk-search {
  height: 42px;
  border-radius: var(--mobile-control-radius);
}

.sk-continue {
  height: 130px;
  border-radius: var(--mobile-card-radius);
}

.sk-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sk-chip {
  width: 104px;
  height: 34px;
  border-radius: var(--mobile-control-radius);
}

.sk-toggle {
  width: 92px;
  height: 38px;
  border-radius: 10px;
}

.sk-book-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px 14px;
}

.sk-book {
  display: grid;
  gap: 6px;
}

.sk-cover {
  width: 100%;
  aspect-ratio: 7 / 10;
  border-radius: 8px;
}

.sk-line {
  height: 9px;
  border-radius: 4px;
}

.w80 { width: 80%; }
.w55 { width: 55%; }

.sk-series-list {
  display: grid;
  gap: 12px;
}

.sk-series {
  width: 100%;
  aspect-ratio: 3 / 2;
  border-radius: var(--mobile-card-radius);
}
</style>
