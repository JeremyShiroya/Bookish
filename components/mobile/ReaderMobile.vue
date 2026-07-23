<template>
  <div
    :ref="setReaderPage"
    class="reader-mobile-page"
    :class="[readerTheme, {
      sepia: prefs.background === 'sepia',
      'listen-blur': readerMode === 'listen' && listenBlurEnabled,
    }]"
    :style="readerStyleVars"
  >
    <header v-show="!chromeHidden" class="reader-mobile-topbar">
      <button
        type="button"
        class="reader-nav-btn"
        aria-label="Back"
        @click="$emit('back')"
      >
        <i class="ri-arrow-left-s-line"></i>
      </button>

      <div class="reader-mode-toggle" role="tablist" aria-label="Reader mode">
        <button
          type="button"
          role="tab"
          :aria-selected="readerMode === 'listen'"
          :class="{ active: readerMode === 'listen' }"
          @click="setReaderMode('listen')"
        >
          Listen
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="readerMode === 'read'"
          :class="{ active: readerMode === 'read' }"
          @click="setReaderMode('read')"
        >
          Read
        </button>
      </div>

      <!-- Both controls belong to reading. Listen mode already has the whole
           player on screen (speed, narrator, seek) and has no text to typeset,
           so its top-right corner stays empty. -->
      <div v-if="readerMode !== 'listen'" class="reader-top-actions">
        <button
          type="button"
          class="reader-nav-btn"
          aria-label="Audio and voice options"
          @click="mediaOpen = true"
        >
          <i class="ri-headphone-fill"></i>
        </button>
        <button
          type="button"
          class="reader-nav-btn"
          aria-label="Display settings"
          @click="displayOpen = true"
        >
          <i class="ri-equalizer-line"></i>
        </button>
      </div>
      <div v-else class="reader-top-actions"></div>
    </header>

    <div
      v-if="readerMode === 'listen'"
      class="reader-listen-view"
      :class="{ 'bg-blur': listenBlurEnabled }"
    >
      <template v-if="book">
        <div v-if="listenBlurEnabled" class="listen-bg" aria-hidden="true">
          <img :src="book.cover" alt="" @error="onCoverError($event, book.title)" />
          <div class="listen-bg-overlay"></div>
        </div>
        <div class="listen-cover">
          <img
            :src="book.cover"
            :alt="`${book.title} cover`"
            @error="onCoverError($event, book.title)"
          />
        </div>
        <h2 class="listen-title">{{ book.title }}</h2>
        <p class="listen-byline">{{ listenByline }}</p>

        <div class="listen-progress">
          <span>{{ listenElapsed }}</span>
          <input
            type="range"
            min="0"
            max="100"
            :value="listenProgress"
            :style="{ '--fill': `${listenProgress}%` }"
            aria-label="Audio progress"
            @input="seekToProgress(Number($event.target.value))"
          />
          <span>{{ listenTotal }}</span>
        </div>

        <div class="listen-controls">
          <button
            type="button"
            class="listen-aux"
            aria-label="Playback speed"
            @click="cycleSpeed"
          >
            {{ speedLabel }}
          </button>
          <button type="button" class="listen-skip" aria-label="Back 10 seconds" @click="skipSeconds(-10)">
            <i class="ri-replay-10-line"></i>
          </button>
          <button
            type="button"
            class="listen-play"
            aria-label="Play or pause"
            @click="toggleListenPlay"
          >
            <i :class="isPlaying ? 'ri-pause-fill' : 'ri-play-fill'"></i>
          </button>
          <button type="button" class="listen-skip" aria-label="Forward 10 seconds" @click="skipSeconds(10)">
            <i class="ri-forward-10-line"></i>
          </button>
          <button
            type="button"
            class="listen-aux"
            aria-label="Choose narrator"
            @click="narratorOpen = true"
          >
            <i class="ri-speak-line"></i>
          </button>
        </div>

        <div class="listen-page-nav">
          <button
            type="button"
            class="listen-page-step prev"
            :disabled="!listenPrevLabel"
            @click="stepListenPage(-1)"
          >
            <i class="ri-arrow-left-s-line"></i>
            {{ listenPrevLabel }}
          </button>
          <span class="listen-page-current">{{ listenCurrentLabel }}</span>
          <button
            type="button"
            class="listen-page-step next"
            :disabled="!listenNextLabel"
            @click="stepListenPage(1)"
          >
            {{ listenNextLabel }}
            <i class="ri-arrow-right-s-line"></i>
          </button>
        </div>

        <div class="listen-text">
          <p v-if="listenChunks.length" class="listen-text-inner" :style="listenTextStyle">
            <span
              v-for="(chunk, index) in listenChunks"
              :key="`${listenStartChunk}-${index}`"
              :ref="(el) => setListenChunkEl(index, el)"
              class="listen-chunk"
              :class="{ active: listenStartChunk + index === activeListenChunk }"
            >{{ chunk }} </span>
          </p>
          <p v-else class="listen-text-empty">
            No readable text on this {{ isPdfBook ? "page" : "chapter" }}.
          </p>
        </div>
      </template>
    </div>

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
        <div
          v-if="isPdfRenderable"
          class="reader-mobile-pdf"
          @touchend="onSelectionSettled"
          @mouseup="onSelectionSettled"
          @contextmenu.prevent
        >
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
            Re-upload the PDF once so Pages can display the document exactly
            as it is.
          </p>
        </div>

        <ReaderPagedEpub
          v-else-if="usePagedReader"
          ref="pagedRef"
          :book-id="book.id"
          :sections="fullSections"
          :sanitize-html="sanitizeHtml"
          :readable-chunks="readableChunks"
          :section-counts="sectionCounts"
          :active-chunk-index="activeTtsChunkIndex"
          :highlight-enabled="true"
          :geometry="pageGeometry"
          :layout-hash="layoutHash"
          :start-section="currentChapterIdx"
          @position-change="onPagedPosition"
          @long-press="onPagedLongPress"
          @toggle-chrome="toggleChrome"
          @selection-settled="onSelectionSettled"
          @annotation-tap="onAnnotationTap"
          @section-rendered="repaintAnnotations"
        />

        <div
          v-else
          class="reader-mobile-chapters"
          :ref="setChaptersContainer"
          @touchend="onSelectionSettled"
          @mouseup="onSelectionSettled"
          @click="onScrollTap"
          @contextmenu.prevent
        >
          <section v-if="hasCover" id="ch-cover" class="reader-mobile-cover">
            <img :src="book.cover" :alt="`${book.title} cover`" @error="onCoverError($event, book.title)" />
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
              :style="{ height: `${placeholderHeight(index, chapter)}px` }"
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

    <!-- Resuming after turning to a different page: ask rather than guess. -->
    <div v-if="resumeChoice.visible" class="resume-overlay" role="presentation" @click="closeResumeChoice">
      <section
        class="resume-sheet"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="resume-title"
        @click.stop
      >
        <span class="sheet-grabber" aria-hidden="true"></span>
        <h2 id="resume-title">You've moved to a different page</h2>
        <p>Where would you like the narration to continue from?</p>
        <div class="resume-actions">
          <button type="button" class="resume-primary" @click="playFromShownPage">
            <i class="ri-play-circle-line"></i>
            Read from this page
          </button>
          <button type="button" class="resume-secondary" @click="resumeWhereLeftOff">
            <i class="ri-history-line"></i>
            Continue where I left off
          </button>
        </div>
      </section>
    </div>

    <ReaderSelectionMenu
      v-if="selectionMenu.visible"
      :x="selectionMenu.x"
      :y="selectionMenu.y"
      :active-color="selectionMenu.color"
      :can-remove="!!selectionMenu.existingId"
      :has-note="selectionMenu.hasNote"
      :start-on-colors="selectionMenu.startOnColors"
      @read="selectionRead"
      @copy="selectionCopy"
      @highlight="selectionHighlight"
      @dictionary="selectionDictionary"
      @note="openNoteEditor()"
      @remove="selectionRemove"
    />

    <ReaderNoteEditor
      v-if="noteEditor.visible"
      :quote="noteEditor.quote"
      :initial="noteEditor.initial"
      :existing="!!noteEditor.id"
      @close="closeNoteEditor"
      @save="saveNote"
      @delete="deleteNote"
    />

    <div v-show="readerMode === 'read' && !chromeHidden" class="reader-chapter-dock">
      <div class="chapter-pill">
        <button
          type="button"
          class="chapter-pill-step step-prev"
          aria-label="Previous page"
          @click="dockStep(-1)"
        >
          <i class="ri-arrow-left-s-line"></i>
        </button>
        <button
          type="button"
          class="chapter-pill-title"
          aria-label="Table of contents"
          @click="tocModalOpen = true"
        >
          {{ dockLabel }}
        </button>
        <button
          type="button"
          class="chapter-pill-step step-next"
          aria-label="Next page"
          @click="dockStep(1)"
        >
          <i class="ri-arrow-right-s-line"></i>
        </button>
      </div>
    </div>

    <button
      v-show="readerMode === 'read' && !chromeHidden"
      type="button"
      class="chapter-play"
      aria-label="Play chapter"
      @click="playFromHere"
    >
      <i :class="isPlaying ? 'ri-pause-fill' : 'ri-play-fill'"></i>
    </button>

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
          :class="readerTheme"
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
              v-for="voice in displayVoices"
              :key="voice.id"
              type="button"
              class="voice-option"
              :class="{ active: voice.id === activeVoiceId }"
              role="option"
              :aria-selected="voice.id === activeVoiceId"
              @click="chooseVoice(voice.id)"
            >
              <span>{{ voice.name }}</span>
              <i v-if="voice.id === activeVoiceId" class="ri-check-line"></i>
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
              :style="{ '--fill': `${ttsProgress || 0}%` }"
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

    <Teleport to="body">
      <div v-if="displayOpen" class="reader-media-layer">
        <button
          class="reader-media-backdrop"
          type="button"
          aria-label="Close display settings"
          @click="displayOpen = false"
        ></button>
        <section
          class="reader-media-sheet reader-display-sheet"
          :class="readerTheme"
          role="dialog"
          aria-modal="true"
          aria-label="Display settings"
        >
          <div class="sheet-grabber"></div>
          <h2>Display</h2>

          <template v-if="!isPdfBook">
            <div class="display-row">
              <span class="display-label">Reading mode</span>
              <div class="seg-group">
                <button
                  v-for="mode in ['page', 'scroll']"
                  :key="mode"
                  type="button"
                  class="seg-btn"
                  :class="{ active: prefs.readingMode === mode }"
                  @click="updatePrefs({ readingMode: mode })"
                >
                  {{ mode === 'page' ? 'Pages' : 'Scroll' }}
                </button>
              </div>
            </div>

            <div class="display-row">
              <span class="display-label">Background</span>
              <div class="seg-group">
                <button
                  type="button"
                  class="seg-btn"
                  :class="{ active: prefs.background === 'default' }"
                  @click="updatePrefs({ background: 'default' })"
                >
                  Default
                </button>
                <button
                  type="button"
                  class="seg-btn seg-sepia"
                  :class="{ active: prefs.background === 'sepia' }"
                  @click="updatePrefs({ background: 'sepia' })"
                >
                  Book brown
                </button>
              </div>
            </div>

            <div class="display-row">
              <span class="display-label">Font size</span>
              <div class="size-stepper">
                <button type="button" aria-label="Smaller text" @click="stepFontSize(-1)">A−</button>
                <span>{{ prefs.fontSize }}</span>
                <button type="button" aria-label="Larger text" @click="stepFontSize(1)">A+</button>
              </div>
            </div>

            <div class="display-row">
              <span class="display-label">Font</span>
              <div class="seg-group">
                <button
                  v-for="font in fontOptions"
                  :key="font.id"
                  type="button"
                  class="seg-btn"
                  :class="{ active: prefs.fontFamily === font.id }"
                  @click="updatePrefs({ fontFamily: font.id })"
                >
                  {{ font.label }}
                </button>
              </div>
            </div>

            <div class="display-row">
              <span class="display-label">Thickness</span>
              <div class="seg-group">
                <button
                  v-for="weight in weightOptions"
                  :key="weight.id"
                  type="button"
                  class="seg-btn"
                  :class="{ active: prefs.fontWeight === weight.id }"
                  @click="updatePrefs({ fontWeight: weight.id })"
                >
                  {{ weight.label }}
                </button>
              </div>
            </div>

            <div class="display-row">
              <span class="display-label">Line spacing</span>
              <div class="seg-group">
                <button
                  v-for="spacing in lineSpacingOptions"
                  :key="spacing"
                  type="button"
                  class="seg-btn"
                  :class="{ active: prefs.lineSpacing === spacing }"
                  @click="updatePrefs({ lineSpacing: spacing })"
                >
                  {{ spacing }}
                </button>
              </div>
            </div>

            <div class="display-row">
              <span class="display-label">Alignment</span>
              <div class="seg-group">
                <button
                  type="button"
                  class="seg-btn"
                  :class="{ active: prefs.textAlign === 'justify' }"
                  @click="updatePrefs({ textAlign: 'justify' })"
                >
                  Justify
                </button>
                <button
                  type="button"
                  class="seg-btn"
                  :class="{ active: prefs.textAlign === 'left' }"
                  @click="updatePrefs({ textAlign: 'left' })"
                >
                  Left
                </button>
              </div>
            </div>
          </template>

          <p v-else class="display-pdf-note">
            Display settings apply to EPUB books. PDF pages render exactly as
            published.
          </p>
        </section>
      </div>
    </Teleport>

    <!-- Narrator picker (opened from the Listen controls) -->
    <Teleport to="body">
      <div v-if="narratorOpen" class="reader-media-layer">
        <button
          class="reader-media-backdrop"
          type="button"
          aria-label="Close narrator picker"
          @click="narratorOpen = false"
        ></button>
        <section
          class="reader-media-sheet reader-narrator-sheet"
          :class="readerTheme"
          role="dialog"
          aria-modal="true"
          aria-label="Choose narrator"
        >
          <div class="sheet-grabber"></div>
          <h2>Narrator</h2>

          <div class="voice-list" role="listbox" aria-label="Narrator voices">
            <button
              v-for="voice in displayVoices"
              :key="voice.id"
              type="button"
              class="voice-option"
              :class="{ active: voice.id === activeVoiceId }"
              role="option"
              :aria-selected="voice.id === activeVoiceId"
              @click="chooseNarrator(voice.id)"
            >
              <span>{{ voice.name }}</span>
              <i v-if="voice.id === activeVoiceId" class="ri-check-line"></i>
            </button>
          </div>
        </section>
      </div>
    </Teleport>

    <!-- Table of contents: tap the chapter pill to jump anywhere in the book. -->
    <Teleport to="body">
      <div v-if="tocModalOpen" class="reader-media-layer">
        <button
          class="reader-media-backdrop"
          type="button"
          aria-label="Close contents"
          @click="tocModalOpen = false"
        ></button>
        <section
          class="reader-media-sheet reader-toc-sheet"
          :class="readerTheme"
          role="dialog"
          aria-modal="true"
          aria-label="Table of contents"
        >
          <div class="sheet-grabber"></div>
          <h2>Contents</h2>

          <div v-if="tocItems.length" class="toc-list" role="listbox" aria-label="Chapters">
            <button
              v-for="(item, i) in tocItems"
              :key="`${item.type || 'chapter'}-${item.page ?? item.index}-${i}`"
              type="button"
              class="toc-item"
              :class="{ active: isTocItemActive(item) }"
              role="option"
              :aria-selected="isTocItemActive(item)"
              @click="chooseTocItem(item)"
            >
              <span class="toc-item-title">{{ item.title }}</span>
              <i v-if="isTocItemActive(item)" class="ri-check-line"></i>
            </button>
          </div>
          <p v-else class="toc-empty">This book has no table of contents.</p>
        </section>
      </div>
    </Teleport>

    <!-- Offscreen page-map measurer: lays out one section at a time with the
         exact reader geometry so global page numbers match the visible pages. -->
    <div v-if="!isPdfBook" class="page-map-measurer" aria-hidden="true">
      <div ref="measureHostRef" class="paged-viewport">
        <div ref="measureContentRef" class="paged-content paged-text" :style="measureStyle"></div>
      </div>
      <!-- Single-column measurer for the SCROLL reader: gives each section its
           real rendered height so placeholders reserve exact space and a fast
           fling can't reveal an un-sized gap. -->
      <div
        ref="heightMeasureRef"
        class="scroll-height-measurer reader-mobile-text epub-content"
        :style="heightMeasureStyle"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { onCoverError } from "~/composables/useCoverFallback";
