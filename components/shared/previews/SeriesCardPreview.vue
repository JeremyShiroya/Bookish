<template>
  <span class="mini" :class="[`l-${layout}`, `b-${background}`]">
    <!-- blurred cover-image background (playlists technique) -->
    <span v-if="background === 'blur'" class="mini-bg"></span>
    <span v-if="background === 'blur'" class="mini-bg-ov"></span>

    <!-- playlist-style layout -->
    <template v-if="layout === 'cover'">
      <span class="mini-name"></span>
      <span class="mini-covers">
        <span class="mini-cover back" :style="coverStyle(1)"></span>
        <span class="mini-cover front" :style="coverStyle(0)"></span>
      </span>
      <span class="mini-badge">3 Books</span>
    </template>

    <!-- fanned layout -->
    <template v-else>
      <span class="mini-meta">
        <span class="mini-title"></span>
        <span class="mini-sub"></span>
      </span>
      <span class="mini-fan">
        <span class="fc fc-l" :style="coverStyle(0)"></span>
        <span class="fc fc-c" :style="coverStyle(1)"></span>
        <span class="fc fc-r" :style="coverStyle(2)"></span>
      </span>
    </template>
  </span>
</template>

<script setup>
defineProps({
  layout: { type: String, default: 'fan' },
  background: { type: String, default: 'blank' },
})

// A few book-cover-like gradients so the mockup reads as real books.
const covers = [
  'linear-gradient(160deg,#2b3a67,#1e2746)',
  'linear-gradient(160deg,#b23b2e,#7a2018)',
  'linear-gradient(160deg,#d98324,#a35a12)',
]
const coverStyle = (i) => ({ backgroundImage: covers[i % covers.length] })
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

.mini-bg {
  position: absolute;
  inset: -14px;
  background:
    radial-gradient(circle at 30% 30%, #b23b2e, transparent 55%),
    radial-gradient(circle at 70% 60%, #2b3a67, transparent 60%),
    linear-gradient(140deg, #d98324, #7a2018);
  filter: blur(12px) saturate(1.5);
  transform: scale(1.2);
}

.mini-bg-ov {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.5));
}

/* ── fan ─────────────────────────────────────────── */
.mini-meta {
  position: absolute;
  top: 8px;
  left: 9px;
  right: 9px;
  z-index: 3;
  display: grid;
  gap: 4px;
}

.mini-title {
  width: 54%;
  height: 6px;
  border-radius: 3px;
  background: var(--color-text-primary);
  opacity: 0.85;
}

.mini-sub {
  width: 32%;
  height: 4px;
  border-radius: 2px;
  background: var(--color-text-muted);
  opacity: 0.7;
}

.b-blur .mini-title { background: #fff; opacity: 0.95; }
.b-blur .mini-sub { background: #fff; opacity: 0.7; }

.mini-fan {
  position: absolute;
  bottom: -8px;
  left: 50%;
  z-index: 2;
  transform: translateX(-50%);
}

.fc {
  position: absolute;
  bottom: 0;
  width: 26px;
  height: 40px;
  border-radius: 3px;
  background-size: cover;
  box-shadow: 0 4px 9px rgba(15, 23, 42, 0.3);
}

.fc-c { left: -13px; z-index: 3; }
.fc-l { left: -34px; transform: rotate(-11deg); transform-origin: bottom center; z-index: 2; }
.fc-r { left: 8px; transform: rotate(11deg); transform-origin: bottom center; z-index: 2; }

/* ── playlist style ──────────────────────────────── */
.mini-name {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 3;
  width: 40%;
  height: 7px;
  border-radius: 3px;
  background: var(--color-text-primary);
  opacity: 0.85;
}

.b-blur .mini-name { background: #fff; opacity: 0.95; }

.mini-covers {
  position: absolute;
  right: 6px;
  bottom: 6px;
  z-index: 3;
  width: 46%;
  height: 78%;
}

.mini-cover {
  position: absolute;
  bottom: 0;
  height: 88%;
  aspect-ratio: 2 / 3;
  border-radius: 3px;
  background-size: cover;
  box-shadow: -2px 3px 9px rgba(0, 0, 0, 0.4);
}

.mini-cover.front { right: 22%; z-index: 2; transform: rotate(14deg); }
.mini-cover.back { right: 2%; z-index: 1; opacity: 0.85; transform: rotate(26deg); }

.mini-badge {
  position: absolute;
  bottom: 8px;
  left: 9px;
  z-index: 4;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid var(--color-border-card);
  background: var(--color-surface-secondary);
  color: var(--color-text-secondary);
  font-size: 8px;
  font-weight: 500;
}

.b-blur .mini-badge {
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}
</style>
