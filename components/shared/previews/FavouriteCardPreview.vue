<template>
  <span class="mini" :class="`l-${layout}`">
    <!-- grid: three mini cards -->
    <template v-if="layout === 'grid'">
      <span
        v-for="i in 3"
        :key="i"
        class="card"
        :class="`b-${background}`"
      >
        <span v-if="background === 'blur'" class="card-bg" :style="bgStyle(i - 1)"></span>
        <span class="card-cover" :style="coverStyle(i - 1)"></span>
      </span>
    </template>

    <!-- list: two stacked rows -->
    <template v-else>
      <span
        v-for="i in 2"
        :key="i"
        class="row"
        :class="`b-${background}`"
      >
        <span v-if="background === 'blur'" class="row-bg" :style="bgStyle(i - 1)"></span>
        <span class="row-cover" :style="coverStyle(i - 1)"></span>
        <span class="row-lines">
          <span class="line long"></span>
          <span class="line short"></span>
        </span>
      </span>
    </template>
  </span>
</template>

<script setup>
defineProps({
  layout: { type: String, default: 'grid' },
  background: { type: String, default: 'blur' },
})

const covers = [
  'linear-gradient(160deg,#2b3a67,#1e2746)',
  'linear-gradient(160deg,#b23b2e,#7a2018)',
  'linear-gradient(160deg,#d98324,#a35a12)',
]
const coverStyle = (i) => ({ backgroundImage: covers[i % covers.length] })
const bgStyle = (i) => ({ backgroundImage: covers[i % covers.length] })
</script>

<style scoped>
.mini {
  display: flex;
  width: 100%;
  height: 100%;
  padding: 6px;
  gap: 6px;
  overflow: hidden;
  border-radius: 9px;
  background: var(--color-background-app);
}

/* ── grid ────────────────────────────────────────── */
.l-grid {
  align-items: stretch;
}

.card {
  position: relative;
  flex: 1;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 6px;
  border: 1px solid var(--color-border-card);
}

.card.b-blank {
  background: var(--color-surface-primary);
}

.card.b-blur {
  border-color: transparent;
}

.card-bg {
  position: absolute;
  inset: -8px;
  background-size: cover;
  filter: blur(9px) saturate(1.5);
  transform: scale(1.2);
}

.card-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.45));
}

.card-cover {
  position: relative;
  z-index: 1;
  width: 62%;
  aspect-ratio: 2 / 3;
  border-radius: 3px;
  background-size: cover;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.35);
}

/* ── list ────────────────────────────────────────── */
.l-list {
  flex-direction: column;
}

.row {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  overflow: hidden;
  border-radius: 6px;
  border: 1px solid var(--color-border-card);
}

.row.b-blank {
  background: var(--color-surface-primary);
}

.row.b-blur {
  border-color: transparent;
}

.row-bg {
  position: absolute;
  inset: -8px;
  background-size: cover;
  filter: blur(9px) saturate(1.5);
  transform: scale(1.2);
}

.row-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.3));
}

.row-cover {
  position: relative;
  z-index: 1;
  height: 78%;
  aspect-ratio: 2 / 3;
  border-radius: 3px;
  background-size: cover;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}

.row-lines {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 4px;
  flex: 1;
}

.line {
  height: 5px;
  border-radius: 3px;
  background: var(--color-text-primary);
  opacity: 0.75;
}

.line.long { width: 80%; }
.line.short { width: 45%; opacity: 0.5; }

.b-blur .line { background: #fff; opacity: 0.9; }
.b-blur .line.short { opacity: 0.6; }
</style>
