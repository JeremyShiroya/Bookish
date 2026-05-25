<template>
  <div class="skeleton" :class="`skeleton-${variant}`" aria-hidden="true">
    <template v-if="variant === 'home'">
      <HomeSkeleton />
    </template>

    <template v-else-if="variant === 'books-grid'">
      <div class="book-card-grid">
        <div v-for="item in count" :key="item" class="sk-card book-card">
          <span class="sk-block book-cover"></span>
          <div class="book-copy">
            <span class="sk-block line title"></span>
            <span class="sk-block line subtitle"></span>
            <div class="mini-row">
              <span class="sk-block mini-square"></span>
              <span class="sk-block mini-square"></span>
              <span class="sk-block mini-square"></span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="variant === 'authors-grid'">
      <div class="simple-grid author-grid">
        <div v-for="item in count" :key="item" class="author-card">
          <span class="sk-block avatar"></span>
          <span class="sk-block line author-name"></span>
          <span class="sk-block line author-count"></span>
        </div>
      </div>
    </template>

    <template v-else-if="variant === 'favourites-grid'">
      <div class="simple-grid favourite-grid">
        <div v-for="item in count" :key="item" class="favourite-card">
          <span class="sk-block favourite-cover"></span>
          <span class="sk-block line wide"></span>
          <span class="sk-block line half"></span>
        </div>
      </div>
    </template>

    <template v-else-if="variant === 'form'">
      <div class="form-layout">
        <div class="form-media">
          <span class="sk-block form-cover"></span>
          <span class="sk-card document-row"></span>
        </div>
        <div class="form-fields">
          <span class="sk-card metadata-callout"></span>
          <div class="field-row">
            <span class="sk-block field"></span>
            <span class="sk-block field"></span>
          </div>
          <span class="sk-block textarea"></span>
          <div class="field-row">
            <span class="sk-block field"></span>
            <span class="sk-block field"></span>
          </div>
          <div class="field-row">
            <span class="sk-block field"></span>
            <span class="sk-block field"></span>
          </div>
          <span class="sk-block action"></span>
        </div>
      </div>
    </template>

    <template v-else-if="variant === 'metadata'">
      <div class="list-stack">
        <div v-for="item in 3" :key="item" class="metadata-row">
          <span class="sk-block meta-cover"></span>
          <div class="metadata-copy">
            <span class="sk-block line wide"></span>
            <span class="sk-block line medium"></span>
            <span class="sk-block line short"></span>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="variant === 'toc'">
      <div class="toc-stack">
        <div v-for="item in count" :key="item" class="toc-row">
          <span class="sk-block toc-num"></span>
          <span class="sk-block line toc-title"></span>
        </div>
      </div>
    </template>

    <template v-else-if="variant === 'author-detail'">
      <div class="author-detail-layout">
        <aside class="author-side">
          <span class="sk-block profile-avatar"></span>
          <span class="sk-block line profile-name"></span>
          <span class="sk-block line profile-meta"></span>
          <span class="sk-card bio-block"></span>
        </aside>
        <main class="author-main">
          <div class="book-card-grid compact">
            <div v-for="item in 4" :key="item" class="sk-card book-card">
              <span class="sk-block book-cover"></span>
              <div class="book-copy">
                <span class="sk-block line title"></span>
                <span class="sk-block line subtitle"></span>
                <div class="mini-row">
                  <span class="sk-block mini-square"></span>
                  <span class="sk-block mini-square"></span>
                  <span class="sk-block mini-square"></span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </template>

    <template v-else-if="variant === 'pdf'">
      <div class="pdf-shell">
        <span class="sk-block pdf-line long"></span>
        <span class="sk-block pdf-line medium"></span>
        <span class="sk-block pdf-page"></span>
      </div>
    </template>

    <template v-else-if="variant === 'reader'">
      <div class="reader-shell">
        <span class="sk-block reader-page"></span>
      </div>
    </template>

    <template v-else>
      <div class="list-stack">
        <span v-for="item in count" :key="item" class="sk-block line wide"></span>
      </div>
    </template>
  </div>
