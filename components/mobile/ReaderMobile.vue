<template>
  <div
    :ref="setReaderPage"
    class="reader-mobile-page"
    :class="[readerTheme, { replaceBottomNav: dockReplacingBottomNav }]"
  >
    <header class="reader-mobile-topbar">
      <button
        type="button"
        class="reader-nav-btn"
        aria-label="Back"
        @click="$emit('back')"
      >
        <i class="ri-arrow-left-s-line"></i>
      </button>

      <h1>{{ book?.title || "Reader" }}</h1>

      <div class="reader-top-actions">
        <button
          type="button"
          class="reader-nav-btn"
          aria-label="Audio controls"
          @click="mediaOpen = true"
        >
          <i class="ri-headphone-fill"></i>
        </button>
        <button
          type="button"
          class="reader-nav-btn"
          aria-label="Reader options"
          @click="$emit('open-toc')"
        >
          <i class="ri-equalizer-2-line"></i>
        </button>
      </div>
    </header>

    <main
      class="reader-mobile-content"
      :class="{ 'is-pdf-reader': isPdfRenderable }"
    >
      <div v-if="loading || contentLoading" class="reader-state">
        <SkeletonLoader variant="reader" />
      </div>

      <div v-else-if="!book" class="reader-state reader-error">
        <i class="ri-error-warning-line"></i>
        <h2>Book not found</h2>
      </div>

      <template v-else>
        <div v-if="isPdfRenderable" class="reader-mobile-pdf">
          <PdfViewer
            :ref="setPdfViewer"
            :src="pdfSource"
            :zoom="mobilePdfZoom"
            :manifest="pdfManifest"
            :active-chunk-id="activeTtsChunkIndex"
            :active-word="activeWordRange"
            @page-change="$emit('page-change', $event)"
            @loaded="$emit('pdf-loaded', $event)"
          />
        </div>

        <div v-else-if="isPdfBook" class="reader-state reader-error">
          <i class="ri-file-pdf-2-line"></i>
          <p>
            This PDF was imported before original-page rendering was available.
          </p>
          <p class="hint">
            Re-upload the PDF once so Bookish can display the document exactly
            as it is.
          </p>
        </div>

        <div
          v-else
          class="reader-mobile-chapters"
          :ref="setChaptersContainer"
          @touchstart.passive="onReadingTouchStart"
          @touchmove.passive="onReadingTouchMove"
          @touchend="onReadingTouchEnd"
          @touchcancel="onReadingTouchEnd"
          @contextmenu.prevent
        >
          <section v-if="hasCover" id="ch-cover" class="reader-mobile-cover">
            <img :src="book.cover" :alt="`${book.title} cover`" />
            <h2>{{ book.title }}</h2>
            <p v-if="book.author">by {{ book.author }}</p>
          </section>

          <section
            v-for="(chapter, index) in chapterList"
            :key="index"
            :id="`ch-${index}`"
            class="reader-mobile-section"
          >
            <article
              v-if="chapter.html !== null && chapter.html !== undefined"
              class="reader-mobile-text epub-content"
              v-html="sanitizeHtml(chapter.html)"
            />
            <div
              v-else
              class="reader-section-placeholder"
              :data-section-placeholder="index"
              :style="{ height: `${chapter.estHeight || 600}px` }"
            ></div>
          </section>

          <div
            v-if="!chapterList.length && !contentLoading"
            class="reader-state"
          >
            <i class="ri-book-open-line"></i>
            <p>No readable content found.</p>
            <p class="hint">Re-upload the book to enable in-app reading.</p>
          </div>
        </div>
      </template>
    </main>

    <Transition name="read-here">
      <div
        v-if="readHereMenu.visible"
        class="read-here-menu"
        :style="readHereMenuStyle"
      >
        <button type="button" @click="confirmReadHere">
          <i class="ri-play-circle-fill"></i>
          Read from here
        </button>
      </div>
    </Transition>

    <div class="reader-chapter-dock">
      <div class="chapter-pill">
        <button
          type="button"
          class="chapter-pill-step step-prev"
          aria-label="Previous chapter"
          :tabindex="dockReplacingBottomNav ? -1 : 0"
          @click="$emit('previous-chapter')"
        >
          <i class="ri-arrow-left-s-line"></i>
        </button>
        <button
          type="button"
          class="chapter-pill-title"
          @click="$emit('open-toc')"
        >
          {{ chapterLabel }}
        </button>
        <button
          type="button"
          class="chapter-pill-step step-next"
          aria-label="Next chapter"
          :tabindex="dockReplacingBottomNav ? -1 : 0"
          @click="$emit('next-chapter')"
        >
          <i class="ri-arrow-right-s-line"></i>
        </button>
      </div>
    </div>

    <button
      type="button"
      class="chapter-play"
      aria-label="Play chapter"
      @click="playFromHere"
    >
      <i :class="isPlaying ? 'ri-pause-fill' : 'ri-play-fill'"></i>
    </button>

    <div class="mobile-bottom-nav-wrap" aria-hidden="true">
      <MobileBottomNav />
    </div>

    <Teleport to="body">
      <div v-if="mediaOpen" class="reader-media-layer">
        <button
          class="reader-media-backdrop"
          type="button"
          aria-label="Close audio controls"
          @click="mediaOpen = false"
        ></button>
        <section
          class="reader-media-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Audio controls"
        >
          <div class="sheet-grabber"></div>
          <h2>{{ chapterLabel }}</h2>

          <button
            type="button"
            class="narrator-btn"
            :class="{ open: voicePickerOpen }"
            @click="voicePickerOpen = !voicePickerOpen"
          >
            {{ currentVoiceName }}
            <i :class="voicePickerOpen ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'"></i>
          </button>

          <div v-if="voicePickerOpen" class="voice-list" role="listbox" aria-label="Narrator voices">
            <button
              v-for="voice in ttsVoices"
              :key="voice.id"
              type="button"
              class="voice-option"
              :class="{ active: voice.id === ttsVoiceId }"
              role="option"
              :aria-selected="voice.id === ttsVoiceId"
              @click="chooseVoice(voice.id)"
            >
              <span>{{ voice.name }}</span>
              <i v-if="voice.id === ttsVoiceId" class="ri-check-line"></i>
            </button>
          </div>

          <div class="media-buttons">
            <button type="button" aria-label="Previous" @click="skipChunks(-1)">
              <i class="ri-skip-back-fill"></i>
            </button>
            <button
              type="button"
              class="media-play"
              aria-label="Play or pause"
              @click="toggleMediaPlay"
            >
              <i :class="isPlaying ? 'ri-pause-fill' : 'ri-play-fill'"></i>
            </button>
            <button type="button" aria-label="Next" @click="skipChunks(1)">
              <i class="ri-skip-forward-fill"></i>
            </button>
          </div>

          <div class="media-progress-row">
            <span>{{ elapsedTime || "00:00" }}</span>
            <input
              type="range"
              min="0"
              max="100"
              :value="ttsProgress || 0"
              aria-label="Audio progress"
              @input="seekToProgress(Number($event.target.value))"
            />
            <span>{{ totalTime || "00:00" }}</span>
          </div>

          <button
            type="button"
            class="speed-btn"
            aria-label="Playback speed"
            @click="cycleSpeed"
          >
            {{ speedLabel }}
          </button>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import PdfViewer from "~/components/shared/PdfViewer.vue";