import { shouldAskWhereToResume } from "~/composables/useResumePrompt";
import { firstChunkForPage, pageForChunk } from "~/composables/usePdfManifest";
import PdfViewer from "~/components/shared/PdfViewer.vue";
import SkeletonLoader from "~/components/shared/SkeletonLoader.vue";
import { useTTS } from "~/composables/useTTS";
import { isNativeCapacitorPlatform } from "~/composables/useNativePlatform";
import { useBookishSettings } from "~/composables/useBookishSettings";
import { mapSectionChunks } from "~/composables/useChunkSpans";
import {
  READER_FONT_OPTIONS,
  READER_FONT_SIZE_MAX,
  READER_FONT_SIZE_MIN,
  READER_LINE_SPACING_OPTIONS,
  READER_WEIGHT_OPTIONS,
  readerFontStack,
  readerPrefsLayoutHash,
  useMobileReaderPrefs,
} from "~/composables/useMobileReaderPrefs";
import {
  firstChunkOnPage,
  globalPageFor,
  locateGlobalPage,
  pageMapCacheKey,
  readPageMapCache,
  totalPagesInMap,
  writePageMapCache,
} from "~/composables/useEpubPageMap";
import { useToast } from "~/composables/useToast";
import {
  anchorFromSelection,
  clearAnnotationMarks,
  deleteAnnotation,
  loadAnnotations,
  paintAnnotations,
  saveAnnotation,
  useAnnotations,
} from "~/composables/useAnnotations";
import ReaderPagedEpub from "./ReaderPagedEpub.vue";
import ReaderNoteEditor from "./ReaderNoteEditor.vue";
import ReaderSelectionMenu from "./ReaderSelectionMenu.vue";

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
  // Flat readable-chunk texts (TTS playback order) + per-section counts, so the
  // Listen view can show the sentences of the page/chapter being narrated.
  readableChunks: { type: Array, default: () => [] },
  sectionCounts: { type: Array, default: () => [] },
  // Complete section list ({ title, html }) for the paged renderer and the
  // page-map measurer — unlike chapterList, never windowed to placeholders.
  fullSections: { type: Array, default: () => [] },
  // Table-of-contents entries for the jump modal. EPUB: { title, index }.
  // PDF: { title, page, type: 'pdf' }.
  tocItems: { type: Array, default: () => [] },
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
  "position-change",
  "go-to-section",
  "jump-to-toc",
]);

const route = useRoute();

const {
  ttsBook,
  ttsStatus,
  ttsProgress,
  ttsSpeed,
  ttsVoices,
  ttsVoiceId,
  ttsNativeVoices,
  ttsNativeVoiceIdx,
  ttsUsingDeviceVoice,
  ttsPlayingChunkIdx,
  elapsedTime,
  totalTime,
  togglePlay,
  skipChunks,
  skipSeconds,
  seekToProgress,
  seekToChunk,
  setSpeed,
  setVoice,
  loadDeviceVoices,
  setNativeVoice,
} = useTTS();

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

const mediaOpen = ref(false);
const displayOpen = ref(false);
const voicePickerOpen = ref(false);
const narratorOpen = ref(false);
const tocModalOpen = ref(false);

// ── Table of contents ───────────────────────────────────────────────────────
// The active entry is the last chapter/page at or before the reading position.
const activeTocChapter = computed(() => {
  let active = -1;
  for (const item of props.tocItems) {
    if (item.type === "pdf") continue;
    if (Number(item.index) <= props.currentChapterIdx) active = Number(item.index);
    else break;
  }
  return active;
});

const isTocItemActive = (item) => {
  if (item.type === "pdf") return props.currentPdfPage === item.page;
  return Number(item.index) === activeTocChapter.value;
};

const chooseTocItem = (item) => {
  tocModalOpen.value = false;
  emit("jump-to-toc", item);
};
const isOffline = ref(false);

// ── Display preferences + paged reading (ReadEra-style) ─────────────────────

const { prefs, updatePrefs } = useMobileReaderPrefs();
const fontOptions = READER_FONT_OPTIONS;
const weightOptions = READER_WEIGHT_OPTIONS;
const lineSpacingOptions = READER_LINE_SPACING_OPTIONS;

const stepFontSize = (delta) => {
  updatePrefs({
    fontSize: Math.max(
      READER_FONT_SIZE_MIN,
      Math.min(READER_FONT_SIZE_MAX, prefs.value.fontSize + delta),
    ),
  });
};

const usePagedReader = computed(() => !props.isPdfBook && prefs.value.readingMode === "page");
const layoutHash = computed(() => readerPrefsLayoutHash(prefs.value));

const readerStyleVars = computed(() => ({
  "--mr-font-size": `${prefs.value.fontSize}px`,
  "--mr-font-family": readerFontStack(prefs.value.fontFamily),
  "--mr-font-weight": String(prefs.value.fontWeight),
  "--mr-line-height": String(prefs.value.lineSpacing),
  "--mr-text-align": prefs.value.textAlign,
}));

const pagedRef = ref(null);
const pagedPos = ref({ section: 0, pageInSection: 0, sectionPages: 1 });

const onPagedPosition = (pos) => {
  pagedPos.value = pos;
  hideSelectionMenu();
  emit("position-change", pos);
};

// The paged reader still reports its own long-press, but the browser now owns
// selection there too — this only pre-warms the audio for the sentence under
// the finger so "Read from here" is instant if the user picks it.
const onPagedLongPress = ({ chunkIdx }) => {
  props.prewarmChunk?.(chunkIdx);
};

// TOC / parent navigation lands here as a currentChapterIdx change.
watch(() => props.currentChapterIdx, (idx) => {
  if (!usePagedReader.value || !Number.isFinite(idx)) return;
  if (idx !== pagedPos.value.section) pagedRef.value?.goToSection(idx);
});

// ── Page geometry (shared by the visible pages and the offscreen measurer) ──

const measureHostRef = ref(null);
const measureContentRef = ref(null);
const heightMeasureRef = ref(null);