</template>

<script setup>
import HomeSkeleton from './HomeSkeleton.vue';

defineProps({
  variant: { type: String, default: 'lines' },
  count: { type: Number, default: 12 },
})
</script>

<style scoped>
.skeleton {
  width: 100%;
}

.sk-block {
  display: block;
  background: linear-gradient(
    90deg,
    var(--skeleton-color, var(--color-skeleton-base)) 25%,
    var(--skeleton-shimmer, var(--color-skeleton-shimmer)) 37%,
    var(--skeleton-color, var(--color-skeleton-base)) 63%
  );
  background-size: 400% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
  border-radius: 6px;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

/* --- BOOKS GRID SKELETON (Glassmorphic Dark Card) --- */
.skeleton-books-grid {
  --skeleton-color: var(--color-skeleton-inverse-base);
  --skeleton-shimmer: var(--color-skeleton-inverse-shimmer);
}

.skeleton-books-grid .book-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 2rem;
}

.skeleton-books-grid .book-card {
  background: var(--color-background-overlay-strong);
  backdrop-filter: blur(20px);
  border: 1px solid var(--color-border-on-image);
  border-radius: 16px;
  box-shadow: var(--shadow-card-subtle);
  padding: 1.25rem;
  display: flex;
  flex-direction: row;
  gap: 1.25rem;
  min-height: unset;
}

.skeleton-books-grid .book-cover {
  width: 110px;
  aspect-ratio: 2 / 3;
  height: auto;
  border-radius: 8px;
  flex-shrink: 0;
}

.skeleton-books-grid .book-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 5px;
  flex: 1;
}

.skeleton-books-grid .line.title {
  width: 70%;
  height: 18px;
}

.skeleton-books-grid .line.subtitle {
  width: 45%;
  height: 14px;
}

.skeleton-books-grid .mini-row {
  display: flex;
  gap: 10px;
  margin-top: auto;
  border-top: 1px solid var(--color-border-on-image);
  padding-top: 0.75rem;
}

.skeleton-books-grid .mini-square {
  width: 34px;
  height: 34px;
  border-radius: 8px;
}

/* --- AUTHORS GRID SKELETON (White Rounded Card) --- */
.skeleton-authors-grid .author-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 2rem;
}

.skeleton-authors-grid .author-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1.5rem;
  background: var(--color-surface-primary);
  border-radius: 1rem;
  border: 1px solid var(--border-color, var(--color-border-subtle));
  min-height: unset;
  box-shadow: var(--shadow-card-subtle);
  gap: 1rem;
}

.skeleton-authors-grid .avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
}

.skeleton-authors-grid .author-name {
  width: 70%;
  height: 16px;
}

.skeleton-authors-grid .author-count {
  width: 40%;
  height: 12px;
}

/* --- FAVOURITES GRID SKELETON (Vertical Aspect Card) --- */
.skeleton-favourites-grid .favourite-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 200px);
  gap: 1.5rem;
  justify-content: start;
}

.skeleton-favourites-grid .favourite-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 200px;
}

.skeleton-favourites-grid .favourite-cover {
  aspect-ratio: 7 / 10;
  width: 100%;
  border-radius: 0.5rem;
  box-shadow: var(--shadow-card-subtle);
}

.skeleton-favourites-grid .line.wide {
  width: 80%;
  height: 14px;
}

.skeleton-favourites-grid .line.half {
  width: 50%;
  height: 12px;
}

@media (max-width: 480px) {
  .skeleton-favourites-grid .favourite-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .skeleton-favourites-grid .favourite-card {
    width: 100%;
  }
}

/* --- FORM SKELETON --- */
.form-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 2.5rem;
}