import SkeletonLoader from "~/components/shared/SkeletonLoader.vue";
import { useTTS } from "~/composables/useTTS";
import MobileBottomNav from "./MobileBottomNav.vue";

const props = defineProps({
  readerRefs: { type: Object, required: true },
  readerTheme: { type: String, default: "light" },
  book: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  contentLoading: { type: Boolean, default: false },
  isPdfRenderable: { type: Boolean, default: false },
  isPdfBook: { type: Boolean, default: false },
  pdfSource: { type: null, default: null },
  zoomLevel: { type: Number, default: 1 },
  pdfManifest: { type: Object, default: null },
  activeTtsChunkIndex: { type: Number, default: -1 },
  activeWordRange: { type: Object, default: null },
  hasCover: { type: Boolean, default: false },
  chapterList: { type: Array, default: () => [] },
  currentChapterIdx: { type: Number, default: 0 },
  currentPdfPage: { type: Number, default: 1 },
  totalPages: { type: Number, default: 0 },
  tocPosition: { type: Object, default: null },
  currentChapterTitle: { type: String, default: "" },
  sanitizeHtml: { type: Function, required: true },
  resolveChunkAtPoint: { type: Function, default: null },
  prewarmChunk: { type: Function, default: null },
});

const emit = defineEmits([
  "back",
  "open-toc",
  "page-change",
  "pdf-loaded",
  "read-current-position",
  "read-from-chunk",
  "previous-chapter",
  "next-chapter",
  "mount-section",
]);

