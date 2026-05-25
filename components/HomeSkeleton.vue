<template>
  <div class="home-skeleton" aria-hidden="true">
    <div class="recent-row">
      <span v-for="item in 3" :key="`recent-${item}`" class="sk-block recent-block"></span>
    </div>

    <div class="home-body">
      <!-- Popular Books Loader (matches popular-grid and popular-card) -->
      <section class="book-columns">
        <div v-for="item in 4" :key="`book-${item}`" class="book-row">
          <span class="sk-block cover-block"></span>
          <div class="line-stack">
            <span class="sk-block line title"></span>
            <span class="sk-block line author"></span>
            <span class="sk-block line blurb"></span>
            <span class="sk-block line blurb-short"></span>
          </div>
        </div>
      </section>

      <!-- Your Authors Loader (matches authors-list-card and author-list-item) -->
      <section class="author-panel">
        <div v-for="item in 4" :key="`author-${item}`" class="author-row">
          <span class="sk-block avatar-block"></span>
          <div class="author-info-stack">
            <span class="sk-block line author-name"></span>
            <span class="sk-block line author-count"></span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.home-skeleton {
  width: 100%;
}

.sk-block {
  display: block;
  background: linear-gradient(
    90deg,
    var(--skeleton-color) 25%,
    var(--skeleton-shimmer) 37%,
    var(--skeleton-color) 63%
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

.recent-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.75rem;
  margin-bottom: 2.25rem;
}

/* Glassmorphic Loader Card matching horizontal recent card */
.recent-block {
  background: var(--color-background-overlay-strong) !important;
  backdrop-filter: blur(20px);
  border: 1px solid var(--color-border-on-image);
  border-radius: 16px;
  height: 130px;
  box-shadow: var(--shadow-card-subtle);
  animation: none !important;
  position: relative;
  overflow: visible; /* Let cover pop out/bottom float if needed, but here simple matches shape */
}

.recent-block::before {
  content: '';
  position: absolute;
  left: 15px;
  bottom: 10px;
  width: 95px;
  height: 145px;
  border-radius: 10px;
  background: linear-gradient(
    90deg,
    var(--color-skeleton-inverse-base) 25%,
    var(--color-skeleton-inverse-shimmer) 37%,
    var(--color-skeleton-inverse-base) 63%
  );
  background-size: 400% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
  box-shadow: var(--shadow-control-subtle);
}

.recent-block::after {
  content: '';
  position: absolute;
  left: 130px;
  top: 50%;
  transform: translateY(-50%);
  height: 18px;
  width: 45%;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    var(--color-skeleton-inverse-base) 25%,
    var(--color-skeleton-inverse-shimmer) 37%,
    var(--color-skeleton-inverse-base) 63%
  );
  background-size: 400% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
  box-shadow: 0 24px 0 -3px var(--color-skeleton-inverse-base); /* represents sub-line */
}

.home-body {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2.25rem;
}

.book-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 2rem;
  row-gap: 2rem;
}

.book-row {
  display: flex;
  gap: 1.5rem;
  min-height: unset;
}

.cover-block {
  width: 110px;
  height: 165px;
  border-radius: 8px;
  flex-shrink: 0;
}

.line-stack {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 0.25rem;
  flex: 1;
}

.line {
  border-radius: 4px;
}

.line.title {
  width: 80%;
  height: 18px;
}

.line.author {
  width: 45%;
  height: 12px;
  margin-bottom: 0.5rem;
}

.line.blurb {
  width: 100%;
  height: 10px;
  opacity: 0.7;
}

.line.blurb-short {
  width: 65%;
  height: 10px;
  opacity: 0.7;
}

/* White panel matching Your Authors */
.author-panel {
  background: var(--surface-color);
  border-radius: 20px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  box-shadow: var(--shadow-form-shell);
  border: 1px solid var(--border-color);
  min-height: unset;
  animation: none !important;
}

.author-row {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.avatar-block {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  flex-shrink: 0;
}

.author-info-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.author-name {
  width: 65%;
  height: 14px;
}

.author-count {
  width: 35%;
  height: 10px;
}

@media (max-width: 1100px) {
  .recent-row,
  .home-body,
  .book-columns {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .recent-block {
    height: 110px;
  }
  .recent-block::before {
    width: 75px;
    height: 115px;
  }
  .recent-block::after {
    left: 105px;
    width: 50%;
  }
}
</style>
