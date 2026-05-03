<template>
  <div class="reader-page" :class="readerTheme">
    <!-- Reader Header -->
    <header class="reader-header" :class="{ 'header-hidden': isScrollingDown && !isAtTop }">
      <div class="header-left">
        <button class="back-btn" @click="goBack">
          <i class="ri-arrow-left-line"></i>
        </button>
        <div class="book-meta">
          <h1 class="book-title">{{ book?.title || 'Loading...' }}</h1>
          <p class="book-author">by {{ book?.author }}</p>
        </div>
      </div>
      <div class="header-center">
        <div class="progress-indicator">
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" :style="{ width: scrollProgress + '%' }"></div>
          </div>
          <span class="progress-text">{{ Math.round(scrollProgress) }}% read</span>
        </div>
      </div>
      <div class="header-right">
        <template v-if="!isPdf">
          <button class="tool-btn" @click="toggleTheme" title="Switch Theme">
            <i :class="readerTheme === 'light' ? 'ri-moon-line' : 'ri-sun-line'"></i>
          </button>
          <button class="tool-btn" @click="increaseFontSize" title="Increase Font">
            <i class="ri-font-size"></i>
            <i class="ri-add-line mini-icon"></i>
          </button>
          <button class="tool-btn" @click="decreaseFontSize" title="Decrease Font">
            <i class="ri-font-size"></i>
            <i class="ri-subtract-line mini-icon"></i>
          </button>
        </template>
      </div>
    </header>

    <!-- Reading Content -->
    <main 
      ref="readerMain"
      class="reader-content" 
      :style="{ fontSize: fontSize + 'px' }"
      @scroll="handleScroll"
    >
      <div class="content-wrapper">
        <div v-if="loading" class="reader-loader">
          <div class="loader-spinner"></div>
          <p>Opening your book...</p>
        </div>
        
        <!-- Real content if available -->
        <template v-else-if="book">
          <div v-if="isPdf && book.content" class="pdf-embed-wrapper">
            <embed
              :src="book.content"
              type="application/pdf"
              width="100%"
              height="100%"
            />
          </div>

          <div v-else-if="book.content" class="book-text">
            <div v-if="isHtml(book.content)" v-html="book.content"></div>
            <div v-else>{{ book.content }}</div>
          </div>

          <div v-else class="placeholder-reading">
            <p class="dropcap">O</p>
            <p>nce upon a time in the digital library, this book awaited its reader. While the full contents are being synchronized, imagine the worlds contained within these pages.</p>
            <p>The smell of old parchment, the weight of the binding, and the whispers of long-forgotten stories fill the air of your mind.</p>
            <p>This is where your journey begins. A world of infinite possibilities, limited only by the boundaries of your imagination. Every word is a step, every sentence a path, and every chapter a destination.</p>
            <p>Continue scrolling to immerse yourself further into the architectural beauty of this reading interface.</p>

            <div class="filler-blocks">
              <div v-for="i in 5" :key="i" class="filler-paragraph"></div>
            </div>

            <p>As you reach the end of this preview, remember that every great story starts with a single click. Your library is a treasure trove of knowledge, emotion, and adventure.</p>
          </div>
        </template>

        <div v-else class="reader-error">
          <i class="ri-error-warning-line"></i>
          <h2>Book not found</h2>
          <button @click="goBack" class="back-link">Return to Library</button>
        </div>
      </div>
    </main>

    <!-- Reading Progress Footer (Mobile) -->
    <footer class="reader-footer">
        <div class="footer-progress">
             <div class="progress-bar-bg">
                <div class="progress-bar-fill" :style="{ width: scrollProgress + '%' }"></div>
            </div>
        </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useBooks } from '~/composables/useBooks';

const route = useRoute();
const router = useRouter();
const { fetchBookById, updateBook } = useBooks();

const book = ref(null);
const loading = ref(true);
const fontSize = ref(20);
const readerTheme = ref('light');
const scrollProgress = ref(0);
const isScrollingDown = ref(false);
const isAtTop = ref(true);
const readerMain = ref(null);
let lastScrollTop = 0;
const isPdf = computed(() => book.value?.format === 'pdf')

onMounted(async () => {
  const bookId = route.params.id;
  book.value = await fetchBookById(bookId, true);
  loading.value = false;
  
  // Set initial scroll progress if saved
  if (book.value?.progress && readerMain.value) {
      setTimeout(() => {
          const totalHeight = readerMain.value.scrollHeight - readerMain.value.clientHeight;
          readerMain.value.scrollTop = (book.value.progress / 100) * totalHeight;
      }, 100);
  }
});

const handleScroll = (e) => {
  const container = e.target;
  const scrollTop = container.scrollTop;
  const scrollHeight = container.scrollHeight;
  const clientHeight = container.clientHeight;
  
  // Calculate progress
  const totalAvailable = scrollHeight - clientHeight;
  if (totalAvailable > 0) {
    scrollProgress.value = (scrollTop / totalAvailable) * 100;
  }
  
  // Header visibility logic
  isScrollingDown.value = scrollTop > lastScrollTop;
  isAtTop.value = scrollTop < 50;
  lastScrollTop = scrollTop;
};

