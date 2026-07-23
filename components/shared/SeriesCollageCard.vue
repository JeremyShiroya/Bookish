<template>
  <button
    class="series-card"
    :class="[`layout-${layout}`, `bg-${background}`, { selectable, selected }]"
    type="button"
    @click="onCardClick"
    @contextmenu.prevent="$emit('contextmenu', $event)"
  >
    <!-- Selection mode marker. A card that is one big <button> cannot nest
         another, so this is a span the card's own click drives. -->
    <span
      v-if="selectable"
      class="select-tick"
      role="checkbox"
      :aria-checked="selected"
      aria-hidden="false"
    >
      <i v-if="selected" class="ri-check-line"></i>
    </span>
    <!-- Optional blurred cover-image background. Uses a real <img> (the same
         technique as the series-detail hero backdrop) rather than a CSS
         background-image, so device/blob cover URLs render and a dead cover
         degrades to the branded placeholder via onCoverError. -->
    <template v-if="background === 'blur' && coverStack.length">
      <span class="card-bg" aria-hidden="true">
        <img :src="coverStack[0]" alt="" @error="onCoverError($event, series.name)" />
      </span>
      <span class="card-bg-overlay" aria-hidden="true"></span>
    </template>

    <!-- Playlist-style layout: name top-left, angled covers bottom-right,
         count badge bottom-left. -->
    <template v-if="layout === 'cover'">
      <span class="pl-name">{{ series.name }}</span>

      <span class="pl-covers" aria-hidden="true">
        <img
          v-if="coverStack[1]"
          class="pl-cover pl-cover--back"
          :src="coverStack[1]"
          alt=""
          @error="onCoverError($event, series.name)"
        />
        <img
          v-if="coverStack[0]"
          class="pl-cover pl-cover--front"
          :src="coverStack[0]"
          alt=""
          @error="onCoverError($event, series.name)"
        />
        <span v-if="!coverStack.length" class="pl-empty"><i class="ri-book-shelf-line"></i></span>
      </span>

      <span class="pl-badge">
        <i class="ri-book-shelf-line"></i>
        {{ countLabel }}
      </span>
    </template>

    <!-- Fan layout: the classic centred, fanned stack. -->
    <template v-else>
      <span class="series-meta">
        <span class="series-name">{{ series.name }}</span>
        <span class="series-count">{{ countLabel }}</span>
      </span>

      <span class="series-fan" aria-hidden="true">
        <img
          v-for="(cover, i) in coverStack"
          :key="i"
          class="fan-cover"
          :src="cover"
          :style="fanStyle(i, coverStack.length)"
          alt=""
          @error="onCoverError($event, series.name)"
        />
        <span v-if="coverStack.length === 0" class="fan-empty">
          <i class="ri-book-shelf-line"></i>
        </span>
      </span>
    </template>
  </button>
</template>

<script setup>
import { computed } from "vue";
import { useBookishSettings } from "~/composables/useBookishSettings";
import { onCoverError } from "~/composables/useCoverFallback";

const props = defineProps({
  series: { type: Object, required: true },
  // 'series' reads the series-card preferences; 'playlist' reads the (identical)
  // playlist-card preferences and shows a plain book count. The card is
  // otherwise the same, so series and playlists stay visually in lockstep.
  variant: { type: String, default: "series" },
  // Multi-select, driven by the page that owns the grid.
  selectable: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
});

const emit = defineEmits(["open", "contextmenu", "toggle-select"]);

// While selecting, a tap picks the card instead of opening it.
const onCardClick = () => {
  if (props.selectable) emit("toggle-select", props.series);
  else emit("open", props.series);
};

const { settings } = useBookishSettings();
const isPlaylist = computed(() => props.variant === "playlist");
const layout = computed(() =>
  (isPlaylist.value ? settings.value.playlistCardLayout : settings.value.seriesCardLayout) || "fan",
);
const background = computed(() =>
  (isPlaylist.value ? settings.value.playlistCardBackground : settings.value.seriesCardBackground) || "blank",
);

const bookCount = computed(() => props.series.books?.length || 0);

const highestBookTotal = computed(() => {
  const totals = (props.series.books || [])
    .map((book) => Number(book?.seriesTotal || 0))
    .filter((total) => Number.isFinite(total) && total > 0);
  return totals.length ? Math.max(...totals) : 0;
});

const totalCount = computed(() =>
  Number(
    props.series.totalBooks ||
    props.series.seriesTotal ||
    highestBookTotal.value
  ) || Math.max(bookCount.value, 1)
);

const collectedCount = computed(() => Math.min(bookCount.value, totalCount.value));

// Series know their total ("2/6 Books"); a playlist is just a bag of books, so
// it shows a plain count driven by the playlist's real size.
const countLabel = computed(() => {
  if (isPlaylist.value) {
    const count = Number(props.series.bookCount ?? bookCount.value) || 0;
    return `${count} ${count === 1 ? "Book" : "Books"}`;
  }
  return `${collectedCount.value}/${totalCount.value} Books`;
});

