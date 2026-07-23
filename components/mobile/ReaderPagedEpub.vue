<template>
  <div class="paged-reader">
    <div
      ref="viewportRef"
      class="paged-viewport"
      @touchstart.passive="onTouchStart"
      @touchmove.passive="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchCancel"
      @click="onClick"
      @mouseup="emit('selection-settled')"
      @contextmenu.prevent
    >
      <div ref="contentRef" class="paged-content paged-text" :style="contentStyle"></div>
    </div>

    <div v-if="!sections.length" class="paged-empty">
      <i class="ri-book-open-line"></i>
      <p>No readable content found.</p>
      <p class="hint">Re-upload the book to enable in-app reading.</p>
    </div>
  </div>
</template>

<script setup>
// ReadEra-style paged EPUB renderer.
//
// Only ONE section (chapter file) lives in the DOM at a time, laid out into
// fixed-size horizontal pages with CSS multi-columns. Turning a page is a
// transform — no parsing, no layout, no scroll — so it is instant no matter
// how large the book is. Crossing into the next section mounts just that
// section. This replaces the progressive-mount scroll pipeline whose
// unmounted sections used to freeze the reader mid-scroll.

import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { mapSectionChunks } from "~/composables/useChunkSpans";

const props = defineProps({
  bookId: { type: [String, Number], default: "" },
  sections: { type: Array, default: () => [] },
  sanitizeHtml: { type: Function, required: true },
  readableChunks: { type: Array, default: () => [] },
  sectionCounts: { type: Array, default: () => [] },
  activeChunkIndex: { type: Number, default: -1 },
  highlightEnabled: { type: Boolean, default: true },
  // { width, height, gap } — shared with the parent's page-map measurer so
  // background page numbers agree with what is on screen.
  geometry: { type: Object, required: true },
  layoutHash: { type: String, default: "" },
  startSection: { type: Number, default: 0 },
});

const emit = defineEmits([
  "position-change", "long-press", "toggle-chrome", "selection-settled",
  "annotation-tap", "section-rendered",
]);

const viewportRef = ref(null);
const contentRef = ref(null);

const section = ref(0);
const page = ref(0);
const sectionPages = ref(1);
const animate = ref(false);

let chunkEls = new Map();
let renderToken = 0;

const stride = computed(() => props.geometry.width + props.geometry.gap);

const contentStyle = computed(() => ({
  columnWidth: `${props.geometry.width}px`,
  columnGap: `${props.geometry.gap}px`,
  transform: `translateX(-${page.value * stride.value}px)`,
  transition: animate.value ? "transform 0.22s ease-out" : "none",
}));

const posStorageKey = () => `bookish:paged-pos:${props.bookId}`;

const persistPosition = () => {
  try {
    localStorage.setItem(posStorageKey(), JSON.stringify({
      section: section.value,
      page: page.value,
      hash: props.layoutHash,
    }));
  } catch {}
};

const restorePosition = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(posStorageKey()) || "null");
    if (!saved || typeof saved.section !== "number") return null;
    return {
      section: Math.max(0, Math.min(props.sections.length - 1, saved.section)),
      // A typography/viewport change shifts page boundaries; keep the section
      // and clamp the page instead of trusting a stale page index blindly.
      page: Math.max(0, Number(saved.page) || 0),
    };
  } catch {
    return null;
  }
};

const sectionStartChunk = (sectionIndex) => {
  const counts = props.sectionCounts || [];
  let offset = 0;
  for (let i = 0; i < sectionIndex && i < counts.length; i += 1) offset += counts[i] || 0;
  return offset;
};

const sectionForChunk = (chunkIndex) => {
  const counts = props.sectionCounts || [];
  const target = Math.max(0, Number(chunkIndex) || 0);
  let offset = 0;
  for (let i = 0; i < counts.length; i += 1) {
    const count = Math.max(0, Number(counts[i]) || 0);
    if (target < offset + count) return i;
    offset += count;
  }
  return Math.max(0, counts.length - 1);
};

const measureSectionPages = () => {
  const el = contentRef.value;
  if (!el) return 1;
  const width = el.scrollWidth;
  return Math.max(1, Math.round((width + props.geometry.gap) / stride.value));
};

const pageForChunkEl = (el) => {
  if (!el) return null;
  return Math.max(0, Math.min(sectionPages.value - 1, Math.floor((el.offsetLeft + 2) / stride.value)));
};

const emitPosition = () => {
  emit("position-change", {
    section: section.value,
    pageInSection: page.value,
    sectionPages: sectionPages.value,
  });
  persistPosition();
};