.form-media,
.form-fields {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-cover {
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: 8px;
}

.skeleton-form .sk-card.document-row,
.skeleton-form .sk-card.metadata-callout {
  height: 76px;
  background: var(--color-surface-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  animation: none;
  position: relative;
  overflow: hidden;
  box-shadow: var(--shadow-card-subtle);
}

.skeleton-form .sk-card.document-row::after,
.skeleton-form .sk-card.metadata-callout::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 20px;
  transform: translateY(-50%);
  height: 12px;
  width: 45%;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    var(--skeleton-color) 25%,
    var(--skeleton-shimmer) 37%,
    var(--skeleton-color) 63%
  );
  background-size: 400% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

.field-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.skeleton-form .field {
  height: 48px;
  border-radius: 8px;
  background: var(--color-surface-primary);
  border: 1px solid var(--border-color);
  animation: none;
  position: relative;
  overflow: hidden;
}

.skeleton-form .textarea {
  height: 132px;
  border-radius: 8px;
  background: var(--color-surface-primary);
  border: 1px solid var(--border-color);
  animation: none;
  position: relative;
  overflow: hidden;
}

.skeleton-form .field::after,
.skeleton-form .textarea::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 16px;
  transform: translateY(-50%);
  height: 12px;
  width: 50%;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    var(--skeleton-color) 25%,
    var(--skeleton-shimmer) 37%,
    var(--skeleton-color) 63%
  );
  background-size: 400% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

.skeleton-form .textarea::after {
  top: 18px;
  transform: none;
  width: 75%;
}

.skeleton-form .action {
  align-self: flex-end;
  width: 172px;
  height: 48px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--color-brand-primary-faint) 0%, var(--color-brand-primary-faint) 100%);
  border: 1px solid var(--color-brand-primary-faint);
  animation: none;
  position: relative;
  overflow: hidden;
}

.skeleton-form .action::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 25%,
    var(--color-brand-primary-faint) 37%,
    transparent 63%
  );
  background-size: 400% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

/* --- METADATA & TOC STACK --- */
.list-stack,
.toc-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.metadata-row {
  display: grid;
  grid-template-columns: 70px 1fr;
  gap: 1rem;
  align-items: center;
}

.meta-cover {
  width: 70px;
  height: 104px;
  border-radius: 4px;
}

.metadata-copy {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toc-row {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 10px;
  align-items: center;
}

.toc-num {
  width: 28px;
  height: 12px;
  border-radius: 999px;
}

.toc-title {
  width: min(72%, 190px);
  height: 12px;
}

/* --- AUTHOR DETAIL SKELETON (Split view matching styling) --- */
.skeleton-author-detail .author-detail-layout {
  display: grid;
  grid-template-columns: 350px 1fr;
  margin: -2.5rem;
  width: calc(100% + 5rem);
  min-height: 100vh;
}

.skeleton-author-detail .author-side {
  background: var(--color-surface-primary);
  padding: 3rem 2rem;
  box-shadow: var(--shadow-card-subtle);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  height: 100vh;
  position: sticky;
  top: 0;
}

.skeleton-author-detail .profile-avatar {
  width: 180px;
  height: 180px;
  border-radius: 50%;
  padding: 6px;
  background: var(--color-surface-primary);
  box-shadow: var(--shadow-brand-glow);
  flex-shrink: 0;
}

.skeleton-author-detail .profile-name {
  width: 70%;
  height: 20px;
}

.skeleton-author-detail .profile-meta {
  width: 44%;
  height: 14px;
}

.skeleton-author-detail .bio-block {
  width: 100%;
  height: 180px;
  border-radius: 16px;
  border: 1px solid var(--color-border-subtle);
  background: var(--color-surface-secondary);
  animation: none;
  position: relative;
  overflow: hidden;
}

.skeleton-author-detail .bio-block::after {
  content: '';
  position: absolute;
  top: 15px;
  left: 15px;
  right: 15px;
  height: 12px;
  background: linear-gradient(
    90deg,
    var(--skeleton-color) 25%,
    var(--skeleton-shimmer) 37%,
    var(--skeleton-color) 63%
  );
  background-size: 400% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
  box-shadow: 0 20px 0 var(--skeleton-color), 0 40px 0 var(--skeleton-color);
  border-radius: 4px;
}

.skeleton-author-detail .author-main {
  padding: 2rem 3rem;
}

.skeleton-author-detail .book-card-grid.compact {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 2rem;
}

.skeleton-author-detail .book-card {
  background: var(--color-background-overlay-strong);
  backdrop-filter: blur(20px);
  border: 1px solid var(--color-border-on-image);
  border-radius: 16px;
  box-shadow: var(--shadow-card-subtle);
  padding: 1.25rem;
  display: flex;
  flex-direction: row;
  gap: 1.25rem;
  min-height: unset;
  --skeleton-color: var(--color-skeleton-inverse-base);
  --skeleton-shimmer: var(--color-skeleton-inverse-shimmer);
}

.skeleton-author-detail .book-cover {
  width: 110px;
  aspect-ratio: 2 / 3;
  height: auto;
  border-radius: 8px;
  flex-shrink: 0;
}

.skeleton-author-detail .book-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 5px;
  flex: 1;
}

