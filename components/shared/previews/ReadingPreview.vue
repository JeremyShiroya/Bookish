<template>
  <!-- "highlight": a page of text with one sentence banded, as narration does.
       "listen":    the Listen player over a blurred cover, or a plain one. -->
  <span class="mini" :class="[`k-${kind}`, on ? 'is-on' : 'is-off']">
    <template v-if="kind === 'highlight'">
      <span class="ln" v-for="n in 5" :key="`t-${n}`" :class="{ hl: on && n === 3 }"></span>
    </template>

    <template v-else>
      <span v-if="on" class="listen-bg"></span>
      <span v-if="on" class="listen-ov"></span>
      <span class="listen-cover"></span>
      <span class="listen-title"></span>
      <span class="listen-bar"></span>
      <span class="listen-controls">
        <span class="dot"></span>
        <span class="dot big"></span>
        <span class="dot"></span>
      </span>
    </template>
  </span>
</template>

<script setup>
defineProps({
  // 'highlight' | 'listen'
  kind: { type: String, default: 'highlight' },
  on: { type: Boolean, default: true },
})
</script>

<style scoped>
.mini {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 9px;
  background: #e8e8f1;
}

:root[data-theme='dark'] .mini {
  background: var(--color-surface-primary);
}

/* ── Highlight-while-reading ──────────────────────────────────── */
.k-highlight {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  padding: 10px;
}

.ln {
  height: 5px;
  border-radius: 3px;
  background: var(--color-text-muted);
  opacity: 0.42;
}

.ln:nth-child(2) { width: 92%; }
.ln:nth-child(3) { width: 78%; }
.ln:nth-child(4) { width: 88%; }
.ln:nth-child(5) { width: 60%; }

.ln.hl {
  background: var(--color-brand-primary);
  opacity: 1;
  box-shadow: 0 0 0 3px var(--color-brand-primary-faint);
}

/* ── Listen-mode blurred cover ────────────────────────────────── */
.k-listen {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 5px;
  padding: 8px;
}

.listen-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 32% 30%, #b23b2e, transparent 55%),
    radial-gradient(circle at 68% 62%, #2b3a67, transparent 60%),
    linear-gradient(140deg, #d98324, #7a2018);
  filter: blur(12px) saturate(1.5);
  transform: scale(1.25);
}

.listen-ov {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0.5));
}

.listen-cover {
  z-index: 2;
  width: 28px;
  height: 40px;
  border-radius: 3px;
  background: linear-gradient(160deg, #2b3a67, #1e2746);
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.4);
}

.listen-title {
  z-index: 2;
  width: 46%;
  height: 5px;
  border-radius: 3px;
  background: var(--color-text-primary);
  opacity: 0.8;
}

.listen-bar {
  z-index: 2;
  width: 70%;
  height: 3px;
  border-radius: 2px;
  background: var(--color-brand-primary);
}

.listen-controls {
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-text-primary);
  opacity: 0.7;
}

.dot.big {
  width: 8px;
  height: 8px;
  opacity: 1;
}

/* Over the blurred artwork the player goes white, like the real thing. */
.k-listen.is-on .listen-title,
.k-listen.is-on .dot {
  background: #fff;
}
</style>