// Mount one section's HTML, wrap its sentence chunks, measure its pages.
const renderSection = async (index, targetPage = 0) => {
  const el = contentRef.value;
  if (!el || !props.sections.length) return;
  const token = ++renderToken;
  const safeIndex = Math.max(0, Math.min(props.sections.length - 1, index));

  animate.value = false;
  el.innerHTML = props.sanitizeHtml(props.sections[safeIndex]?.html || "");
  chunkEls = new Map();

  const base = sectionStartChunk(safeIndex);
  const count = (props.sectionCounts || [])[safeIndex] || 0;
  if (count > 0) {
    mapSectionChunks(
      el,
      (props.readableChunks || []).slice(base, base + count),
      base,
      (chunkIdx, span) => chunkEls.set(chunkIdx, span),
    );
  }

  await nextTick();
  if (token !== renderToken) return;

  section.value = safeIndex;
  sectionPages.value = measureSectionPages();
  page.value = targetPage === "last"
    ? sectionPages.value - 1
    : Math.max(0, Math.min(sectionPages.value - 1, Number(targetPage) || 0));

  applyChunkHighlight();
  emitPosition();
  // This section's DOM is brand new, so any highlights or notes in it have to
  // be painted again — they live on chunk offsets, not on surviving nodes.
  emit("section-rendered");
};

const setPage = (target) => {
  const next = Math.max(0, Math.min(sectionPages.value - 1, target));
  if (next === page.value) return;
  animate.value = true;
  page.value = next;
  emitPosition();
};

const nextPage = () => {
  if (page.value < sectionPages.value - 1) {
    setPage(page.value + 1);
  } else if (section.value < props.sections.length - 1) {
    renderSection(section.value + 1, 0);
  }
};

const prevPage = () => {
  if (page.value > 0) {
    setPage(page.value - 1);
  } else if (section.value > 0) {
    renderSection(section.value - 1, "last");
  }
};

const goToSection = (index) => {
  if (index === section.value) return;
  renderSection(index, 0);
};

const goToSectionPage = (targetSection, pageInSection) => {
  if (targetSection === section.value) setPage(pageInSection);
  else renderSection(targetSection, pageInSection);
};

const getPosition = () => ({
  section: section.value,
  pageInSection: page.value,
  sectionPages: sectionPages.value,
  firstChunkOfPage: firstChunkOnCurrentPage(),
});

// First chunk whose span starts on (or after) the visible page — where
// "play from here" should begin.
const firstChunkOnCurrentPage = () => {
  let best = -1;
  let fallback = -1;
  for (const [chunkIdx, el] of chunkEls) {
    const chunkPage = pageForChunkEl(el);
    if (chunkPage === page.value && (best === -1 || chunkIdx < best)) best = chunkIdx;
    if (chunkPage > page.value && (fallback === -1 || chunkIdx < fallback)) fallback = chunkIdx;
  }
  if (best !== -1) return best;
  if (fallback !== -1) return fallback;
  return sectionStartChunk(section.value);
};

// ── Narration highlight + follow ────────────────────────────────────────────

let highlightedEl = null;

const clearChunkHighlight = () => {
  highlightedEl?.classList.remove("tts-active");
  highlightedEl = null;
};

const applyChunkHighlight = () => {
  clearChunkHighlight();
  if (!props.highlightEnabled || props.activeChunkIndex < 0) return;
  const el = chunkEls.get(props.activeChunkIndex);
  if (!el) return;
  el.classList.add("tts-active");
  highlightedEl = el;
};

watch(() => props.activeChunkIndex, async (chunkIdx) => {
  if (chunkIdx < 0) {
    clearChunkHighlight();
    return;
  }
  const targetSection = sectionForChunk(chunkIdx);
  if (targetSection !== section.value) {
    await renderSection(targetSection, 0);
  }
  const el = chunkEls.get(chunkIdx);
  applyChunkHighlight();
  const chunkPage = pageForChunkEl(el);
  if (chunkPage !== null && chunkPage !== page.value) setPage(chunkPage);
});

// ── Gestures: tap zones, swipe, long-press "read from here" ────────────────

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE = 12;
const SWIPE_DISTANCE = 48;

let touchStart = null;
let longPressTimer = null;
let longPressFired = false;

const cancelLongPress = () => {
  if (longPressTimer) clearTimeout(longPressTimer);
  longPressTimer = null;
};

const chunkAtPoint = (x, y) => {
  const range = document.caretRangeFromPoint?.(x, y);
  let node = range?.startContainer ?? document.elementFromPoint(x, y);
  if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;
  const span = node?.closest?.("[data-tts-chunk]");
  const chunkIdx = Number(span?.dataset?.ttsChunk);
  return Number.isNaN(chunkIdx) ? -1 : chunkIdx;
};