// Sync progress to DB when leaving
onUnmounted(async () => {
    if (book.value && scrollProgress.value > 0) {
        await updateBook({
            ...book.value,
            progress: Math.round(scrollProgress.value),
            status: scrollProgress.value > 95 ? 'Completed' : 'Reading'
        });
    }
});

const goBack = () => router.back();

const toggleTheme = () => {
  readerTheme.value = readerTheme.value === 'light' ? 'dark' : 'light';
};

const increaseFontSize = () => {
  if (fontSize.value < 40) fontSize.value += 2;
};

const decreaseFontSize = () => {
  if (fontSize.value > 12) fontSize.value -= 2;
};

const isHtml = (content) => {
  return /<[a-z][\s\S]*>/i.test(content);
};
</script>

<style scoped>
.reader-page {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  transition: background-color 0.3s ease, color 0.3s ease;
  font-family: 'Georgia', serif;
}

.reader-page.light {
  background-color: #fdfaf6;
  color: #2c1810;
}

.reader-page.dark {
  background-color: #1a1a1a;
  color: #e0e0e0;
}

/* Header Styles */
.reader-header {
  height: 70px;
  padding: 0 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  background: inherit;
  position: sticky;
  top: 0;
  z-index: 10;
  transition: transform 0.3s ease;
}

.reader-page.dark .reader-header {
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

.header-hidden {
  transform: translateY(-100%);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex: 1;
}

.back-btn {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  color: inherit;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.back-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.reader-page.dark .back-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.book-meta {
  display: flex;
  flex-direction: column;
}

.book-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 250px;
}

.book-author {
  font-size: 0.8rem;
  opacity: 0.7;
  margin: 0;
}

/* Center Progress */
.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.progress-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  width: 200px;
}

.progress-bar-bg {
  width: 100%;
  height: 4px;
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.reader-page.dark .progress-bar-bg {
  background-color: rgba(255, 255, 255, 0.1);
}

.progress-bar-fill {
  height: 100%;
  background-color: #6C97B1;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

/* Right Tools */
.header-right {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.tool-btn {
  background: transparent;
  border: none;
  font-size: 1.2rem;
  color: inherit;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: background-color 0.2s;
}

.tool-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.reader-page.dark .tool-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.mini-icon {
  font-size: 0.7rem;
  position: absolute;
  top: 4px;
  right: 2px;
}

/* Content Area */
.reader-content {
  flex: 1;
  overflow-y: auto;
  scroll-behavior: smooth;
  padding: 4rem 1rem;
}

.content-wrapper {
  max-width: 800px;
  margin: 0 auto;
}

.chapter-content {
  line-height: 1.6;
}

.book-text {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.8;
  letter-spacing: 0.01em;
}

.book-text div {
  margin-bottom: 1.5rem;
}

.placeholder-reading {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  opacity: 0.9;
}

.dropcap {
  float: left;
  font-size: 5rem;
  line-height: 4rem;
  padding-top: 4px;
  padding-right: 8px;
  padding-left: 3px;
  font-weight: 700;
  color: #6C97B1;
}

.filler-blocks {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin: 2rem 0;
}

.filler-paragraph {
  height: 20px;
  background: linear-gradient(90deg, transparent 0%, rgba(128,128,128,0.1) 50%, transparent 100%);
  background-size: 200% 100%;
  animation: loading-shimmer 2s infinite;
  border-radius: 4px;
}

.filler-paragraph:nth-child(2) { width: 85%; }
.filler-paragraph:nth-child(3) { width: 92%; }
.filler-paragraph:nth-child(4) { width: 78%; }
.filler-paragraph:nth-child(5) { width: 60%; }

@keyframes loading-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Loader */
.reader-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
  gap: 1.5rem;
}

.loader-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(108, 151, 177, 0.2);
  border-top-color: #6C97B1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Error State */
.reader-error {
  text-align: center;
  padding: 5rem 0;
}

.reader-error i {
  font-size: 4rem;
  color: #ef4444;
  margin-bottom: 1rem;
}

.back-link {
  background: #6C97B1;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: 600;
  margin-top: 1rem;
}

/* Footer Mobile */
.reader-footer {
  display: none;
  height: 4px;
  width: 100%;
  background: rgba(0,0,0,0.05);
}

.pdf-embed-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
}

.pdf-embed-wrapper embed {
  flex: 1;
  min-height: 80vh;
}

@media (max-width: 768px) {
  .reader-header {
    padding: 0 1rem;
  }
  
  .header-center {
    display: none;
  }
  
  .book-title {
    max-width: 150px;
  }
  
  .reader-content {
    padding: 2rem 1.5rem;
  }
}
</style>