// The scroll reader lays text out at the full content width (no columns), so the
// height measurer matches that width and the reader's typography.
const heightMeasureStyle = computed(() => ({
  width: `${pageGeometry.value.width}px`,
}));
const pageGeometry = ref({ width: 320, height: 480, gap: 40 });

const measureStyle = computed(() => ({
  columnWidth: `${pageGeometry.value.width}px`,
  columnGap: `${pageGeometry.value.gap}px`,
}));

const updatePageGeometry = () => {
  const host = measureHostRef.value;
  if (!host) return;
  const width = Math.max(120, Math.floor(host.clientWidth));
  const height = Math.max(160, Math.floor(host.clientHeight));
  if (width !== pageGeometry.value.width || height !== pageGeometry.value.height) {
    pageGeometry.value = { width, height, gap: 40 };
  }
};

// ── Whole-book page map ─────────────────────────────────────────────────────
//
// Measured offscreen, one section per idle slice, with the exact reader
// geometry — so "Page 214" is a real page, not an estimate. Cached per
// book + viewport + typography; reopening a book is instant.

const pageMap = ref(null);
let _pageMapToken = 0;

// How often the in-progress page map is published to the template. See the
// publish site in buildPageMap for why this isn't every section.
const PAGE_MAP_PUBLISH_EVERY = 8;

// One slice of the measurer lays out an entire chapter twice and then forces
// layout to read it back — hundreds of milliseconds of blocking main thread on
// a long book. requestIdleCallback's `timeout` makes the browser run it even
// when the thread is busy, and "busy" is precisely when the reader is being
// scrolled, long-pressed or tapped. So measuring stands down while the reader
// is under the finger, and for a beat afterwards.
//
// This is what made the reader feel like it was hanging: nothing was stuck, the
// measurer was simply taking the thread back every half second.
const INTERACTION_QUIET_MS = 700;
let _lastInteractionAt = 0;

const noteInteraction = () => {
  _lastInteractionAt = Date.now();
};

const _idleSlice = () => new Promise((resolve) => {
  const run = () => {
    const quietFor = Date.now() - _lastInteractionAt;
    if (quietFor < INTERACTION_QUIET_MS) {
      setTimeout(run, INTERACTION_QUIET_MS - quietFor);
      return;
    }
    resolve();
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: 1200 });
  } else {
    setTimeout(run, 40);
  }
});

const buildPageMap = async () => {
  const token = ++_pageMapToken;
  pageMap.value = null;
  if (props.isPdfBook || !import.meta.client) return;
  const sections = props.fullSections || [];
  if (!sections.length || !props.book?.id) return;
  const { width, height, gap } = pageGeometry.value;
  if (width < 140 || height < 200) return;

  const key = pageMapCacheKey(props.book.id, {
    width,
    height,
    layoutHash: layoutHash.value,
    sectionCount: sections.length,
  });
  const cached = readPageMapCache(key);
  if (cached) {
    pageMap.value = cached;
    return;
  }

  const el = measureContentRef.value;
  const heightEl = heightMeasureRef.value;
  if (!el) return;

  const counts = [];
  const heights = new Array(sections.length).fill(0);
  const chunkPages = new Array((props.readableChunks || []).length).fill(null);
  const stride = width + gap;
  let base = 0;

  for (let index = 0; index < sections.length; index += 1) {
    await _idleSlice();
    if (token !== _pageMapToken) return;

    const html = props.sanitizeHtml(sections[index]?.html || "");
    el.innerHTML = html;
    const chunkBase = sectionStartChunkLocal(index);
    const count = (props.sectionCounts || [])[index] || 0;
    const spans = new Map();
    if (count > 0) {
      mapSectionChunks(
        el,
        (props.readableChunks || []).slice(chunkBase, chunkBase + count),
        chunkBase,
        (chunkIdx, span) => spans.set(chunkIdx, span),
      );
    }

    const pagesInSection = Math.max(1, Math.round((el.scrollWidth + gap) / stride));
    for (const [chunkIdx, span] of spans) {
      chunkPages[chunkIdx] = base + Math.max(
        0,
        Math.min(pagesInSection - 1, Math.floor((span.offsetLeft + 2) / stride)),
      );
    }
    counts.push(pagesInSection);
    base += pagesInSection;

    // Real single-column height for the scroll reader's placeholder.
    if (heightEl) {
      heightEl.innerHTML = html;
      heights[index] = Math.max(120, Math.round(heightEl.offsetHeight));
    }

    // Publish progress so page numbers (and reserved heights) appear as soon as
    // the reading position has been measured, not only when the book is done.
    //
    // In batches, though: placeholderHeight() reads pageMap from the template,
    // so every publish re-renders the entire section list. Publishing after
    // each of a long book's sections made measuring the page map quadratic, and
    // it competes for the same idle slices as section mounting.
    if (index % PAGE_MAP_PUBLISH_EVERY === 0) {
      pageMap.value = { counts: counts.slice(), chunkPages, heights: heights.slice() };
    }
  }

  el.innerHTML = "";
  if (heightEl) heightEl.innerHTML = "";
  pageMap.value = { counts, chunkPages, heights };
  writePageMapCache(key, pageMap.value);
};

watch(
  () => [
    props.book?.id,
    (props.fullSections || []).length,
    layoutHash.value,
    pageGeometry.value.width,
    pageGeometry.value.height,
  ],
  () => { buildPageMap(); },
);

const pageMapTotal = computed(() => {
  const counts = pageMap.value?.counts;
  if (!counts || counts.length < (props.fullSections || []).length) return null;
  return totalPagesInMap(counts);
});

// Scroll-mode placeholder height: the section's REAL measured height once the
// measurer has reached it, falling back to the parent's text-length estimate.
// Exact heights keep the scroll position stable (no jump on mount) and let the
// eager mounter target the right sections during a fast fling.
const placeholderHeight = (index, chapter) => {
  const measured = pageMap.value?.heights?.[index];
  if (Number.isFinite(measured) && measured > 0) return measured;
  return chapter?.estHeight || 600;
};

const pagedGlobalPage = computed(() => {
  if (!usePagedReader.value) return null;
  const counts = pageMap.value?.counts;
  if (!counts) return null;
  return globalPageFor(counts, pagedPos.value.section, pagedPos.value.pageInSection);
});

// ── Chapter dock ────────────────────────────────────────────────────────────

const dockStep = (delta) => {
  if (usePagedReader.value) {
    if (delta < 0) pagedRef.value?.prevPage();
    else pagedRef.value?.nextPage();
    return;
  }
  emit(delta < 0 ? "previous-chapter" : "next-chapter");
};

const dockLabel = computed(() => {
  if (!usePagedReader.value) return chapterLabel.value;
  const globalPage = pagedGlobalPage.value;
  if (globalPage !== null) {
    const total = pageMapTotal.value;
    return total ? `Page ${globalPage + 1} / ${total}` : `Page ${globalPage + 1}`;
  }
  return `Page ${pagedPos.value.pageInSection + 1} / ${pagedPos.value.sectionPages}`;
});

// On the native app, an offline device can't reach Edge cloud voices — narration
// falls back to the phone's built-in voices. When offline the picker therefore
// lists the REAL device narrators (from the OS TTS engine), not Edge models the
// device can't reach.
//
// navigator.onLine alone was not enough: an Android WebView reports `true` for
// any network interface, so a phone on Wi-Fi with no working internet kept
// being offered Edge voices it could never load. ttsUsingDeviceVoice is the
// ground truth — the engine sets it when narration actually comes out of the
// phone's own TTS engine.
const OFFLINE_VOICE = { id: "__offline_device__", name: "Device voice (auto)" };
const useOfflineVoice = computed(() => (
  isNativeCapacitorPlatform() && (isOffline.value || ttsUsingDeviceVoice.value)
));

// Device voices as picker options: id "native:<index>" into ttsNativeVoices.
// Deduped by name, with a language hint, and an "auto" entry that lets the OS
// choose per language.
const deviceVoiceOptions = computed(() => {
  const seen = new Set();
  const options = [{ id: "native:-1", name: OFFLINE_VOICE.name }];
  (ttsNativeVoices.value || []).forEach((voice, index) => {
    const label = String(voice?.name || voice?.lang || `Voice ${index + 1}`).trim();
    const lang = String(voice?.lang || "").replace("_", "-");
    const name = lang && !label.toLowerCase().includes(lang.toLowerCase()) ? `${label} · ${lang}` : label;
    if (seen.has(name)) return;
    seen.add(name);
    options.push({ id: `native:${index}`, name });
  });
  return options;
});

const displayVoices = computed(() => (useOfflineVoice.value ? deviceVoiceOptions.value : ttsVoices.value));
const activeVoiceId = computed(() =>
  useOfflineVoice.value ? `native:${ttsNativeVoiceIdx.value}` : ttsVoiceId.value,
);
let lastScrollY = 0;
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
  if (useOfflineVoice.value) {
    return deviceVoiceOptions.value.find((v) => v.id === activeVoiceId.value)?.name || OFFLINE_VOICE.name;
  }
  const voice = ttsVoices.value.find((item) => item.id === ttsVoiceId.value);
  return voice ? voice.name : "Switch narrator";
});

// Route a picker choice to the right setter: a "native:N" id selects a device
// voice; anything else is an Edge voice.
const applyVoiceChoice = (voiceId) => {
  if (typeof voiceId === "string" && voiceId.startsWith("native:")) {
    setNativeVoice(Number(voiceId.slice(7)));
  } else {
    setVoice(voiceId);
  }
};

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

// The chunk the visible page starts at, whichever reading mode is in use.
// Which measured page a flat chunk index falls on, or null while the page map
// is still being built.
const pageForChunkLocal = (chunk) => {
  const pages = pageMap.value?.chunkPages;
  if (!pages || !Number.isFinite(chunk) || chunk < 0) return null;
  const page = pages[chunk];
  return Number.isFinite(page) ? page : null;
};

const chunkAtVisiblePage = () => {
  if (usePagedReader.value) {
    const chunk = pagedRef.value?.getPosition()?.firstChunkOfPage;
    return Number.isFinite(chunk) && chunk >= 0 ? chunk : null;
  }
  // Scroll mode: probe where the viewport actually is. The chapter's first
  // chunk is not it, and using it meant "read from this page" always rewound to
  // the top of the chapter. This runs on a press of play, not per frame, so a
  // DOM probe is affordable here.
  sampleScrollChunk();
  if (scrollChunkIdx.value >= 0) return scrollChunkIdx.value;
  const section = Number(props.currentChapterIdx);
  if (!Number.isFinite(section)) return null;
  return sectionStartChunkLocal(section);
};

// Paused, then turned to a different page, then pressed play: continuing from
// where the voice stopped and starting from the page in front of you are both
// reasonable, and guessing wrong is annoying either way — so ask.
const resumeChoice = ref({ visible: false, chunk: -1 });

const closeResumeChoice = () => {
  resumeChoice.value = { visible: false, chunk: -1 };
};

const resumeWhereLeftOff = () => {
  closeResumeChoice();
  togglePlay();
};

const playFromShownPage = () => {
  const chunk = resumeChoice.value.chunk;
  closeResumeChoice();
  if (Number.isFinite(chunk) && chunk >= 0) emit("read-from-chunk", chunk);
  else emit("read-current-position");
};