const onTouchStart = (event) => {
  if (event.touches.length !== 1) return;
  const touch = event.touches[0];
  touchStart = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  longPressFired = false;
  cancelLongPress();
  longPressTimer = setTimeout(() => {
    longPressTimer = null;
    const chunkIdx = chunkAtPoint(touch.clientX, touch.clientY);
    if (chunkIdx < 0) return;
    longPressFired = true;
    if (navigator.vibrate) navigator.vibrate(12);
    emit("long-press", { chunkIdx, x: touch.clientX, y: touch.clientY });
  }, LONG_PRESS_MS);
};

const onTouchMove = (event) => {
  if (!touchStart) return;
  const touch = event.touches[0];
  if (Math.hypot(touch.clientX - touchStart.x, touch.clientY - touchStart.y) > MOVE_TOLERANCE) {
    cancelLongPress();
  }
};

// A live selection means the finger was dragging a selection handle, not
// turning a page — let the parent offer its actions instead of paging away
// from the text just chosen.
const hasLiveSelection = () => {
  const selection = typeof window !== "undefined" ? window.getSelection?.() : null;
  return !!selection && !selection.isCollapsed;
};

const onTouchEnd = (event) => {
  cancelLongPress();
  if (hasLiveSelection()) {
    touchStart = null;
    emit("selection-settled");
    return;
  }
  if (!touchStart || longPressFired) {
    touchStart = null;
    return;
  }
  const touch = event.changedTouches?.[0];
  if (!touch) {
    touchStart = null;
    return;
  }
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;
  const elapsed = Date.now() - touchStart.time;
  touchStart = null;

  if (elapsed < 600 && Math.abs(dx) >= SWIPE_DISTANCE && Math.abs(dy) < 80) {
    if (dx < 0) nextPage();
    else prevPage();
  }
};

const onTouchCancel = () => {
  cancelLongPress();
  touchStart = null;
};

// Tap zones (also serves mouse/dev): left third = back, right third =
// forward, and the middle toggles the reader chrome so the page can be read
// without the top bar and dock over it.
const onClick = (event) => {
  if (longPressFired) return;
  // Tapping an existing highlight opens it rather than turning the page.
  if (event.target?.closest?.("mark[data-annotation-id]")) {
    emit("annotation-tap", event);
    return;
  }
  if (hasLiveSelection()) return;
  const rect = viewportRef.value?.getBoundingClientRect();
  if (!rect) return;
  const ratio = (event.clientX - rect.left) / rect.width;
  if (ratio >= 0.62) nextPage();
  else if (ratio <= 0.38) prevPage();
  else emit("toggle-chrome");
};

// ── Lifecycle ───────────────────────────────────────────────────────────────

watch(() => props.geometry, async () => {
  // Viewport or typography change: re-lay-out the current section and keep
  // the reader on the same section (page clamped to the new count).
  await renderSection(section.value, page.value);
}, { deep: true });

watch(() => props.layoutHash, async () => {
  await renderSection(section.value, page.value);
});

watch(() => props.sections.length, async (length) => {
  if (length) await renderSection(Math.min(section.value, length - 1), page.value);
});

onMounted(async () => {
  const restored = restorePosition();
  const startAt = restored?.section ?? props.startSection;
  await renderSection(startAt, restored?.page ?? 0);
});

onUnmounted(() => {
  cancelLongPress();
  renderToken += 1;
});

defineExpose({ nextPage, prevPage, goToSection, goToSectionPage, getPosition });
</script>

<style scoped>
.paged-reader {
  position: fixed;
  inset: 0;
  z-index: 1050;
  background: var(--mobile-reader-bg);
}

.paged-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 0.7rem;
  color: var(--mobile-reader-muted);
  text-align: center;
}

.paged-empty i {
  font-size: 2rem;
}

.paged-empty .hint {
  margin: 0;
  font-size: 0.82rem;
  opacity: 0.75;
}
</style>

<style>
/* Shared paged layout + typography — unscoped because the section HTML is
   injected via innerHTML (both here and in the parent's offscreen page-map
   measurer), so scoped attributes never reach it. Driven by the --mr-*
   display preferences set on the reader page root. */
.paged-viewport {
  position: absolute;
  top: calc(64px + env(safe-area-inset-top));
  right: 20px;
  /* --bottom-nav-space collapses to the safe-area inset in page mode (the app's
     tab bar is hidden there); +66px leaves room for the chapter dock. */
  bottom: calc(var(--bottom-nav-space, 72px) + 66px);
  left: 20px;
  overflow: hidden;
  touch-action: none;
}