const {
  ttsBook,
  ttsStatus,
  ttsProgress,
  ttsSpeed,
  ttsVoices,
  ttsVoiceId,
  elapsedTime,
  totalTime,
  togglePlay,
  skipChunks,
  seekToProgress,
  setSpeed,
  setVoice,
} = useTTS();

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

const mediaOpen = ref(false);
const voicePickerOpen = ref(false);
const replaceBottomNav = ref(false);
let lastScrollY = 0;
let downTravel = 0;
let upTravel = 0;

const dockReplacingBottomNav = computed(() => replaceBottomNav.value);

const isPlaying = computed(
  () => ttsBook.value?.id === props.book?.id && ttsStatus.value === "playing",
);

const mobilePdfZoom = computed(() => 1);

const chapterLabel = computed(() => {
  if (props.isPdfRenderable) {
    const total = props.totalPages || props.book?.pages || 1;
    return `Page ${props.currentPdfPage} / ${total}`;
  }
  if (props.tocPosition?.title) return props.tocPosition.title;
  if (props.currentChapterTitle) return props.currentChapterTitle;
  return `Chapter ${props.currentChapterIdx + 1}`;
});

const currentVoiceName = computed(() => {
  const voice = ttsVoices.value.find((item) => item.id === ttsVoiceId.value);
  return voice ? voice.name : "Switch narrator";
});

const speedLabel = computed(() => `${ttsSpeed.value}x`);

const setReaderPage = (el) => {
  props.readerRefs.readerPageRef.value = el;
};

const setChaptersContainer = (el) => {
  props.readerRefs.chaptersContainerRef.value = el;
};

const setPdfViewer = (el) => {
  props.readerRefs.pdfViewerRef.value = el;
};

const playFromHere = () => {
  if (isPlaying.value) {
    togglePlay();
    return;
  }
  emit("read-current-position");
};

const toggleMediaPlay = () => {
  if (ttsBook.value?.id === props.book?.id && ttsStatus.value !== "idle") {
    togglePlay();
    return;
  }
  emit("read-current-position");
};

const chooseVoice = (voiceId) => {
  setVoice(voiceId);
  voicePickerOpen.value = false;
};

const cycleSpeed = () => {
  const current = SPEED_OPTIONS.indexOf(Number(ttsSpeed.value));
  const next = SPEED_OPTIONS[(current + 1) % SPEED_OPTIONS.length];
  setSpeed(next);
};

watch(mediaOpen, (open) => {
  if (!open) voicePickerOpen.value = false;
});

// ── Long-press "Read from here" ────────────────────────────────────────────

const LONG_PRESS_MS = 450;
const LONG_PRESS_MOVE_TOLERANCE = 12;

const readHereMenu = ref({ visible: false, x: 0, y: 0, chunkIdx: -1 });
let _longPressTimer = null;
let _longPressStart = null;

const readHereMenuStyle = computed(() => ({
  left: `${readHereMenu.value.x}px`,
  top: `${readHereMenu.value.y}px`,
}));

const hideReadHereMenu = () => {
  readHereMenu.value = { visible: false, x: 0, y: 0, chunkIdx: -1 };
};

const cancelLongPress = () => {
  if (_longPressTimer) clearTimeout(_longPressTimer);
  _longPressTimer = null;
  _longPressStart = null;
};

const triggerLongPress = (x, y) => {
  _longPressTimer = null;
  const chunkIdx = props.resolveChunkAtPoint ? props.resolveChunkAtPoint(x, y) : -1;
  if (chunkIdx == null || chunkIdx < 0) return;

  if (navigator.vibrate) navigator.vibrate(12);

  // Clamp the menu inside the viewport, floating just above the finger.
  const menuX = Math.max(12, Math.min(x - 82, window.innerWidth - 176));
  const menuY = Math.max(70, y - 64);
  readHereMenu.value = { visible: true, x: menuX, y: menuY, chunkIdx };

  // Fetch the audio while the user reads the menu so playback starts instantly.
  props.prewarmChunk?.(chunkIdx);
};