const playFromHere = () => {
  // Already loaded into the narrator — including when paused. Resuming must pick
  // up mid-sentence, so never fall through to the "read from this page" path,
  // which would rewind to the first chunk of the visible page.
  if (isThisBookNarrating.value) {
    const paused = ttsStatus.value === "paused";
    const pageChunk = chunkAtVisiblePage();
    const playingSection = ttsPlayingChunkIdx.value >= 0
      ? sectionForChunkLocal(ttsPlayingChunkIdx.value)
      : null;
    const shownSection = Number.isFinite(pageChunk) && pageChunk !== null
      ? sectionForChunkLocal(pageChunk)
      : null;

    const movedAway = shouldAskWhereToResume({
      paused,
      shownChunk: pageChunk,
      shownPage: pageForChunkLocal(pageChunk),
      playingPage: pageForChunkLocal(ttsPlayingChunkIdx.value),
      shownSection,
      playingSection,
    });

    if (movedAway) {
      resumeChoice.value = { visible: true, chunk: pageChunk };
      return;
    }
    togglePlay();
    return;
  }
  const chunk = chunkAtVisiblePage();
  if (usePagedReader.value && chunk !== null) {
    emit("read-from-chunk", chunk);
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

// ── Listen mode ─────────────────────────────────────────────────────────────
//
// The Listen view is a fixed layer over the reading content (which stays
// mounted underneath, so scroll position, section observers, and narration
// auto-follow keep working). It shows the audiobook-style player plus the
// text of the current page, sliding upward as narration advances.

const READER_MODE_KEY = "bookish:reader-mode";

const { settings: appSettings } = useBookishSettings();
const { addToast } = useToast();
const { annotations } = useAnnotations();

// Repaint after any change, and whenever the reader re-renders — the paged
// reader rebuilds its DOM on every page turn, so marks must be reapplied.
const bookAnnotations = computed(() => (
  annotations.value.filter((a) => String(a.bookId) === String(props.book?.id))
));

// Called on every page turn and every section mount, so the common case — a
// book with no highlights at all — must not cost a tick and a DOM sweep.
let _paintedAnything = false;

// Where the book's text currently lives.
//
// `.paged-content` alone is NOT enough: the offscreen page-map measurer carries
// that class too and is always in the DOM, so a bare selector matched the
// measurer and painted every highlight into a hidden div. The live paged reader
// is the one inside `.paged-reader`.
const annotationRoot = () => (
  document.querySelector(".paged-reader .paged-content")
  || props.readerRefs?.chaptersContainerRef?.value
  || document.querySelector(".reader-mobile-chapters")
);

const repaintAnnotations = async () => {
  if (!bookAnnotations.value.length && !_paintedAnything) return;
  await nextTick();
  const root = annotationRoot();
  if (!root) return;
  paintAnnotations(root, bookAnnotations.value);
  _paintedAnything = bookAnnotations.value.length > 0;
};
const listenBlurEnabled = computed(() => appSettings.value.listenCoverBlur !== false);

const readerMode = ref("listen");

// Read mode is a full-page book: the top bar and chapter dock hide so nothing
// sits over the text, and a tap in the middle of the page brings them back.
// Entering Read mode always starts hidden; leaving it restores the chrome so
// Listen mode is never left without controls.
const chromeHidden = ref(false);

const toggleChrome = () => {
  if (readerMode.value !== "read") return;
  chromeHidden.value = !chromeHidden.value;
};

// Scroll mode has no page-turn zones, so any tap that is not a text selection
// or a link toggles the chrome.
const onScrollTap = (event) => {
  if (readerMode.value !== "read") return;
  // A tap on an existing highlight opens it instead of toggling the chrome.
  if (onAnnotationTap(event)) return;
  if (selectionMenu.value.visible) return;
  const selection = typeof window !== "undefined" ? window.getSelection?.() : null;
  if (selection && !selection.isCollapsed) return;
  if (event.target?.closest?.("a,button,input,textarea")) return;
  toggleChrome();
};

// Where the reader is in SCROLL mode, as a chunk index.
//
// Sampled when Listen opens rather than tracked on every scroll: it is a DOM
// probe, and only the Listen view ever reads it — paying for it per frame would
// tax the one mode that has to stay smooth.
const scrollChunkIdx = ref(-1);

const sampleScrollChunk = () => {
  if (usePagedReader.value || props.isPdfBook || typeof document === "undefined") {
    scrollChunkIdx.value = -1;
    return;
  }
  const x = Math.floor(window.innerWidth / 2);
  // A few rows down the page: the very top edge often lands on padding or a
  // chapter rule rather than on a sentence.
  for (const y of [90, 170, 260, 360]) {
    const span = document.elementFromPoint(x, y)?.closest?.("[data-tts-chunk]");
    const idx = Number(span?.dataset?.ttsChunk);
    if (Number.isFinite(idx)) {
      scrollChunkIdx.value = idx;
      return;
    }
  }
  scrollChunkIdx.value = -1;
};

const setReaderMode = (mode) => {
  // Sample before switching, while the reading page is still the one on screen.
  if (mode === "listen") sampleScrollChunk();
  readerMode.value = mode;
  chromeHidden.value = mode === "read";
  try {
    localStorage.setItem(READER_MODE_KEY, mode);
  } catch {}
};

const isThisBookNarrating = computed(
  () => ttsBook.value?.id === props.book?.id && ttsStatus.value !== "idle",
);

const listenByline = computed(() => {
  const author = props.book?.author || "";
  const year = props.book?.publishYear ? String(props.book.publishYear) : "";
  return [author, year].filter(Boolean).join(" · ");
});

const listenProgress = computed(() => (isThisBookNarrating.value ? ttsProgress.value || 0 : 0));
const listenElapsed = computed(() => (isThisBookNarrating.value ? elapsedTime.value || "00:00" : "00:00"));
const listenTotal = computed(() => (isThisBookNarrating.value ? totalTime.value || "00:00" : "00:00"));

// Which section (ch-N) / PDF page a flat chunk index falls in.
const sectionForChunkLocal = (chunkIndex) => {
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

const sectionStartChunkLocal = (sectionIndex) => {
  const counts = props.sectionCounts || [];
  let offset = 0;
  for (let i = 0; i < sectionIndex && i < counts.length; i += 1) offset += counts[i] || 0;
  return offset;
};

// While narrating, the playing chunk — not the scroll position — decides which
// page/chapter the Listen view shows, so the text always matches the voice.
//
// When NOT narrating, the paged reader's own position wins over
// props.currentChapterIdx. The parent only learns the section through a
// position-change event, so on switching Read → Listen it could still hold the
// previous (often first) section for a tick: the Listen view rendered chapter
// one and then visibly jumped to the right place.
const listenSectionIdx = computed(() => {
  if (!props.isPdfBook && isThisBookNarrating.value && ttsPlayingChunkIdx.value >= 0) {
    return sectionForChunkLocal(ttsPlayingChunkIdx.value);
  }
  if (!props.isPdfBook && usePagedReader.value && Number.isFinite(pagedPos.value?.section)) {
    return pagedPos.value.section;
  }
  return props.currentChapterIdx;
});

const listenPdfPage = computed(() => {
  if (props.isPdfBook && isThisBookNarrating.value && ttsPlayingChunkIdx.value >= 0) {
    return pageForChunk(props.pdfManifest, ttsPlayingChunkIdx.value) || props.currentPdfPage;
  }
  return props.currentPdfPage;
});

// The Listen stepper always shows REAL pages: PDF pages come from the
// manifest; EPUB pages come from the measured page map (chunk → page), so the
// number matches the printed page the voice is on — never a chapter index.
const listenEpubGlobalPage = computed(() => {
  const map = pageMap.value;
  if (!map) return null;
  if (isThisBookNarrating.value && ttsPlayingChunkIdx.value >= 0) {
    const page = map.chunkPages?.[ttsPlayingChunkIdx.value];
    return Number.isFinite(page) ? page : null;
  }
  if (usePagedReader.value) return pagedGlobalPage.value;
  // Scroll mode: the sentence nearest the top of the viewport is where the
  // reader actually is; the section's first chunk is not.
  const chunk = scrollChunkIdx.value >= 0
    ? scrollChunkIdx.value
    : sectionStartChunkLocal(listenSectionIdx.value);
  const page = map.chunkPages?.[chunk];
  if (Number.isFinite(page)) return page;
  return globalPageFor(map.counts, listenSectionIdx.value, 0);
});

const listenPageNumber = computed(() => {
  if (props.isPdfBook) return listenPdfPage.value;
  const page = listenEpubGlobalPage.value;
  return page === null ? null : page + 1;
});

const listenPageTotal = computed(() => {
  if (props.isPdfBook) return props.totalPages || props.book?.pages || 1;
  return pageMapTotal.value;
});

const listenCurrentLabel = computed(() => (
  listenPageNumber.value === null ? "Page —" : `Page ${listenPageNumber.value}`
));
const listenPrevLabel = computed(() => (
  listenPageNumber.value !== null && listenPageNumber.value > 1
    ? `Page ${listenPageNumber.value - 1}`
    : ""
));
const listenNextLabel = computed(() => {
  const current = listenPageNumber.value;
  if (current === null) return "";
  const total = listenPageTotal.value;
  if (total !== null && current >= total) return "";
  return `Page ${current + 1}`;
});

// Which chunks belong to the EPUB page on screen.
//
// The stepper above already shows a real page number, so the text under it has
// to be that page — not the chapter it happens to sit in. Reading the whole
// section from its first sentence is what made Listen open on chapter one no
// matter where the reader actually was.
//
// pageMap.chunkPages maps chunk -> global page and only ever increases, so the
// page's slice is found by binary search rather than a walk over a book's worth
// of chunks on every recompute.
const firstChunkAtOrAfterPage = (chunkPages, page) => {
  let lo = 0;
  let hi = chunkPages.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (chunkPages[mid] < page) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

const listenEpubPageRange = computed(() => {
  const chunkPages = pageMap.value?.chunkPages;
  const page = listenEpubGlobalPage.value;
  if (!chunkPages?.length || page === null) return null;
  const start = firstChunkAtOrAfterPage(chunkPages, page);
  if (start >= chunkPages.length || chunkPages[start] !== page) return null;
  const end = firstChunkAtOrAfterPage(chunkPages, page + 1);
  return { start, count: Math.max(1, end - start) };
});

// First flat chunk index of the page on screen. Falls back to the chapter start
// only while the page map is still being measured.
const listenStartChunk = computed(() => {
  if (props.isPdfBook) {
    return firstChunkForPage(props.pdfManifest, listenPdfPage.value)?.id ?? 0;
  }
  return listenEpubPageRange.value?.start ?? sectionStartChunkLocal(listenSectionIdx.value);
});

const listenChunkCount = computed(() => {
  if (props.isPdfBook) {
    return (props.pdfManifest?.chunks || []).filter(
      (item) => item.page === listenPdfPage.value,
    ).length;
  }
  return listenEpubPageRange.value?.count
    ?? ((props.sectionCounts || [])[listenSectionIdx.value] || 0);
});

const listenChunks = computed(() => (props.readableChunks || []).slice(
  listenStartChunk.value,
  listenStartChunk.value + listenChunkCount.value,
));

const activeListenChunk = computed(() => (
  isThisBookNarrating.value ? ttsPlayingChunkIdx.value : -1
));

const toggleListenPlay = () => {
  if (isThisBookNarrating.value) {
    togglePlay();
    return;
  }
  if (usePagedReader.value) {
    const chunk = pagedRef.value?.getPosition()?.firstChunkOfPage;
    if (Number.isFinite(chunk) && chunk >= 0) {
      emit("read-from-chunk", chunk);
      return;
    }
  }
  emit("read-from-chunk", Math.max(0, listenStartChunk.value));
};

// Prev/next page: while narrating, jump the narration to the adjacent page
// (the view follows the voice); otherwise move the reading position by one
// real page.
const stepListenPage = (delta) => {
  if (props.isPdfBook) {
    if (isThisBookNarrating.value) {
      const target = firstChunkForPage(props.pdfManifest, listenPdfPage.value + delta)?.id;
      if (target !== null && target !== undefined) seekToChunk(target);
      return;
    }
    emit(delta < 0 ? "previous-chapter" : "next-chapter");
    return;
  }

  const map = pageMap.value;
  const current = listenEpubGlobalPage.value;
  if (!map || current === null) return;
  const target = current + delta;
  if (target < 0) return;

  if (isThisBookNarrating.value) {
    const chunk = firstChunkOnPage(map.chunkPages, target);
    if (chunk >= 0) seekToChunk(chunk);
    return;
  }

  if (usePagedReader.value) {
    const location = locateGlobalPage(map.counts, target);
    pagedRef.value?.goToSectionPage(location.section, location.pageInSection);
    return;
  }

  // Scroll mode: move the reading position to the section holding that page.
  const chunk = firstChunkOnPage(map.chunkPages, target);
  if (chunk >= 0) emit("go-to-section", sectionForChunkLocal(chunk));
};

// Narrator picker opened from the Listen controls (mirrors the media sheet's
// voice list, so it uses the same offline-aware voice state and setter).
const chooseNarrator = (voiceId) => {
  applyVoiceChoice(voiceId);
  narratorOpen.value = false;
};

// Slide the text so the sentence being narrated sits at the top of the panel.
let listenChunkEls = [];
const listenTextOffset = ref(0);

const setListenChunkEl = (index, el) => {
  if (el) listenChunkEls[index] = el;
};

const listenTextStyle = computed(() => ({
  transform: `translateY(-${listenTextOffset.value}px)`,
}));

const syncListenOffset = async ({ resetEls = false } = {}) => {
  if (resetEls) listenChunkEls = [];
  await nextTick();
  const relative = activeListenChunk.value - listenStartChunk.value;
  const el = relative >= 0 && relative < listenChunks.value.length
    ? listenChunkEls[relative]
    : null;
  listenTextOffset.value = el ? el.offsetTop : 0;
};

// ONE watcher, not two.
//
// A second watcher used to clear the element list when listenChunks changed,
// and because this one yields on nextTick first, the clear landed in between —
// wiping the refs it was about to measure. The offset fell back to 0, so Listen
// opened at the top of the page and only snapped to the sentence being narrated
// on the following tick. That is the "waits, then jumps" the reader sees.
watch([activeListenChunk, listenStartChunk, listenChunks], (next, prev) => {
  syncListenOffset({ resetEls: next[2] !== prev?.[2] });
});

// Opening Listen changes none of the above, so nothing recomputed the offset
// and the panel appeared parked at the top of the page even mid-narration.
watch(readerMode, (mode) => {
  if (mode === "listen") syncListenOffset({ resetEls: true });
});

const chooseVoice = (voiceId) => {
  applyVoiceChoice(voiceId);
  voicePickerOpen.value = false;
};

const cycleSpeed = () => {
  const current = SPEED_OPTIONS.indexOf(Number(ttsSpeed.value));
  const next = SPEED_OPTIONS[(current + 1) % SPEED_OPTIONS.length];
  setSpeed(next);
};

watch(mediaOpen, (open) => {
  if (!open) voicePickerOpen.value = false;
  else if (useOfflineVoice.value) loadDeviceVoices();
});

// Make sure the device-voice list is loaded whenever a narrator picker opens
// offline, and as soon as the device goes offline while the reader is open.
watch([narratorOpen, voicePickerOpen], ([narrator, picker]) => {
  if ((narrator || picker) && useOfflineVoice.value) loadDeviceVoices();
});

watch(useOfflineVoice, (offline) => {
  if (offline) loadDeviceVoices();
});

// ── Long-press "Read from here" ────────────────────────────────────────────

// Selection is the browser's own: long-pressing a word gives real selection
// handles for free, and dragging them extends the range. A custom long-press
// used to pre-empt that with a one-item "Read from here" bubble, which meant
// no handles and no way to act on more than a sentence. Now the app only
// watches for a settled selection and offers actions on it.

const selectionMenu = ref({
  visible: false, x: 0, y: 0, chunkIdx: -1,
  text: "", anchor: null, existingId: "", color: "", hasNote: false, startOnColors: false,
});
const noteEditor = ref({ visible: false, quote: "", initial: "", id: "", anchor: null });

const hideSelectionMenu = () => {
  selectionMenu.value = { ...selectionMenu.value, visible: false, startOnColors: false };
};

const cancelLongPress = () => {
  // Kept as a no-op hook: scroll and unmount handlers call it, and the browser
  // now owns the press itself.
  hideSelectionMenu();
};

// Where to float the menu: above the selection when there is room, below it
// otherwise, so it never covers the words being acted on.
const menuPointForRange = (rect) => {
  const above = rect.top - 66;
  return {
    x: rect.left + rect.width / 2,
    y: above > 80 ? above : Math.min(rect.bottom + 12, window.innerHeight - 120),
  };
};

const openSelectionMenu = ({ anchor, rect, existing = null, startOnColors = false }) => {
  const point = menuPointForRange(rect);
  selectionMenu.value = {
    visible: true,
    x: point.x,
    y: point.y,
    chunkIdx: anchor?.startChunk ?? -1,
    text: anchor?.text || existing?.text || "",
    anchor: anchor || existing || null,
    existingId: existing?.id || "",
    color: existing?.color || "",
    hasNote: !!existing?.note,
    startOnColors,
  };
  // Warm the audio while the menu is open so "Read from here" starts instantly.
  if (anchor?.startChunk >= 0) props.prewarmChunk?.(anchor.startChunk);
};

// A settled selection inside the book text opens the menu. Fired from pointer
// release rather than `selectionchange`, which fires continuously while the
// handles are being dragged.
const onSelectionSettled = () => {
  if (readerMode.value !== "read" || noteEditor.value.visible) return;
  const selection = window.getSelection?.();
  if (!selection || selection.isCollapsed) {
    if (!noteEditor.value.visible) hideSelectionMenu();
    return;
  }
  const anchor = anchorFromSelection(selection);
  if (!anchor) return;
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (!rect || (!rect.width && !rect.height)) return;
  openSelectionMenu({ anchor, rect });
};

// Backup trigger for the menu.
//
// Pointer release alone was not enough: once Android's WebView enters selection
// mode on a long press it can swallow the touchend that ended it, so the menu
// sometimes never appeared at all. `selectionchange` fires continuously while
// the handles are dragged, so a short quiet period is what "settled" means here.
const SELECTION_SETTLE_MS = 180;
let _selectionSettleTimer = null;

const onSelectionChange = () => {
  if (readerMode.value !== "read" || noteEditor.value.visible) return;
  if (_selectionSettleTimer) clearTimeout(_selectionSettleTimer);
  _selectionSettleTimer = setTimeout(() => {
    _selectionSettleTimer = null;
    onSelectionSettled();
  }, SELECTION_SETTLE_MS);
};

// Tapping an existing highlight reopens it — the likely intent is recolouring
// or removing, so the menu opens straight on the colour row.
const onAnnotationTap = (event) => {
  const mark = event.target?.closest?.("mark[data-annotation-id]");
  if (!mark) return false;
  const existing = annotations.value.find((item) => item.id === mark.dataset.annotationId);
  if (!existing) return false;
  event.stopPropagation();
  if (existing.note) {
    openNoteEditor(existing);
    return true;
  }
  openSelectionMenu({ anchor: null, rect: mark.getBoundingClientRect(), existing, startOnColors: true });
  return true;
};

// ── Selection actions ───────────────────────────────────────────────────────

const clearNativeSelection = () => {
  try { window.getSelection?.()?.removeAllRanges(); } catch {}
};

const selectionRead = () => {
  const chunk = selectionMenu.value.chunkIdx;
  hideSelectionMenu();
  clearNativeSelection();
  if (chunk >= 0) emit("read-from-chunk", chunk);
};

const selectionCopy = async () => {
  const text = selectionMenu.value.text;
  hideSelectionMenu();
  try {
    await navigator.clipboard.writeText(text);
    addToast("Copied.", "success");
  } catch {
    addToast("Could not copy that text.", "error");
  }
  clearNativeSelection();
};

const selectionDictionary = () => {
  const term = selectionMenu.value.text.trim();
  hideSelectionMenu();
  clearNativeSelection();
  if (!term) return;
  // "define" biases Google straight to its dictionary card for single words
  // while still returning sensible results for a phrase.
  const url = `https://www.google.com/search?q=${encodeURIComponent(`define ${term}`)}`;
  window.open(url, "_blank", "noopener");
};

const persistAnnotation = async (patch) => {
  const base = selectionMenu.value.anchor;
  if (!base) return null;
  return saveAnnotation({
    id: selectionMenu.value.existingId || undefined,
    bookId: props.book?.id,
    startChunk: base.startChunk,
    startOffset: base.startOffset,
    endChunk: base.endChunk,
    endOffset: base.endOffset,
    text: base.text,
    ...patch,
  });
};

const selectionHighlight = async (colorId) => {
  const existingNote = selectionMenu.value.hasNote
    ? annotations.value.find((a) => a.id === selectionMenu.value.existingId)?.note
    : undefined;
  await persistAnnotation({ color: colorId, ...(existingNote ? { note: existingNote } : {}) });
  hideSelectionMenu();
  clearNativeSelection();
  await repaintAnnotations();
};

const selectionRemove = async () => {
  const id = selectionMenu.value.existingId;
  hideSelectionMenu();
  clearNativeSelection();
  if (id) await deleteAnnotation(id);
  await repaintAnnotations();
};

const openNoteEditor = (existing = null) => {
  // The anchor is already captured, and leaving the native selection up puts
  // Android's own text toolbar over the sheet the keyboard is about to reveal.
  clearNativeSelection();
  noteEditor.value = {
    visible: true,
    quote: existing?.text || selectionMenu.value.text,
    initial: existing?.note || "",
    id: existing?.id || selectionMenu.value.existingId || "",
    anchor: existing || selectionMenu.value.anchor,
  };
  hideSelectionMenu();
};

const closeNoteEditor = () => {
  noteEditor.value = { visible: false, quote: "", initial: "", id: "", anchor: null };
  clearNativeSelection();
};

const saveNote = async (text) => {
  const anchor = noteEditor.value.anchor;
  if (anchor) {
    await saveAnnotation({
      id: noteEditor.value.id || undefined,
      bookId: props.book?.id,
      startChunk: anchor.startChunk,
      startOffset: anchor.startOffset,
      endChunk: anchor.endChunk,
      endOffset: anchor.endOffset,
      text: anchor.text,
      color: anchor.color || "yellow",
      note: text,
    });
  }
  closeNoteEditor();
  await repaintAnnotations();
  addToast("Note saved.", "success");
};

const deleteNote = async () => {
  const id = noteEditor.value.id;
  closeNoteEditor();
  if (id) await deleteAnnotation(id);
  await repaintAnnotations();
  addToast("Note deleted.", "info");
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

  // Mount a few screens ahead — enough that a section is ready before it
  // scrolls into view, small enough that the callback never hands the page a
  // dozen sections to parse in one tick. A very wide margin meant opening a
  // long book fired mount-section for ~13 screens of content at once, and the
  // resulting innerHTML parse + relayout was the freeze on open.
  _placeholderObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const index = Number(entry.target.dataset.sectionPlaceholder);
      if (!Number.isNaN(index)) emit("mount-section", index);
      _placeholderObserver?.unobserve(entry.target);
    }
  }, { rootMargin: `${MOUNT_LOOKAHEAD_PX}px 0px` });

  placeholders.forEach((el) => _placeholderObserver.observe(el));
};

// Safety net for the brief window before the page has mounted the whole book.
//
// The page now fills every section in within a few hundred milliseconds, so by
// the time a scroll gets going there is usually nothing left to do here. What
// remains near the viewport is mounted immediately and uncapped: capping it
// per-frame only recreated the drip that let scrolling outrun mounting.
const MOUNT_LOOKAHEAD_PX = 2400;

const mountNearbyPlaceholders = () => {
  const container = props.readerRefs?.chaptersContainerRef?.value;
  const placeholders = (container ?? document).querySelectorAll("[data-section-placeholder]");
  if (!placeholders.length) return;

  const behind = window.innerHeight;
  for (const el of placeholders) {
    const rect = el.getBoundingClientRect();
    if (rect.bottom < -behind || rect.top > MOUNT_LOOKAHEAD_PX) continue;
    const index = Number(el.dataset.sectionPlaceholder);
    if (!Number.isNaN(index)) emit("mount-section", index);
  }
};

// Watch only the chapter COUNT, not the array identity. mobileChapterList
// returns a fresh array on every section mount, so watching the array itself
// re-ran the observer setup dozens of times during load — thrashing the
// IntersectionObserver so some sections never mounted. The count changes only
// when a new book loads.
watch(
  () => props.chapterList.length,
  () => { observePlaceholders(); },
);

// ── Scroll-linked dock / bottom nav swap ───────────────────────────────────
//
// Direction changes reset the opposite travel counter, so tiny scroll jitter
// can't flip the dock state back and forth mid-animation.

let _mountScrollRaf = null;

const onScroll = () => {
  const nextY = window.scrollY || 0;
  const delta = nextY - lastScrollY;
  lastScrollY = Math.max(0, nextY);

  // A fling keeps scrolling long after the finger is gone, and that is exactly
  // when a measuring slice is most visible as a stutter.
  noteInteraction();

  if (selectionMenu.value.visible) hideSelectionMenu();
  cancelLongPress();

  // Throttled fallback mount so fast scrolling never reveals a blank page.
  if (_mountScrollRaf === null) {
    _mountScrollRaf = requestAnimationFrame(() => {
      _mountScrollRaf = null;
      mountNearbyPlaceholders();
    });
  }
};

const updateOnlineStatus = () => {
  isOffline.value = typeof navigator !== "undefined" && navigator.onLine === false;
};

onMounted(async () => {
  // An explicit ?mode= (from the Read/Listen buttons or the mini player) wins;
  // otherwise fall back to the last mode the reader was left in.
  const queryMode = route.query?.mode;
  if (queryMode === "read" || queryMode === "listen") {
    setReaderMode(queryMode);
  } else {
    try {
      const storedMode = localStorage.getItem(READER_MODE_KEY);
      if (storedMode === "read" || storedMode === "listen") readerMode.value = storedMode;
    } catch {}
  }
  lastScrollY = window.scrollY || 0;
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("touchstart", noteInteraction, { passive: true });
  window.addEventListener("touchmove", noteInteraction, { passive: true });
  document.addEventListener("selectionchange", onSelectionChange);
  window.addEventListener("resize", updatePageGeometry);
  updateOnlineStatus();
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
  observePlaceholders();
  await nextTick();
  updatePageGeometry();
  buildPageMap();

});

// The page fetches the book AFTER this component mounts, so the id is not
// available in onMounted — load the annotations when it arrives instead.
watch(() => props.book?.id, (id) => {
  if (id) loadAnnotations(id);
}, { immediate: true });

// Repainting needs BOTH sides to be ready: the annotations, and the DOM they
// are painted into. Either can arrive first — a small book is fully rendered
// before the store finishes loading, a large one the other way round — so this
// watches both rather than chaining the paint onto the load. Chaining it meant
// a book whose sections were already mounted never got a second chance, and
// nothing was ever painted.
watch(
  [
    bookAnnotations,
    () => props.chapterList.length,
    usePagedReader,
    // In scroll mode the sentences are wrapped in chunk spans over idle slices
    // AFTER the section HTML lands. Painting on "content rendered" alone found
    // no spans to anchor to and silently did nothing.
    () => props.readerRefs?.chunkMapVersion?.value,
  ],
  () => { repaintAnnotations(); },
  { immediate: true },
);

onUnmounted(() => {
  window.removeEventListener("scroll", onScroll);
  window.removeEventListener("touchstart", noteInteraction);
  window.removeEventListener("touchmove", noteInteraction);
  document.removeEventListener("selectionchange", onSelectionChange);
  if (_selectionSettleTimer) clearTimeout(_selectionSettleTimer);
  window.removeEventListener("resize", updatePageGeometry);
  window.removeEventListener("online", updateOnlineStatus);
  window.removeEventListener("offline", updateOnlineStatus);
  cancelLongPress();
  _pageMapToken += 1;
  _placeholderObserver?.disconnect();
  if (_mountScrollRaf !== null) cancelAnimationFrame(_mountScrollRaf);
  // Leave the DOM as we found it: marks wrap the book's own text nodes.
  const root = annotationRoot();
  if (root) clearAnnotationMarks(root);
});
</script>

<style scoped>
.reader-mobile-page {
  --mobile-reader-bg: #e8e8f2;
  --mobile-reader-text: #222431;
  --mobile-reader-muted: #6f7282;
  /* Raised surfaces (pill, play button) follow the reader theme. */
  --mobile-reader-surface: #ffffff;
  --dock-swap-duration: 0.32s;
  --dock-swap-ease: cubic-bezier(0.33, 1, 0.68, 1);
  /* Read mode never renders the app's tab bar — in scroll mode or page mode
     alike — so the chapter dock always sits at the screen edge. */
  --bottom-nav-space: env(safe-area-inset-bottom);
  min-height: 100vh;
  background: var(--mobile-reader-bg);
  color: var(--mobile-reader-text);
  font-family: var(--mobile-font-family);
}

.reader-mobile-page.dark {
  --mobile-reader-bg: var(--color-reader-dark-background);
  --mobile-reader-text: var(--color-reader-dark-text);
  --mobile-reader-muted: var(--color-reader-dark-muted);
  --mobile-reader-surface: var(--color-reader-dark-page);
}

/* "Book brown" — warm paper background, chosen from Display settings.
   Declared after .dark so it wins in either theme. */
.reader-mobile-page.sepia {
  --mobile-reader-bg: #ecdfc8;
  --mobile-reader-text: #43331f;
  --mobile-reader-muted: #8a7454;
  --mobile-reader-surface: #f6ecd9;
}

/* The app's tab bar renders inside the reader page, so it follows the reader's
   paper colour — "Book brown", dark, or light — exactly like the top bar does.
   Left on --color-background-app it was the one strip of app chrome that stayed
   grey while the rest of the page turned brown. */
.reader-mobile-page :deep(.mobile-bottom-nav) {
  background: var(--mobile-reader-bg);
  box-shadow: 0 -2px 10px color-mix(in srgb, var(--mobile-reader-text) 8%, transparent);
}

/* Brand purple fought the warm page the same way the mode toggle did, so the
   tabs tint with the reader's own text colour instead. */
.reader-mobile-page :deep(.mobile-nav-item) {
  color: color-mix(in srgb, var(--mobile-reader-text) 55%, transparent);
}

.reader-mobile-page :deep(.mobile-nav-item.active) {
  color: var(--mobile-reader-text);
}

.reader-mobile-topbar {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 1150;
  display: grid;
  /* Symmetric side columns keep the Listen/Read toggle exactly centred even
     though the right side holds two icons and the left only one. */
  grid-template-columns: 88px minmax(0, 1fr) 88px;
  align-items: center;
  min-height: 52px;
  padding: env(safe-area-inset-top) 8px 0;
  background: var(--mobile-reader-bg);
}

/* Read mode: a quiet, paper-toned control. A saturated purple pill fought the
   book page it sits above, so the track is a soft tint of the reader's own text
   colour and the active pill is the raised reader surface. */
.reader-mode-toggle {
  display: inline-flex;
  justify-self: center;
  padding: 3px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--mobile-reader-text) 9%, transparent);
}

