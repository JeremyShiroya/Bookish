<template>
  <div class="home-skeleton" aria-hidden="true">
    <div class="sk-header">
      <span class="sk-block sk-title"></span>
      <span class="sk-block sk-link"></span>
    </div>

    <div class="sk-recent-row">
      <div v-for="item in 3" :key="`recent-${item}`" class="sk-recent-card">
        <span class="sk-block sk-recent-icon"></span>
        <span class="sk-block sk-recent-text"></span>
        <span class="sk-block sk-recent-button"></span>
      </div>
    </div>

    <div class="sk-main-row">
      <section class="sk-popular-column">
        <span class="sk-block sk-section-title"></span>
        <div class="sk-book-grid">
          <div v-for="item in 4" :key="`popular-${item}`" class="sk-book-card">
            <span class="sk-block sk-book-cover"></span>
            <span class="sk-block sk-book-title"></span>
            <span class="sk-block sk-book-meta"></span>
          </div>
        </div>
      </section>

      <section class="sk-authors-column">
        <span class="sk-block sk-section-title"></span>
        <div class="sk-author-panel">
          <div v-for="item in 4" :key="`author-${item}`" class="sk-author-row">
            <span class="sk-block sk-avatar"></span>
            <div class="sk-author-copy">
              <span class="sk-block sk-author-name"></span>
              <span class="sk-block sk-author-count"></span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.home-skeleton {
  --sk-base: #eef1f5;
  --sk-mid: #f8fafc;
  --sk-border: rgba(226, 232, 240, 0.86);
  width: 100%;
  padding: 0.5rem;
}

.sk-block {
  position: relative;
  display: block;
  overflow: hidden;
  background: linear-gradient(135deg, var(--sk-base), var(--sk-mid));
  border: 1px solid var(--sk-border);
  border-radius: 6px;
}

.sk-block::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-120%);
  background: linear-gradient(100deg, transparent 26%, rgba(255, 255, 255, 0.55) 50%, transparent 74%);
  animation: sk-shimmer 2.2s ease-in-out infinite;
  pointer-events: none;
}

@keyframes sk-shimmer {
  0% { transform: translateX(-120%); }
  55%, 100% { transform: translateX(120%); }
}

.sk-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.sk-title {
  width: 150px;
  height: 18px;
}

.sk-link {
  width: 74px;
  height: 14px;
}

.sk-recent-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 2rem;
  margin-bottom: 2.5rem;
}

.sk-recent-card {
  height: 58px;
  border: 1px solid var(--sk-border);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.46);
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0 1rem;
}

.sk-recent-icon {
  width: 22px;
  height: 18px;
  border-radius: 5px;
  flex-shrink: 0;
}

.sk-recent-text {
  width: min(46%, 150px);
  height: 18px;
}

.sk-recent-button {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  margin-left: auto;
}

.sk-main-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  margin-bottom: 6rem;
}

.sk-popular-column {
  grid-column: span 2;
}

.sk-authors-column {
  grid-column: span 1;
}

.sk-section-title {
  width: 132px;
  height: 18px;
  margin-bottom: 1.5rem;
}

.sk-book-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2rem;
}

.sk-book-card {
  display: grid;
  grid-template-columns: 110px 1fr;
  column-gap: 1.5rem;
  row-gap: 0.75rem;
  min-height: 165px;
}

.sk-book-cover {
  grid-row: span 3;
  width: 110px;
  height: 165px;
  border-radius: 8px;
}

.sk-book-title {
  width: min(78%, 190px);
  height: 20px;
  margin-top: 0.25rem;
}

.sk-book-meta {
  width: min(52%, 140px);
  height: 14px;
}

.sk-author-panel {
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid var(--sk-border);
  border-radius: 20px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.sk-author-row {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.sk-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sk-author-copy {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.sk-author-name {
  width: min(72%, 150px);
  height: 16px;
}

.sk-author-count {
  width: min(44%, 90px);
  height: 13px;
}

@media (max-width: 1024px) {
  .sk-recent-row,
  .sk-main-row,
  .sk-book-grid {
    grid-template-columns: 1fr;
  }

  .sk-popular-column,
  .sk-authors-column {
    grid-column: auto;
  }
}

@media (max-width: 640px) {
  .sk-book-card {
    grid-template-columns: 92px 1fr;
  }

  .sk-book-cover {
    width: 92px;
    height: 138px;
  }
}
</style>