.paged-content {
  position: relative;
  height: 100%;
  column-fill: auto;
  will-change: transform;
}

.paged-text {
  color: var(--mobile-reader-text);
  font-size: var(--mr-font-size, 17px);
  font-family: var(--mr-font-family, Georgia, "Times New Roman", serif);
  /* !important, reluctantly: assets/css/main.css applies a global
     `font-weight: 400 !important` to p/div/span/strong for the app chrome. Book
     text is the one place the reader must own its weight, or the Thickness
     control silently does nothing. */
  font-weight: var(--mr-font-weight, 400) !important;
  line-height: var(--mr-line-height, 1.62);
  letter-spacing: 0.002em;
  text-align: var(--mr-text-align, justify);
  text-justify: inter-word;
  hyphens: auto;
  -webkit-hyphens: auto;
  overflow-wrap: break-word;
  word-break: break-word;
  /* See ReaderMobile: native selection powers the highlight/note menu. */
  -webkit-user-select: text;
  user-select: text;
  -webkit-touch-callout: none;
}

/* EPUB publisher CSS is not loaded on mobile, but inline styles survive the
   sanitizer — neutralise the ones that push text outside the page (the classic
   "words run off the right edge" books). */
.paged-text :where(p, div, h1, h2, h3, h4, h5, h6, section, article) {
  max-width: 100% !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
  width: auto !important;
}

.paged-text :where(span, a, em, strong, i, b) {
  white-space: normal !important;
}

/* The global weight reset names these tags directly, so the book's paragraphs
   have to be told to inherit the reader's chosen thickness. */
.paged-text :where(p, div, span, b, strong, em, i, li, blockquote) {
  font-weight: inherit !important;
}

.paged-text p {
  margin: 0 0 0.35rem;
  text-indent: 1.3em;
  orphans: 2;
  widows: 2;
}

.paged-text :where(p:first-child, h1 + p, h2 + p, h3 + p, h4 + p, hr + p, figure + p, blockquote + p, img + p) {
  text-indent: 0;
}

.paged-text :where(h1, h2, h3, h4) {
  margin: 1.2em 0 0.6em;
  color: var(--mobile-reader-text);
  font-weight: 600;
  line-height: 1.25;
  text-align: left;
  text-indent: 0;
  hyphens: none;
  break-after: avoid;
}

.paged-text h1 { font-size: 1.5em; }
.paged-text h2 { font-size: 1.3em; }
.paged-text h3 { font-size: 1.14em; }
.paged-text h4 { font-size: 1.04em; }

.paged-text blockquote {
  margin: 1em 0;
  padding: 0.2em 0 0.2em 1em;
  border-left: 3px solid var(--color-reader-highlight-border, rgba(138, 43, 226, 0.4));
  color: var(--mobile-reader-muted);
  font-style: italic;
  text-indent: 0;
}

.paged-text :where(ul, ol) {
  margin: 0.6em 0;
  padding-left: 1.5em;
  text-align: left;
}

.paged-text li {
  margin: 0.25em 0;
  text-indent: 0;
}

.paged-text hr {
  margin: 1.4em auto;
  width: 40%;
  border: 0;
  border-top: 1px solid var(--color-reader-highlight-border, rgba(0, 0, 0, 0.12));
}

.paged-text a {
  color: var(--color-brand-primary);
  text-decoration: none;
}

/* Images can never exceed one page column. */
.paged-text :where(img, svg, image) {
  display: block;
  max-width: 100% !important;
  max-height: 62vh;
  width: auto !important;
  height: auto !important;
  margin: 0.9em auto;
  border-radius: 4px;
  break-inside: avoid;
}

.paged-text figure {
  margin: 1em 0;
  text-indent: 0;
  break-inside: avoid;
}

.paged-text figcaption {
  margin-top: 0.4em;
  color: var(--mobile-reader-muted);
  font-size: 0.85em;
  font-style: italic;
  text-align: center;
  text-indent: 0;
}

.paged-text table {
  max-width: 100% !important;
  margin: 1em 0;
  border-collapse: collapse;
  font-size: 0.9em;
}

.paged-text :where(td, th) {
  padding: 0.35em 0.55em;
  border: 1px solid var(--color-reader-highlight-border, rgba(0, 0, 0, 0.12));
  text-indent: 0;
}

.paged-text .tts-active {
  border-radius: 3px;
  background: var(--color-reader-highlight);
  outline: 1px solid var(--color-reader-highlight-border);
}
</style>