.reader-mode-toggle button {
  min-width: 74px;
  padding: 6px 16px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: color-mix(in srgb, var(--mobile-reader-text) 60%, transparent);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.reader-mode-toggle button.active {
  background: var(--mobile-reader-surface);
  color: var(--mobile-reader-text);
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.14);
}

/* On dark paper the raised surface (#27262d) is barely a shade off the page
   (#18171c), so the selected mode read as no selection at all — and a dark drop
   shadow adds nothing on a dark background. Lift the pill with the reader's own
   text colour instead. */
.reader-mobile-page.dark .reader-mode-toggle button.active {
  background: color-mix(in srgb, var(--mobile-reader-text) 26%, var(--mobile-reader-bg));
  color: #fff;
  box-shadow: none;
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

/* The book owns the whole screen. The top bar and chapter dock are fixed
   layers that float OVER the text when summoned, so reserving space for them
   here would leave a dead band above and below the page whenever the chrome is
   hidden — which is its default state in Read mode. The bottom padding is the
   one exception: it is scroll runway, not a gap, so the last lines of the book
   can still be scrolled clear of the dock. */
.reader-mobile-content {
  padding: calc(env(safe-area-inset-top) + 10px) 20px
    calc(env(safe-area-inset-bottom) + 96px);
}

/* ── Listen mode ──────────────────────────────────────────────────────────
   Fixed layer above the reading content (below the topbar controls). The
   content stays mounted underneath so narration auto-follow and the section
   observers keep the page indicator in sync. */
.reader-listen-view {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
  padding: calc(72px + env(safe-area-inset-top)) 24px 0;
  background: var(--mobile-reader-bg);
  color: var(--mobile-reader-text);
  /* The panel is a player, not a scroll surface — don't pan the page behind. */
  touch-action: none;
}

.listen-cover img {
  display: block;
  width: min(42vw, 168px);
  border-radius: 10px;
  box-shadow: var(--shadow-cover);
}

.listen-title {
  margin: 16px 0 2px;
  font-size: 17px;
  font-weight: 600;
  line-height: 1.25;
  text-align: center;
}

.listen-byline {
  margin: 0 0 20px;
  color: var(--mobile-reader-muted);
  font-size: 12.5px;
  text-align: center;
}

.listen-progress {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 40px;
  gap: 10px;
  align-items: center;
  width: 100%;
  color: var(--mobile-reader-muted);
  font-size: 11px;
}

.listen-progress span:last-child {
  text-align: right;
}

.listen-progress input {
  width: 100%;
  height: 5px;
  appearance: none;
  -webkit-appearance: none;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    var(--color-brand-primary) var(--fill, 0%),
    color-mix(in srgb, var(--mobile-reader-muted) 30%, transparent) var(--fill, 0%)
  );
  touch-action: pan-x;
}

