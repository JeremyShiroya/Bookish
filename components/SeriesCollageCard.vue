<template>
  <button class="series-card" type="button" @click="$emit('open', series)">
    <span class="series-meta">
      <span class="series-name">{{ series.name }}</span>
      <span class="series-count">{{ collectedCount }}/{{ totalCount }} Books</span>
    </span>

    <span class="series-fan" aria-hidden="true">
      <img
        v-for="(cover, i) in coverStack"
        :key="i"
        class="fan-cover"
        :src="cover"
        :style="fanStyle(i, coverStack.length)"
        alt=""
      />
      <span v-if="coverStack.length === 0" class="fan-empty">
        <i class="ri-book-shelf-line"></i>
      </span>
    </span>
  </button>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  series: { type: Object, required: true },
});

defineEmits(["open"]);

const bookCount = computed(() => props.series.books?.length || 0);

const totalCount = computed(() =>
  Number(
    props.series.totalBooks ||
    props.series.seriesTotal ||
    props.series.books?.[0]?.seriesTotal
  ) || Math.max(bookCount.value, 1)
);

const collectedCount = computed(() => Math.min(bookCount.value, totalCount.value));

const coverStack = computed(() =>
  (props.series.books || [])
    .filter((book) => book.cover)
    .slice(0, 4)
    .map((book) => book.cover)
);

// Symmetric, centre-anchored fan. The covers spread evenly outward from the
// middle of the card: a single cover stands straight, two splay into a shallow
// V, three keep the middle upright with the outer two tilting away, and four
// fan across. `offset` is each cover's distance from the centre of the row.
const fanStyle = (i, n) => {
  const offset = i - (n - 1) / 2;                                 // <0 left, >0 right
  const spread = n <= 1 ? 0 : n === 2 ? 92 : n === 3 ? 80 : 62;   // px between covers
  const tilt = n <= 1 ? 0 : n === 2 ? 16 : n === 3 ? 11 : 9;      // deg between covers
  const drop = n >= 4 ? 8 : n === 3 ? 12 : 6;                     // outer covers sink
  const x = offset * spread;
  const y = Math.abs(offset) * drop;
  const rot = offset * tilt;
  return {
    transform: `translateX(calc(-50% + ${x}px)) translateY(${y}px) rotate(${rot}deg)`,
    zIndex: String(30 - Math.round(Math.abs(offset) * 6)),
  };
};
</script>

<style scoped>
.series-card {
  position: relative;
  display: block;
  width: 100%;
  min-width: 0;
  height: 214px;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 22px;
  background: var(--color-surface-primary);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.1);
  cursor: pointer;
  text-align: left;
}

.series-meta {
  position: absolute;
  top: 26px;
  right: 26px;
  left: 28px;
  z-index: 40;
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.series-name {
  overflow: hidden;
  max-width: 100%;
  color: var(--color-text-primary);
  font-size: 1.5rem;
  /* Overrides the global `span { font-weight: 400 !important }` reset. */
  font-weight: 700 !important;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.series-count {
  color: var(--color-text-muted);
  font-size: 1.05rem;
  line-height: 1.1;
}

.series-fan {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 5;
  height: 132px;
}

.fan-cover {
  position: absolute;
  bottom: -34px;
  left: 50%;
  width: 116px;
  height: 170px;
  object-fit: cover;
  border-radius: 10px;
  box-shadow: 0 16px 30px rgba(15, 23, 42, 0.22);
  transform-origin: bottom center;
}

.fan-empty {
  position: absolute;
  bottom: -16px;
  left: 50%;
  display: flex;
  width: 116px;
  height: 150px;
  transform: translateX(-50%);
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--color-brand-primary-soft);
  color: var(--color-brand-primary);
  font-size: 2.6rem;
}

@media (max-width: 380px) {
  .series-card {
    height: 190px;
  }

  .series-name {
    font-size: 1.3rem;
  }

  .series-count {
    font-size: 0.95rem;
  }

  .fan-cover {
    width: 104px;
    height: 152px;
  }
}
</style>
