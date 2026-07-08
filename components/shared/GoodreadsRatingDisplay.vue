<template>
  <div v-if="ratingInfo.hasRating" class="goodreads-rating" :class="{ compact, stacked }">
    <div class="goodreads-score-line">
      <div class="goodreads-stars" :aria-label="`${ratingInfo.rating.toFixed(2)} out of 5 on Goodreads`">
        <span
          v-for="star in 5"
          :key="star"
          class="goodreads-star"
          :class="getStarClass(star)"
        >★</span>
      </div>
      <strong class="goodreads-score">{{ ratingInfo.rating.toFixed(2) }}</strong>
    </div>
    <div class="goodreads-count-line">
      <span v-if="ratingInfo.ratingsCount" class="goodreads-count">{{ ratingInfo.ratingsCount }} ratings</span>
      <span v-if="ratingInfo.reviewsCount" class="goodreads-count">· {{ ratingInfo.reviewsCount }} reviews</span>
    </div>
  </div>
  <div v-else-if="showEmpty" class="goodreads-rating empty" :class="{ compact, stacked }">
    <div class="goodreads-score-line">
      <div class="goodreads-stars">
        <span v-for="star in 5" :key="star" class="goodreads-star empty-star">★</span>
      </div>
    </div>
    <div class="goodreads-count-line">
      <span class="goodreads-empty-text">Goodreads rating not available</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { parseGoodreadsReview } from '~/composables/useGoodreadsRating';

const props = defineProps({
  webReview: {
    type: String,
    default: '',
  },
  showEmpty: {
    type: Boolean,
    default: false,
  },
  compact: {
    type: Boolean,
    default: false,
  },
  // Stars + score on one line, the ratings/reviews counts on the line below.
  // Used where the single row would otherwise cram (mobile book detail).
  stacked: {
    type: Boolean,
    default: false,
  },
});

const ratingInfo = computed(() => parseGoodreadsReview(props.webReview));

const getStarClass = (star) => {
  const value = ratingInfo.value.rating;
  if (value >= star) return 'full-star';
  if (value >= star - 0.5) return 'half-star';
  return 'empty-star';
};
</script>

<style scoped>
.goodreads-rating {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
  color: var(--color-text-secondary);
}

.goodreads-rating.compact {
  gap: 0.35rem;
}

/* Inline (default): both lines sit in the same row and read as one sentence. */
.goodreads-score-line,
.goodreads-count-line {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
}

/* Stacked: stars + score above, counts below. */
.goodreads-rating.stacked {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3rem;
}

.goodreads-rating.stacked .goodreads-count-line {
  flex-wrap: wrap;
  row-gap: 0.15rem;
}

.goodreads-stars {
  display: inline-flex;
  align-items: center;
  gap: 0.05rem;
  flex-shrink: 0;
}

.goodreads-star {
  font-size: 1.25rem;
  line-height: 1;
  color: #d8d8d8;
}

.compact .goodreads-star {
  font-size: 1rem;
}

.full-star,
.half-star {
  color: #e87400;
}

.half-star {
  opacity: 0.65;
}

.goodreads-score {
  font-size: 1.15rem;
  line-height: 1;
  color: var(--color-text-primary);
  font-weight: 600;
}

.compact .goodreads-score {
  font-size: 0.95rem;
}

.goodreads-count,
.goodreads-empty-text {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.compact .goodreads-count,
.compact .goodreads-empty-text {
  font-size: 0.78rem;
}

.empty {
  color: var(--color-text-muted);
}
</style>