.listen-progress input::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border: 0;
  border-radius: 50%;
  background: var(--color-brand-primary);
}

.listen-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin: 14px 0 8px;
}

.listen-controls button {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--mobile-reader-text);
  cursor: pointer;
  font-size: 24px;
}

.listen-controls .listen-skip {
  font-size: 26px;
}

.listen-controls .listen-play {
  font-size: 38px;
}

/* Speed + narrator: secondary controls on the outer edges. */
.listen-controls .listen-aux {
  width: 40px;
  height: 40px;
  color: var(--mobile-reader-muted);
  font-size: 20px;
}

.listen-controls .listen-aux:first-child {
  font-size: 15px;
  font-weight: 600;
}

.listen-page-nav {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 8px;
  align-items: center;
  width: 100%;
  margin: 4px 0 16px;
}

.listen-page-step {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: 40px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--mobile-reader-muted);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}

.listen-page-step:disabled {
  opacity: 0;
  pointer-events: none;
}

.listen-page-step.prev {
  justify-self: start;
}

.listen-page-step.next {
  justify-self: end;
}

.listen-page-step i {
  font-size: 16px;
}

.listen-page-current {
  font-size: 15px;
  font-weight: 600;
}

.listen-text {
  flex: 1;
  width: 100%;
  overflow: hidden;
  /* Fade the last lines out instead of clipping them at the screen edge. */
  -webkit-mask-image: linear-gradient(to bottom, #000 72%, transparent 98%);
  mask-image: linear-gradient(to bottom, #000 72%, transparent 98%);
}

.listen-text-inner {
  position: relative;
  margin: 0;
  font-size: 16px;
  line-height: 1.58;
  text-align: justify;
  text-justify: inter-word;
  hyphens: auto;
  -webkit-hyphens: auto;
  transition: transform 0.6s cubic-bezier(0.33, 1, 0.68, 1);
  will-change: transform;
  -webkit-user-select: none;
  user-select: none;
}

.listen-text-empty {
  margin: 1.5rem 0 0;
  color: var(--mobile-reader-muted);
  font-size: 14px;
  text-align: center;
}

/* Blurred cover background — the exact blurred cover-image technique the
   series cards use (SeriesCollageCard `.card-bg`): same blur, saturation,
   scale and `--gradient-image-card-overlay`, with the same white-on-image
   text treatment. Toggled in Preferences → "Blurred cover in Listen mode". */
.listen-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.listen-bg img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(25px) saturate(150%);
  transform: scale(1.35);
}

.listen-bg-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: var(--gradient-image-card-overlay);
}

