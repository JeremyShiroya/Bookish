<template>
  <button class="home-series-card" type="button" @click="$emit('open', series)">
    <span
      class="series-bg"
      :style="cover ? { backgroundImage: `url(${cover})` } : {}"
    ></span>
    <span class="series-overlay"></span>
    <span class="series-content">
      <span class="series-title">{{ series.name }}</span>
      <span class="series-count">
        <i class="ri-book-2-line"></i>
        {{ bookCount }} {{ bookCount === 1 ? "book" : "books" }}
      </span>
    </span>
    <span class="series-art" aria-hidden="true">
      <img
        v-if="backCover"
        class="series-cover back"
        :src="backCover"
        alt=""
      />
      <img
        v-if="cover"
        class="series-cover front"
        :src="cover"
        :alt="series.name"
      />
      <span v-if="!cover" class="series-fallback">
        <i class="ri-book-shelf-line"></i>
      </span>
    </span>
  </button>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  series: {
    type: Object,
    required: true,
  },
});

defineEmits(["open"]);

const bookCount = computed(() => props.series.books?.length || 0);
const cover = computed(() => props.series.books?.[0]?.cover || "");
const backCover = computed(() => props.series.books?.[1]?.cover || props.series.books?.[0]?.cover || "");
</script>

<style scoped>
.home-series-card {
  position: relative;
  display: flex;
  width: 100%;
  min-width: 0;
  height: 92px;
  align-items: center;
  padding: 14px 16px;
  overflow: hidden;
  border: 0;
  border-radius: 12px;
  color: var(--color-text-on-brand);
  text-align: left;
  cursor: pointer;
  background: #233647;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.12);
}

.series-bg,
.series-overlay {
  position: absolute;
  inset: 0;
}

.series-bg {
  background: #334155;
  background-size: cover;
  background-position: center;
  filter: blur(18px) saturate(1.35);
  transform: scale(1.22);
}

.series-overlay {
  background: linear-gradient(
    90deg,
    rgba(15, 23, 42, 0.82) 0%,
    rgba(15, 23, 42, 0.58) 58%,
    rgba(15, 23, 42, 0.42) 100%
  );
}

.series-content {
  position: relative;
  z-index: 2;
  display: flex;
  min-width: 0;
  max-width: 62%;
  flex-direction: column;
  gap: 12px;
}

.series-title {
  overflow: hidden;
  color: var(--color-text-on-brand);
  font-size: 1rem;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.series-count {
  display: inline-flex;
  width: max-content;
  align-items: center;
  gap: 4px;
  padding: 4px 7px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.16);
  color: var(--color-text-on-image-secondary);
  font-size: 0.64rem;
  line-height: 1;
}

.series-count i {
  font-size: 0.72rem;
}

.series-art {
  position: absolute;
  right: 10px;
  bottom: -18px;
  width: 116px;
  height: 96px;
}

.series-cover {
  position: absolute;
  width: 64px;
  height: 94px;
  object-fit: cover;
  border-radius: 7px;
  box-shadow: 0 10px 18px rgba(0, 0, 0, 0.28);
}

.series-cover.front {
  right: 34px;
  bottom: 0;
  z-index: 2;
  transform: rotate(-13deg);
}

.series-cover.back {
  right: 0;
  bottom: 0;
  z-index: 1;
  opacity: 0.82;
  transform: rotate(-4deg);
}

.series-fallback {
  position: absolute;
  right: 30px;
  bottom: 0;
  display: flex;
  width: 64px;
  height: 94px;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  background: var(--color-brand-primary-soft);
  color: var(--color-brand-primary);
  font-size: 2rem;
  transform: rotate(-12deg);
}
</style>