const onReadingTouchStart = (event) => {
  hideReadHereMenu();
  if (event.touches.length !== 1) return;
  const touch = event.touches[0];
  _longPressStart = { x: touch.clientX, y: touch.clientY };
  cancelLongPressTimerOnly();
  _longPressTimer = setTimeout(
    () => triggerLongPress(touch.clientX, touch.clientY),
    LONG_PRESS_MS,
  );
};

const cancelLongPressTimerOnly = () => {
  if (_longPressTimer) clearTimeout(_longPressTimer);
  _longPressTimer = null;
};

const onReadingTouchMove = (event) => {
  if (!_longPressStart) return;
  const touch = event.touches[0];
  const distance = Math.hypot(
    touch.clientX - _longPressStart.x,
    touch.clientY - _longPressStart.y,
  );
  if (distance > LONG_PRESS_MOVE_TOLERANCE) cancelLongPress();
};

const onReadingTouchEnd = () => {
  cancelLongPress();
};

const confirmReadHere = () => {
  const { chunkIdx } = readHereMenu.value;
  hideReadHereMenu();
  if (chunkIdx >= 0) emit("read-from-chunk", chunkIdx);
};

// ── Progressive section mounting ───────────────────────────────────────────
//
// Sections arrive as placeholders (html === null) until the page mounts them.
// When a placeholder gets near the viewport, ask the page to mount it now so
// fast scrolling never outruns the idle-time mounting.

let _placeholderObserver = null;

const observePlaceholders = async () => {
  if (typeof IntersectionObserver === "undefined") return;
  await nextTick();
  _placeholderObserver?.disconnect();
  const placeholders = document.querySelectorAll("[data-section-placeholder]");
  if (!placeholders.length) return;

  _placeholderObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const index = Number(entry.target.dataset.sectionPlaceholder);
      if (!Number.isNaN(index)) emit("mount-section", index);
      _placeholderObserver?.unobserve(entry.target);
    }
  }, { rootMargin: "1600px 0px" });

  placeholders.forEach((el) => _placeholderObserver.observe(el));
};

watch(
  () => props.chapterList,
  () => { observePlaceholders(); },
  { deep: false },
);

// ── Scroll-linked dock / bottom nav swap ───────────────────────────────────
//
// Direction changes reset the opposite travel counter, so tiny scroll jitter
// can't flip the dock state back and forth mid-animation.

const onScroll = () => {
  const nextY = window.scrollY || 0;
  const delta = nextY - lastScrollY;
  lastScrollY = Math.max(0, nextY);

  if (readHereMenu.value.visible) hideReadHereMenu();
  cancelLongPress();

  if (delta > 0) {
    downTravel += delta;
    upTravel = 0;
  } else if (delta < 0) {
    upTravel -= delta;
    downTravel = 0;
  }

  if (nextY < 64) {
    replaceBottomNav.value = false;
    return;
  }

  if (downTravel > 28) replaceBottomNav.value = true;
  else if (upTravel > 14) replaceBottomNav.value = false;
};

onMounted(() => {
  lastScrollY = window.scrollY || 0;
  window.addEventListener("scroll", onScroll, { passive: true });
  observePlaceholders();
});

onUnmounted(() => {
  window.removeEventListener("scroll", onScroll);
  cancelLongPress();
  _placeholderObserver?.disconnect();
});
</script>

<style scoped>
.reader-mobile-page {
  --mobile-reader-bg: #e8e8f2;
  --mobile-reader-text: #222431;
  --mobile-reader-muted: #6f7282;
  --dock-swap-duration: 0.32s;
  --dock-swap-ease: cubic-bezier(0.33, 1, 0.68, 1);
  --bottom-nav-space: calc(
    var(--mobile-bottom-nav-height, 72px) + env(safe-area-inset-bottom)
  );
  min-height: 100vh;
  background: var(--mobile-reader-bg);
  color: var(--mobile-reader-text);
  font-family: var(--mobile-font-family);
}

.reader-mobile-page.dark {
  --mobile-reader-bg: var(--color-reader-dark-background);
  --mobile-reader-text: var(--color-reader-dark-text);
  --mobile-reader-muted: var(--color-reader-dark-muted);
}