// Order the books by series installment INSIDE the card, so the fan order and
// the blurred-cover background (coverStack[0]) are identical everywhere. Home
// passed the raw series order while the Series page pre-sorted, so the same
// series showed a different first cover — and therefore a different background
// — on the two pages.
const orderedBooks = computed(() => {
  const books = [...(props.series.books || [])];
  return books.sort((a, b) => {
    const ai = Number(a?.seriesInstallment);
    const bi = Number(b?.seriesInstallment);
    const aHas = Number.isFinite(ai);
    const bHas = Number.isFinite(bi);
    if (aHas && bHas && ai !== bi) return ai - bi;
    if (aHas !== bHas) return aHas ? -1 : 1;            // numbered first
    return String(a?.title || "").localeCompare(String(b?.title || ""));
  });
});

const coverStack = computed(() =>
  orderedBooks.value
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
  border-radius: var(--mobile-card-radius);
  background: #e8e8f1;
  box-shadow: var(--mobile-card-shadow);
  cursor: pointer;
  text-align: left;
  transition: transform 0.28s ease, box-shadow 0.28s ease;
}

/* Dark mode keeps the card on the themed dark surface. */
:root[data-theme="dark"] .series-card {
  background: var(--color-surface-primary);
}

.series-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 26px 52px rgba(15, 23, 42, 0.18);
}

/* ── Blurred cover-image background (series-detail hero technique) ─────────── */
.card-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
}

.card-bg img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(25px) saturate(150%);
  transform: scale(1.35);
}

.card-bg-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: var(--gradient-image-card-overlay);
}

/* ── Fan layout ───────────────────────────────────────────────────────────── */
.series-meta {
  position: absolute;
  top: 20px;
  right: 16px;
  left: 16px;
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
  font-size: var(--mobile-body-size);
  font-weight: 400 !important;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.series-count {
  color: var(--color-text-muted);
  font-size: var(--mobile-subtext-size);
  line-height: 1.2;
}

/* On a blur background the text sits over imagery — go white with a shadow. */
.bg-blur .series-name {
  color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.55);
}

.bg-blur .series-count {
  color: rgba(255, 255, 255, 0.82);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}

.series-fan {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 5;
  height: 132px;
  transform-origin: center bottom;
  transition: transform 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}

.series-card:hover .series-fan {
  transform: scale(1.05) translateY(-6px);
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

/* ── Playlist-style ("cover") layout ──────────────────────────────────────── */
.pl-name {
  position: absolute;
  top: 1.7rem;
  left: 1rem;
  right: 48%;
  z-index: 3;
  color: var(--color-text-primary);
  font-size: 1.12rem;
  font-weight: 600 !important;
  line-height: 1.25;
  word-break: break-word;
  hyphens: auto;
}

.bg-blur .pl-name {
  color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.55), 0 1px 2px rgba(0, 0, 0, 0.4);
}

.pl-covers {
  position: absolute;
  right: -4px;
  bottom: -8px;
  z-index: 3;
  width: 55%;
  height: 95%;
  pointer-events: none;
}

.pl-cover {
  position: absolute;
  right: 0;
  bottom: 0;
  height: 90%;
  aspect-ratio: 2 / 3;
  border-radius: 5px;
  object-fit: cover;
  box-shadow: -4px 4px 20px rgba(0, 0, 0, 0.45);
}

.pl-cover--front {
  right: 14%;
  z-index: 2;
  transform: rotate(15deg);
}

.pl-cover--back {
  right: -2%;
  z-index: 1;
  opacity: 0.85;
  transform: rotate(28deg);
}

.pl-empty {
  position: absolute;
  right: 12%;
  bottom: 6%;
  display: grid;
  width: 70px;
  height: 105px;
  place-items: center;
  border-radius: 6px;
  background: var(--color-brand-primary-soft);
  color: var(--color-brand-primary);
  font-size: 2rem;
}

.pl-badge {
  position: absolute;
  bottom: 12px;
  left: 12px;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.24rem 0.68rem;
  border-radius: 999px;
  border: 1px solid var(--color-border-card);
  background: var(--color-surface-secondary);
  color: var(--color-text-secondary);
  font-size: 0.72rem;
  font-weight: 500;
  white-space: nowrap;
}

.pl-badge i {
  font-size: 0.82rem;
}

/* On a blur background the badge becomes the glassy playlist pill. */
.bg-blur .pl-badge {
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

@media (max-width: 380px) {
  .series-card {
    height: 190px;
  }

  .series-count {
    font-size: var(--mobile-caption-size);
  }

  .fan-cover {
    width: 104px;
    height: 152px;
  }
}

/* Selection mode. The ring is drawn inside the card so it survives whichever
   layout and background the card preferences are set to. */
.series-card.selected {
  box-shadow: 0 0 0 2px var(--color-brand-primary) inset;
}

.select-tick {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 4;
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 2px solid var(--color-brand-primary);
  border-radius: 50%;
  background: var(--color-surface-primary);
  color: var(--color-text-on-brand);
  font-size: 14px;
  line-height: 1;
}

.series-card.selected .select-tick {
  background: var(--color-brand-primary);
}
</style>