.skeleton-author-detail .line.title {
  width: 70%;
  height: 18px;
}

.skeleton-author-detail .line.subtitle {
  width: 45%;
  height: 14px;
}

.skeleton-author-detail .mini-row {
  display: flex;
  gap: 10px;
  margin-top: auto;
  border-top: 1px solid var(--color-border-on-image);
  padding-top: 0.75rem;
}

.skeleton-author-detail .mini-square {
  width: 34px;
  height: 34px;
  border-radius: 8px;
}

/* --- PDF & READER SHELLS --- */
.pdf-shell,
.reader-shell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  width: 100%;
}

.pdf-line {
  height: 14px;
}

.pdf-line.long {
  width: min(70%, 520px);
}

.pdf-line.medium {
  width: min(48%, 360px);
}

.pdf-page,
.reader-page {
  width: min(100%, 760px);
  height: 620px;
  border-radius: 4px;
  box-shadow: var(--shadow-card-subtle);
  background: var(--color-surface-primary);
  border: 1px solid var(--border-color);
  animation: none;
  position: relative;
  overflow: hidden;
}

.reader-page {
  height: 520px;
}

.pdf-page::after,
.reader-page::after {
  content: '';
  position: absolute;
  top: 40px;
  left: 40px;
  right: 40px;
  height: 16px;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    var(--skeleton-color) 25%,
    var(--skeleton-shimmer) 37%,
    var(--skeleton-color) 63%
  );
  background-size: 400% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
  box-shadow:
    0 28px 0 var(--skeleton-color),
    0 56px 0 var(--skeleton-color),
    0 84px 0 var(--skeleton-color),
    0 112px 0 var(--skeleton-color),
    0 140px 0 var(--skeleton-color),
    0 168px 0 var(--skeleton-color),
    0 196px 0 var(--skeleton-color),
    0 224px 0 var(--skeleton-color),
    0 252px 0 var(--skeleton-color),
    0 280px 0 var(--skeleton-color);
}

@media (max-width: 1024px) {
  .skeleton-author-detail .author-detail-layout {
    grid-template-columns: 1fr;
  }
  .skeleton-author-detail .author-side {
    position: relative;
    height: auto;
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
  }
}

@media (max-width: 1280px) {
  .skeleton-books-grid .book-card-grid {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  }
}

@media (max-width: 980px) {
  .skeleton-books-grid .book-card-grid,
  .skeleton-author-detail .book-card-grid.compact,
  .form-layout {
    grid-template-columns: 1fr;
  }

  .field-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .skeleton-form .action {
    width: 100%;
  }
}
</style>