.reader-mobile-topbar {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 1150;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 88px;
  align-items: center;
  min-height: 52px;
  padding: env(safe-area-inset-top) 8px 0;
  background: var(--mobile-reader-bg);
}

.reader-mobile-topbar h1 {
  overflow: hidden;
  margin: 0;
  color: var(--mobile-reader-text);
  font-size: 17px;
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reader-top-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.reader-nav-btn {
  display: inline-grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--mobile-reader-text);
  cursor: pointer;
  font-size: 21px;
}

.reader-mobile-content {
  padding: calc(60px + env(safe-area-inset-top)) 20px 150px;
}

.reader-mobile-content.is-pdf-reader {
  padding: calc(60px + env(safe-area-inset-top)) 12px 150px;
}

.reader-mobile-pdf {
  width: 100%;
}

.reader-mobile-pdf :deep(.pdf-viewer) {
  max-width: 100%;
  gap: 2rem;
  overflow-x: hidden;
  padding: 0 0 2rem;
}

.reader-mobile-pdf :deep(.pdf-page-wrap) {
  max-width: 100%;
}

.reader-mobile-chapters {
  display: grid;
  gap: 0;
}

.reader-mobile-section {
  min-height: auto;
}

/* Unmounted chapters hold estimated space until the page mounts their HTML. */
.reader-section-placeholder {
  width: 100%;
}

.reader-mobile-text {
  color: var(--mobile-reader-text);
  font-size: 14.5px;
  line-height: 1.22;
  word-break: break-word;
  /* Long-press opens "Read from here" instead of native text selection. */
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

.reader-mobile-text :deep(p) {
  margin: 0 0 0.65rem;
}

.reader-mobile-text :deep(.tts-active) {
  border-radius: 3px;
  background: var(--color-reader-highlight);
  outline: 1px solid var(--color-reader-highlight-border);
}

.reader-mobile-text :deep(img) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 1rem auto;
}

.reader-mobile-cover {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
  min-height: 70vh;
  padding-top: 2rem;
  text-align: center;
}

.reader-mobile-cover img {
  width: min(58vw, 220px);
  border-radius: 6px;
  box-shadow: var(--shadow-cover);
}

.reader-mobile-cover h2,
.reader-mobile-cover p {
  margin: 0;
}

.reader-state {
  display: grid;
  min-height: 55vh;
  place-items: center;
  gap: 0.7rem;
  color: var(--mobile-reader-muted);
  text-align: center;
}

.reader-state i {
  font-size: 2rem;
}

.hint {
  margin: 0;
  font-size: 0.82rem;
  opacity: 0.75;
}

.read-here-menu {
  position: fixed;
  z-index: 1250;
  border-radius: 12px;
  background: var(--mobile-reader-text);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.32);
}

.read-here-menu button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 16px;
  border: 0;
  background: transparent;
  color: var(--mobile-reader-bg);
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
}

.read-here-menu i {
  font-size: 18px;
}

.read-here-enter-active,
.read-here-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.read-here-enter-from,
.read-here-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.96);
}

/*
 * Chapter dock / bottom nav swap.
 *
 * Both layers animate with transform only (no `bottom`/layout transitions) on
 * the same duration and curve, so the dock glides down into the exact space
 * the nav vacates — no gap and no compositor jank on mobile.
 */
.reader-chapter-dock {
  position: fixed;
  right: 0;
  bottom: var(--bottom-nav-space);
  left: 0;
  z-index: 1160;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  padding: 10px 82px 12px 20px;
  background: var(--mobile-reader-bg);
  box-shadow: 0 -8px 18px rgba(15, 23, 42, 0.04);
  transition: transform var(--dock-swap-duration) var(--dock-swap-ease);
  will-change: transform;
}

/* Drop by the nav's full visible height (keeping the safe-area inset) so the
   dock sits flush with the screen bottom — no leftover strip below the pill. */
.reader-mobile-page.replaceBottomNav .reader-chapter-dock {
  transform: translateY(calc(var(--bottom-nav-space) - env(safe-area-inset-bottom)));
}

.chapter-pill {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 44px;
  height: 42px;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 1px 5px rgba(15, 23, 42, 0.08);
  transition:
    background-color var(--dock-swap-duration) var(--dock-swap-ease),
    box-shadow var(--dock-swap-duration) var(--dock-swap-ease);
}