.reader-listen-view > :not(.listen-bg) {
  position: relative;
  z-index: 1;
}

/* On a blur background the player sits over imagery — go white with a shadow,
   exactly like the cards' `.bg-blur` text. */
.reader-listen-view.bg-blur .listen-title {
  color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.55);
}

.reader-listen-view.bg-blur .listen-byline,
.reader-listen-view.bg-blur .listen-progress,
.reader-listen-view.bg-blur .listen-page-step,
.reader-listen-view.bg-blur .listen-text-empty {
  color: rgba(255, 255, 255, 0.82);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}

.reader-listen-view.bg-blur .listen-page-current,
.reader-listen-view.bg-blur .listen-controls button,
.reader-listen-view.bg-blur .listen-text-inner {
  color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.55);
}

.reader-listen-view.bg-blur .listen-progress input {
  background: linear-gradient(
    to right,
    #fff var(--fill, 0%),
    rgba(255, 255, 255, 0.3) var(--fill, 0%)
  );
}

.reader-listen-view.bg-blur .listen-progress input::-webkit-slider-thumb {
  background: #fff;
}

/* The narrated sentence stays legible over the image. */
.reader-listen-view.bg-blur .listen-chunk.active {
  background: rgba(255, 255, 255, 0.22);
  outline-color: rgba(255, 255, 255, 0.5);
}

/* The fixed topbar paints above the blurred backdrop — let the image show
   through it, and lift its controls onto the imagery like the card text. */
.reader-mobile-page.listen-blur .reader-mobile-topbar {
  background: transparent;
}

.reader-mobile-page.listen-blur .reader-nav-btn {
  color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.55);
}

/* Listen mode: frosted glass over the blurred cover — the purple pill read as a
   foreign UI chip on top of the artwork. */
.reader-mobile-page.listen-blur .reader-mode-toggle {
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
}

.reader-mobile-page.listen-blur .reader-mode-toggle button {
  color: rgba(255, 255, 255, 0.72);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
}

.reader-mobile-page.listen-blur .reader-mode-toggle button.active {
  background: rgba(255, 255, 255, 0.24);
  color: #fff;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.35),
    0 2px 8px rgba(0, 0, 0, 0.22);
}

/* The sentence being narrated is highlighted just like in Read mode. */
.listen-chunk.active {
  border-radius: 3px;
  background: var(--color-reader-highlight, rgba(138, 43, 226, 0.18));
  outline: 1px solid var(--color-reader-highlight-border, rgba(138, 43, 226, 0.35));
}

/* ── Display settings sheet ──────────────────────────────────────────────── */

.reader-display-sheet {
  max-height: 78vh;
  overflow-y: auto;
  text-align: left;
}

.reader-display-sheet h2 {
  text-align: center;
}

.display-row {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  min-height: 44px;
  padding: 4px 0;
}

.display-label {
  color: var(--sheet-control-text);
  font-size: 12.5px;
  font-weight: 600;
}

.seg-group {
  display: flex;
  gap: 4px;
  padding: 3px;
  border-radius: 9px;
  background: var(--sheet-list-bg);
}

.seg-btn {
  flex: 1;
  min-height: 32px;
  padding: 0 6px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--sheet-text);
  cursor: pointer;
  font-size: 12.5px;
  white-space: nowrap;
}

.seg-btn.active {
  background: var(--sheet-option-active-bg);
  color: var(--color-brand-primary);
  font-weight: 600;
}

.seg-sepia.active {
  background: #ecdfc8;
  color: #43331f;
}

.size-stepper {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 44px;
  align-items: center;
  padding: 3px;
  border-radius: 9px;
  background: var(--sheet-list-bg);
  text-align: center;
}