.chapter-pill-step,
.chapter-pill-title {
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--mobile-reader-text);
  cursor: pointer;
}

.chapter-pill-step {
  display: grid;
  place-items: center;
  font-size: 22px;
  opacity: 1;
  transition: opacity 0.2s ease;
}

.chapter-pill-title {
  overflow: hidden;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 650;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: font-size var(--dock-swap-duration) var(--dock-swap-ease);
}

.reader-mobile-page.replaceBottomNav .chapter-pill {
  background: transparent;
  box-shadow: none;
}

.reader-mobile-page.replaceBottomNav .chapter-pill-step {
  opacity: 0;
  pointer-events: none;
}

.reader-mobile-page.replaceBottomNav .chapter-pill-title {
  font-size: 15px;
}

.chapter-play {
  position: fixed;
  right: 20px;
  bottom: calc(var(--bottom-nav-space) + 10px);
  z-index: 1170;
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: #fff;
  color: var(--mobile-reader-text);
  cursor: pointer;
  font-size: 20px;
  box-shadow: 0 1px 5px rgba(15, 23, 42, 0.08);
}

/* The play button intentionally stays put while the dock drops into the nav
   space — it anchors the reading controls in a consistent corner. */
.reader-mobile-page.replaceBottomNav .chapter-play {
  bottom: calc(var(--bottom-nav-space) + 10px);
}

.mobile-bottom-nav-wrap :deep(.mobile-bottom-nav) {
  transition:
    transform var(--dock-swap-duration) var(--dock-swap-ease),
    opacity 0.22s ease;
  will-change: transform;
}

.reader-mobile-page.replaceBottomNav .mobile-bottom-nav-wrap :deep(.mobile-bottom-nav) {
  opacity: 0.4;
  pointer-events: none;
  transform: translateY(calc(100% + env(safe-area-inset-bottom)));
}

.reader-media-layer {
  position: fixed;
  inset: 0;
  z-index: 2200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.reader-media-backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(15, 23, 42, 0.12);
}

.reader-media-sheet {
  position: relative;
  width: 100%;
  min-height: 288px;
  padding: 10px 16px calc(22px + env(safe-area-inset-bottom));
  border-radius: 16px 16px 0 0;
  background: #f5f5fb;
  color: var(--mobile-reader-text);
  box-shadow: 0 -12px 34px rgba(15, 23, 42, 0.16);
  text-align: center;
}

.sheet-grabber {
  width: 32px;
  height: 4px;
  margin: 0 auto 16px;
  border-radius: 999px;
  background: #0d0d13;
}

.reader-media-sheet h2 {
  margin: 0 0 28px;
  font-size: 18px;
  font-weight: 500 !important;
}

.narrator-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 30px;
  margin-bottom: 14px;
  padding: 0 12px;
  border: 0;
  border-radius: 7px;
  background: #e1e2ef;
  color: #4b4f63;
  cursor: pointer;
  font-size: 13px;
  transition: background-color 0.15s ease;
}

.narrator-btn.open {
  background: #d3d5e8;
}

.voice-list {
  display: grid;
  gap: 2px;
  max-height: 210px;
  margin: 0 auto 16px;
  padding: 6px;
  overflow-y: auto;
  width: min(100%, 320px);
  border-radius: 10px;
  background: #ececf5;
}

.voice-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #1f2230;
  cursor: pointer;
  font-size: 14px;
}

.voice-option.active {
  background: #fff;
  color: var(--color-brand-primary);
  font-weight: 600;
}

.voice-option i {
  font-size: 16px;
}

.media-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 30px;
  margin-bottom: 24px;
}

.media-buttons button {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #02030a;
  cursor: pointer;
  font-size: 24px;
}

.media-buttons .media-play {
  font-size: 36px;
}

.media-progress-row {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 42px;
  gap: 12px;
  align-items: center;
  color: #1f2230;
  font-size: 13px;
}

.media-progress-row input {
  width: 100%;
  accent-color: var(--color-brand-primary);
}

.speed-btn {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  margin-top: 8px;
  padding: 0 12px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #1f2230;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500 !important;
}

.speed-btn:active {
  background: #e1e2ef;
}
</style>