.size-stepper button {
  min-height: 32px;
  border: 0;
  border-radius: 7px;
  background: var(--sheet-option-active-bg);
  color: var(--sheet-text);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.size-stepper span {
  color: var(--sheet-text);
  font-size: 14px;
  font-weight: 600;
}

.display-pdf-note {
  margin: 0.5rem 0 1rem;
  color: var(--sheet-control-text);
  font-size: 13.5px;
  text-align: center;
}

/* Offscreen page-map measurer: participates in layout (visibility, not
   display, keeps real geometry) but is invisible and untouchable. */
.page-map-measurer {
  position: fixed;
  inset: 0;
  z-index: -1;
  visibility: hidden;
  pointer-events: none;
}

/* Offscreen single-column height measurer for the scroll reader. Free-flowing
   height (no fixed inset) so offsetHeight equals the section's real rendered
   height at the reader's content width. */
.scroll-height-measurer {
  position: fixed;
  top: 0;
  left: 0;
  z-index: -1;
  visibility: hidden;
  pointer-events: none;
}

.reader-mobile-content.is-pdf-reader {
  padding: calc(env(safe-area-inset-top) + 10px) 12px
    calc(env(safe-area-inset-bottom) + 96px);
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

/* Sections are deliberately plain boxes — no browser-level off-screen skipping.
 *
 * That native skipping looked like the perfect fit (it would remove every race
 * against scrolling) but it applies `contain: size`, and EPUB content leans on
 * percentage sizing: images styled `width: 100%` resolved against a
 * size-contained box and blew up to their intrinsic pixel size, and body text
 * stopped wrapping to the column and ran off the right edge. The reader keeps
 * up instead by mounting the whole book quickly (see _startIdleSectionMounting).
 */
.reader-mobile-section {
  min-height: auto;
}

/* Clear separation between chapters, like turning to a fresh page. */
.reader-mobile-section + .reader-mobile-section {
  margin-top: 1.6rem;
  padding-top: 1.6rem;
  border-top: 1px solid var(--color-reader-highlight-border, rgba(0, 0, 0, 0.08));
}

/* Unmounted chapters hold estimated space until the page mounts their HTML. */
.reader-section-placeholder {
  width: 100%;
}

/* ReadEra-style body typography: comfortable measure, generous leading,
   justified text with hyphenation, and clean spacing for every element. */
.reader-mobile-text {
  color: var(--mobile-reader-text);
  font-size: var(--mr-font-size, 17px);
  font-family: var(--mr-font-family, inherit);
  /* !important, reluctantly — see ReaderPagedEpub: main.css forces
     `font-weight: 400 !important` on p/div/span app-wide. */
  font-weight: var(--mr-font-weight, 400) !important;
  line-height: var(--mr-line-height, 1.62);
  letter-spacing: 0.002em;
  text-align: var(--mr-text-align, justify);
  text-justify: inter-word;
  hyphens: auto;
  -webkit-hyphens: auto;
  overflow-wrap: break-word;
  word-break: break-word;
  /* Selection is deliberately ENABLED: long-pressing a word gives the
     browser's own selection handles, which is what lets a reader extend the
     range before choosing highlight, note, copy or dictionary. */
  -webkit-user-select: text;
  user-select: text;
  -webkit-touch-callout: none;
}

/* Publisher inline styles survive sanitising — never let them push text past
   the page edge (oversized margins/widths are the classic broken-EPUB case). */
.reader-mobile-text :deep(p),
.reader-mobile-text :deep(div),
.reader-mobile-text :deep(h1),
.reader-mobile-text :deep(h2),
.reader-mobile-text :deep(h3),
.reader-mobile-text :deep(h4),
.reader-mobile-text :deep(h5),
.reader-mobile-text :deep(h6),
.reader-mobile-text :deep(section),
.reader-mobile-text :deep(article) {
  max-width: 100% !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
  width: auto !important;
}

.reader-mobile-text :deep(span),
.reader-mobile-text :deep(a),
.reader-mobile-text :deep(em),
.reader-mobile-text :deep(strong) {
  white-space: normal !important;
}

/* The global weight reset names these tags directly — inherit the reader's
   chosen thickness instead. */
.reader-mobile-text :deep(p),
.reader-mobile-text :deep(div),
.reader-mobile-text :deep(span),
.reader-mobile-text :deep(b),
.reader-mobile-text :deep(strong),
.reader-mobile-text :deep(em),
.reader-mobile-text :deep(i),
.reader-mobile-text :deep(li),
.reader-mobile-text :deep(blockquote) {
  font-weight: inherit !important;
}

.reader-mobile-text :deep(p) {
  margin: 0 0 0.35rem;
  /* First-line indent, no big gaps — the classic book paragraph rhythm. */
  text-indent: 1.3em;
  orphans: 2;
  widows: 2;
}

/* No indent for the first paragraph of a chapter, or paragraphs that follow a
   heading, image, or break — matches how print books open a section. */
.reader-mobile-text :deep(p:first-child),
.reader-mobile-text :deep(h1 + p),
.reader-mobile-text :deep(h2 + p),
.reader-mobile-text :deep(h3 + p),
.reader-mobile-text :deep(h4 + p),
.reader-mobile-text :deep(hr + p),
.reader-mobile-text :deep(figure + p),
.reader-mobile-text :deep(blockquote + p),
.reader-mobile-text :deep(img + p) {
  text-indent: 0;
}

.reader-mobile-text :deep(h1),
.reader-mobile-text :deep(h2),
.reader-mobile-text :deep(h3),
.reader-mobile-text :deep(h4) {
  margin: 1.6em 0 0.7em;
  color: var(--mobile-reader-text);
  font-weight: 600;
  line-height: 1.25;
  text-align: left;
  text-indent: 0;
  hyphens: none;
}

.reader-mobile-text :deep(h1) { font-size: 1.55em; }
.reader-mobile-text :deep(h2) { font-size: 1.32em; }
.reader-mobile-text :deep(h3) { font-size: 1.15em; }
.reader-mobile-text :deep(h4) { font-size: 1.04em; }

.reader-mobile-text :deep(blockquote) {
  margin: 1em 0;
  padding: 0.2em 0 0.2em 1em;
  border-left: 3px solid var(--color-reader-highlight-border, rgba(138, 43, 226, 0.4));
  color: var(--mobile-reader-muted);
  font-style: italic;
  text-indent: 0;
}

.reader-mobile-text :deep(ul),
.reader-mobile-text :deep(ol) {
  margin: 0.6em 0;
  padding-left: 1.5em;
  text-align: left;
}

.reader-mobile-text :deep(li) {
  margin: 0.25em 0;
  text-indent: 0;
}

.reader-mobile-text :deep(hr) {
  margin: 1.4em auto;
  width: 40%;
  border: 0;
  border-top: 1px solid var(--color-reader-highlight-border, rgba(0, 0, 0, 0.12));
}

.reader-mobile-text :deep(a) {
  color: var(--color-brand-primary);
  text-decoration: none;
}

.reader-mobile-text :deep(.tts-active) {
  border-radius: 3px;
  background: var(--color-reader-highlight);
  outline: 1px solid var(--color-reader-highlight-border);
}

/* Images: never overflow, always centered, with breathing room and captions. */
.reader-mobile-text :deep(img),
.reader-mobile-text :deep(svg),
.reader-mobile-text :deep(image) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 1.1em auto;
  border-radius: 4px;
}

.reader-mobile-text :deep(figure) {
  margin: 1.2em 0;
  text-indent: 0;
}

.reader-mobile-text :deep(figcaption) {
  margin-top: 0.4em;
  color: var(--mobile-reader-muted);
  font-size: 0.85em;
  font-style: italic;
  text-align: center;
  text-indent: 0;
}

.reader-mobile-text :deep(table) {
  max-width: 100%;
  margin: 1em 0;
  border-collapse: collapse;
  font-size: 0.9em;
}

.reader-mobile-text :deep(td),
.reader-mobile-text :deep(th) {
  padding: 0.35em 0.55em;
  border: 1px solid var(--color-reader-highlight-border, rgba(0, 0, 0, 0.12));
  text-indent: 0;
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
  transition:
    transform var(--dock-swap-duration) var(--dock-swap-ease),
    padding var(--dock-swap-duration) var(--dock-swap-ease);
  will-change: transform;
}

/* ── Immersive reading ──────────────────────────────────────────────────────
   Read mode starts with only the book on screen; a tap in the middle brings the
   chrome back. Hiding is `v-show` alone: a class on the page root drove a style
   recalculation of the entire book subtree on every toggle, which on a long
   book was a visible stall. The chrome is fixed and opaque, so showing it never
   moves a word of text. */
/* ── Highlights and notes ──────────────────────────────────────────────────
   Painted as <mark> around the book's own text. `color: inherit` matters: a
   mark's default black would fight the dark and Book-brown reader themes. */
/* Deliberately NOT `mix-blend-mode`. Multiply reads beautifully, but a blend
   mode forces its whole stacking context off the compositor's fast path, so
   every scroll tick and every page turn repainted the entire book column on the
   CPU — one highlight was enough to make the reader stutter. A translucent tint
   over the paper reaches the same legibility for free. */
:deep(.annotation-mark) {
  border-radius: 3px;
  background-color: transparent;
  color: inherit;
  box-shadow: inset 0 0 0 100px color-mix(in srgb, var(--annotation-tint, #ffd54f) 42%, transparent);
}

/* On a dark page the same tint needs to be lighter, not darker, to stay legible. */
.reader-mobile-page.dark :deep(.annotation-mark) {
  box-shadow: inset 0 0 0 100px color-mix(in srgb, var(--annotation-tint, #ffd54f) 30%, transparent);
}

/* A noted passage carries a small marker so it is findable without tapping
   every highlight to see which one has writing behind it. */
:deep(.annotation-mark[data-has-note="true"])::after {
  content: "";
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-left: 3px;
  border-radius: 50%;
  background: var(--color-brand-primary, #8a2be2);
  vertical-align: super;
}

/* ── Resume-position sheet ─────────────────────────────────────────────── */
.resume-overlay {
  position: fixed;
  inset: 0;
  z-index: 3400;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}

.resume-sheet {
  width: 100%;
  max-width: 520px;
  padding: 0.75rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom));
  border-radius: 20px 20px 0 0;
  background: var(--mobile-reader-surface);
  color: var(--mobile-reader-text);
}

.resume-sheet h2 {
  margin: 0.5rem 0 0.35rem;
  font-size: 1.05rem;
  font-weight: 600;
}

.resume-sheet p {
  margin: 0 0 1rem;
  color: var(--mobile-reader-muted);
  font-size: 0.9rem;
  line-height: 1.45;
}

.resume-actions {
  display: grid;
  gap: 0.6rem;
}

.resume-primary,
.resume-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.85rem;
  border: 0;
  border-radius: 12px;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
}

.resume-primary {
  background: var(--color-brand-primary);
  color: var(--color-text-on-brand);
}

.resume-secondary {
  border: 1px solid color-mix(in srgb, var(--mobile-reader-text) 20%, transparent);
  background: transparent;
  color: var(--mobile-reader-text);
}

.chapter-pill {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 44px;
  height: 42px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--mobile-reader-surface);
  box-shadow: 0 1px 5px rgba(15, 23, 42, 0.08);
  transition:
    background-color var(--dock-swap-duration) var(--dock-swap-ease),
    box-shadow var(--dock-swap-duration) var(--dock-swap-ease),
    grid-template-columns var(--dock-swap-duration) var(--dock-swap-ease);
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
  overflow: hidden;
  padding: 0;
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
  background: var(--mobile-reader-surface);
  color: var(--mobile-reader-text);
  cursor: pointer;
  font-size: 20px;
  box-shadow: 0 1px 5px rgba(15, 23, 42, 0.08);
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

/* The sheet is teleported to <body>, so it can't inherit the reader page's
   theme variables — it carries the theme class and defines its own. */
.reader-media-sheet {
  --sheet-bg: #f5f5fb;
  --sheet-text: #1f2230;
  --sheet-strong: #02030a;
  --sheet-control: #e1e2ef;
  --sheet-control-active: #d3d5e8;
  --sheet-control-text: #4b4f63;
  --sheet-list-bg: #ececf5;
  --sheet-option-active-bg: #ffffff;
  --sheet-grabber: #0d0d13;
  position: relative;
  width: 100%;
  min-height: 288px;
  padding: 10px 16px calc(22px + env(safe-area-inset-bottom));
  border-radius: 16px 16px 0 0;
  background: var(--sheet-bg);
  color: var(--sheet-text);
  box-shadow: 0 -12px 34px rgba(15, 23, 42, 0.16);
  text-align: center;
}

.reader-media-sheet.dark {
  --sheet-bg: var(--color-reader-dark-toolbar);
  --sheet-text: var(--color-reader-dark-text);
  --sheet-strong: var(--color-reader-dark-text);
  --sheet-control: var(--color-reader-dark-button-hover);
  --sheet-control-active: var(--color-reader-dark-border);
  --sheet-control-text: var(--color-reader-dark-muted);
  --sheet-list-bg: var(--color-reader-dark-background);
  --sheet-option-active-bg: var(--color-reader-dark-page);
  --sheet-grabber: var(--color-reader-dark-muted);
  box-shadow: 0 -12px 34px rgba(0, 0, 0, 0.45);
}

.sheet-grabber {
  width: 32px;
  height: 4px;
  margin: 0 auto 16px;
  border-radius: 999px;
  background: var(--sheet-grabber);
}

.reader-media-sheet h2 {
  margin: 0 0 28px;
  font-size: 18px;
  font-weight: 500 !important;
}

/* Narrator picker (opened from the Listen controls) is a compact voice list. */
.reader-narrator-sheet {
  min-height: 0;
}

.reader-narrator-sheet h2 {
  margin: 0 0 14px;
}

.reader-narrator-sheet .voice-list {
  max-height: 46vh;
}

/* Table-of-contents sheet — a scrollable chapter list. */
.reader-toc-sheet {
  min-height: 0;
  text-align: left;
}

.reader-toc-sheet h2 {
  margin: 0 0 12px;
  text-align: center;
}

.toc-list {
  display: grid;
  gap: 2px;
  max-height: 60vh;
  margin: 0 auto;
  padding: 4px;
  overflow-y: auto;
  overflow-x: hidden;
  width: 100%;
  border-radius: 10px;
  background: var(--sheet-list-bg);
}

.toc-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 44px;
  padding: 8px 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--sheet-text);
  cursor: pointer;
  font-size: 14px;
  text-align: left;
}

.toc-item.active {
  background: var(--sheet-option-active-bg);
  color: var(--color-brand-primary);
  font-weight: 600;
}

.toc-item-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toc-item i {
  flex: 0 0 auto;
  font-size: 16px;
}

.toc-empty {
  margin: 1rem 0;
  color: var(--sheet-control-text);
  font-size: 14px;
  text-align: center;
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
  background: var(--sheet-control);
  color: var(--sheet-control-text);
  cursor: pointer;
  font-size: 13px;
  transition: background-color 0.15s ease;
}

.narrator-btn.open {
  background: var(--sheet-control-active);
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
  background: var(--sheet-list-bg);
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
  color: var(--sheet-text);
  cursor: pointer;
  font-size: 14px;
}

.voice-option.active {
  background: var(--sheet-option-active-bg);
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
  color: var(--sheet-strong);
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
  color: var(--sheet-text);
  font-size: 13px;
}

/* Same track + thumb as the Listen player's scrubber, so the two progress bars
   in the reader read as one control. */
.media-progress-row input {
  width: 100%;
  height: 5px;
  appearance: none;
  -webkit-appearance: none;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    var(--color-brand-primary) var(--fill, 0%),
    color-mix(in srgb, var(--sheet-control-text) 30%, transparent) var(--fill, 0%)
  );
  touch-action: pan-x;
}

.media-progress-row input::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border: 0;
  border-radius: 50%;
  background: var(--color-brand-primary);
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
  color: var(--sheet-text);
  cursor: pointer;
  font-size: 15px;
  font-weight: 500 !important;
}

.speed-btn:active {
  background: var(--sheet-control);
}
</style>
