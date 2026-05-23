<template>
  <div class="skeleton" :class="`skeleton-${variant}`" aria-hidden="true">
    <template v-if="variant === 'home'">
      <section class="home-recent">
        <div class="sk-line section-title"></div>
        <div class="recent-grid">
          <div v-for="item in 3" :key="`recent-${item}`" class="recent-card sk-card dark-card">
            <div class="cover cover-raised sk-surface"></div>
            <div class="recent-copy">
              <div class="sk-line light wide"></div>
              <div class="sk-line light medium"></div>
            </div>
            <div class="round-control sk-surface light"></div>
          </div>
        </div>
      </section>

      <section class="home-lower">
        <div class="popular-column">
          <div class="sk-line section-title"></div>
          <div class="popular-grid">
            <div v-for="item in 4" :key="`popular-${item}`" class="popular-row">
              <div class="cover cover-book sk-surface"></div>
              <div class="copy-stack">
                <div class="sk-line title-line"></div>
                <div class="sk-line short"></div>
                <div class="sk-line paragraph"></div>
                <div class="sk-line paragraph medium"></div>
              </div>
              <div class="round-control purple sk-surface"></div>
            </div>
          </div>
        </div>

        <div class="authors-column">
          <div class="sk-line section-title"></div>
          <div class="authors-panel">
            <div v-for="item in 4" :key="`home-author-${item}`" class="author-row">
              <div class="avatar sk-surface"></div>
              <div class="copy-stack">
                <div class="sk-line medium"></div>
                <div class="sk-line short muted"></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>

    <template v-else-if="variant === 'books-grid'">
      <div class="books-grid">
        <div v-for="item in count" :key="item" class="book-card-skeleton dark-card">
          <div class="cover cover-book sk-surface light"></div>
          <div class="book-copy">
            <div class="sk-line light title-line"></div>
            <div class="sk-line light medium"></div>
            <div class="sk-line light short"></div>
            <div class="genre-chip sk-surface light"></div>
            <div class="meta-row">
              <div class="meta-pill sk-surface light"></div>
              <div class="meta-pill sk-surface light"></div>
              <div class="meta-pill sk-surface light"></div>
            </div>
            <div class="action-row">
              <div class="square-control sk-surface light"></div>
              <div class="square-control sk-surface light"></div>
              <div class="square-control sk-surface light"></div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="variant === 'authors-grid'">
      <div class="authors-grid">
        <div v-for="item in count" :key="item" class="author-card-skeleton">
          <div class="avatar avatar-large sk-surface"></div>
          <div class="sk-line author-name"></div>
          <div class="sk-line author-count muted"></div>
        </div>
      </div>
    </template>

    <template v-else-if="variant === 'favourites-grid'">
      <div class="favourites-grid">
        <div v-for="item in count" :key="item" class="favourite-card-skeleton">
          <div class="cover cover-favourite sk-surface"></div>
          <div class="sk-line wide"></div>
          <div class="sk-line medium muted"></div>
        </div>
      </div>
    </template>

    <template v-else-if="variant === 'form'">
      <div class="form-shell">
        <div class="form-media">
          <div class="form-cover sk-surface"></div>
          <div class="document-row">
            <div class="square-control sk-surface"></div>
            <div class="copy-stack">
              <div class="sk-line medium"></div>
              <div class="sk-line short muted"></div>
            </div>
          </div>
        </div>
        <div class="form-fields">
          <div class="metadata-callout">
            <div class="square-control purple sk-surface"></div>
            <div class="copy-stack">
              <div class="sk-line medium"></div>
              <div class="sk-line wide muted"></div>
            </div>
            <div class="button-block sk-surface"></div>
          </div>
          <div class="form-row">
            <div class="input-group"><div class="label-line sk-surface"></div><div class="input-block sk-surface"></div></div>
            <div class="input-group"><div class="label-line sk-surface"></div><div class="input-block sk-surface"></div></div>
          </div>
          <div class="input-group"><div class="label-line sk-surface"></div><div class="textarea-block sk-surface"></div></div>
          <div class="form-row">
            <div class="input-group"><div class="label-line sk-surface"></div><div class="input-block sk-surface"></div></div>
            <div class="input-group"><div class="label-line sk-surface"></div><div class="input-block sk-surface"></div></div>
          </div>
          <div class="form-row">
            <div class="input-group"><div class="label-line sk-surface"></div><div class="input-block sk-surface"></div></div>
            <div class="input-group"><div class="label-line sk-surface"></div><div class="input-block sk-surface"></div></div>
          </div>
          <div class="form-action sk-surface"></div>
        </div>
      </div>
    </template>

    <template v-else-if="variant === 'metadata'">
      <div class="metadata-list">
        <div v-for="item in 3" :key="item" class="metadata-row">
          <div class="cover cover-meta sk-surface"></div>
          <div class="copy-stack">
            <div class="sk-line title-line"></div>
            <div class="sk-line medium muted"></div>
            <div class="sk-line short muted"></div>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="variant === 'toc'">
      <div class="toc-list">
        <div v-for="item in count" :key="item" class="toc-row">
          <div class="toc-num sk-surface"></div>
          <div class="sk-line toc-title"></div>
        </div>
      </div>
    </template>

    <template v-else-if="variant === 'author-detail'">
      <div class="author-detail-shell">
        <aside class="author-detail-sidebar">
          <div class="avatar avatar-profile sk-surface"></div>
          <div class="sk-line profile-name"></div>
          <div class="stat-row">
            <div class="stat-block sk-surface"></div>
            <div class="stat-block sk-surface"></div>
          </div>
          <div class="bio-card">
            <div class="sk-line medium"></div>
            <div class="sk-line wide muted"></div>
            <div class="sk-line wide muted"></div>
            <div class="sk-line short muted"></div>
          </div>
        </aside>
        <main class="author-detail-main">
          <div class="sk-line section-title"></div>
          <div class="books-grid">
            <div v-for="item in 4" :key="item" class="book-card-skeleton dark-card">
              <div class="cover cover-book sk-surface light"></div>
              <div class="book-copy">
                <div class="sk-line light title-line"></div>
                <div class="sk-line light medium"></div>
                <div class="meta-row">
                  <div class="meta-pill sk-surface light"></div>
                  <div class="meta-pill sk-surface light"></div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </template>

    <template v-else-if="variant === 'pdf'">
      <div class="pdf-page-skeleton">
        <div class="pdf-top-lines">
          <div class="sk-line long"></div>
          <div class="sk-line medium"></div>
        </div>
        <div class="pdf-cover sk-surface"></div>
        <div class="pdf-bottom-lines">
          <div class="sk-line wide"></div>
          <div class="sk-line long"></div>
          <div class="sk-line short"></div>
        </div>
      </div>
    </template>

    <template v-else-if="variant === 'reader'">
      <div class="reader-page-skeleton">
        <div class="sk-line section-title"></div>
        <div class="sk-line wide"></div>
        <div class="sk-line wide"></div>
        <div class="sk-line long"></div>
        <div class="paragraph-gap"></div>
        <div class="sk-line wide"></div>
        <div class="sk-line medium"></div>
      </div>
    </template>

    <template v-else>
      <div class="lines-list">
        <div v-for="item in count" :key="item" class="toc-row">
          <div class="sk-line wide"></div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
defineProps({
  variant: { type: String, default: 'lines' },
  count: { type: Number, default: 6 },
})
</script>

<style scoped>
.skeleton {
  --sk-base: #eef1f5;
  --sk-mid: #f8fafc;
  --sk-hi: #ffffff;
  --sk-edge: rgba(226, 232, 240, 0.86);
  --sk-accent: #e8ecf2;
  width: 100%;
  color: transparent;
}

.sk-surface,
.sk-line,
.dark-card,
.recent-card,
.author-card-skeleton,
.authors-panel,
.form-shell,
.metadata-row,
.bio-card,
.pdf-page-skeleton,
.reader-page-skeleton {
  position: relative;
  overflow: hidden;
}

.sk-surface,
.sk-line,
.recent-card,
.author-card-skeleton,
.authors-panel,
.form-shell,
.metadata-row,
.bio-card,
.pdf-page-skeleton,
.reader-page-skeleton {
  background: linear-gradient(135deg, var(--sk-base), var(--sk-mid));
  border: 1px solid var(--sk-edge);
}

.dark-card {
  background: rgba(255, 255, 255, 0.48);
  border: 1px solid var(--sk-edge);
}

.sk-surface::after,
.sk-line::after,
.recent-card::after,
.author-card-skeleton::after,
.authors-panel::after,
.form-shell::after,
.metadata-row::after,
.bio-card::after,
.pdf-page-skeleton::after,
.reader-page-skeleton::after,
.dark-card::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-120%);
  background: linear-gradient(100deg, transparent 25%, rgba(255, 255, 255, 0.42) 48%, transparent 72%);
  animation: skeleton-shimmer 2.4s ease-in-out infinite;
  pointer-events: none;
}

.light::after,
.dark-card::after {
  background: linear-gradient(100deg, transparent 25%, rgba(255, 255, 255, 0.5) 48%, transparent 72%);
}

@keyframes skeleton-shimmer {
  0% { transform: translateX(-120%); }
  52%, 100% { transform: translateX(120%); }
}

.sk-line {
  height: 0.78rem;
  border-radius: 999px;
}

.sk-line.light {
  background: linear-gradient(135deg, var(--sk-base), var(--sk-mid));
  border-color: var(--sk-edge);
}

.section-title {
  width: 11rem;
  height: 1.2rem;
  margin-bottom: 1rem;
}

.title-line { height: 1rem; width: 82%; }
.wide { width: 100%; }
.long { width: 78%; }
.medium { width: 58%; }
.short { width: 34%; }
.muted { opacity: 0.72; }

.copy-stack {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.home-recent {
  margin-bottom: 2.5rem;
}

.recent-grid {
  display: flex;
  gap: 2rem;
  overflow: hidden;
  padding: 2.5rem 0.5rem 0.5rem;
}

.recent-card {
  position: relative;
  flex: 1;
  min-width: 280px;
  height: 130px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  padding: 1.25rem 3.75rem 1.25rem 130px;
}

.cover {
  flex-shrink: 0;
  border-radius: 8px;
}

.cover-raised {
  position: absolute;
  left: 15px;
  bottom: 10px;
  width: 95px;
  height: 145px;
  border-radius: 10px;
}

.cover-book {
  width: 110px;
  aspect-ratio: 2 / 3;
}

.cover-favourite {
  width: 100%;
  aspect-ratio: 7 / 10;
  border-radius: 8px;
}

.cover-meta {
  width: 70px;
  height: 105px;
  border-radius: 6px;
}

.round-control {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  position: absolute;
  right: 15px;
}

.round-control.purple,
.square-control.purple {
  background: linear-gradient(135deg, var(--sk-base), var(--sk-mid));
  border-color: var(--sk-edge);
}

.home-lower {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2rem;
  padding: 0 0.5rem;
}

.popular-grid,
.books-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(320px, 1fr));
  gap: 2rem;
}

.popular-row {
  position: relative;
  display: flex;
  gap: 1.5rem;
  min-height: 165px;
}

.popular-row .round-control {
  top: 0;
  right: 0;
  width: 32px;
  height: 32px;
}

.authors-panel {
  border-radius: 20px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  background: #ffffff;
  box-shadow: 0 10px 30px -18px rgba(0, 0, 0, 0.12);
}

.author-row {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  flex-shrink: 0;
}

.avatar-large {
  width: 120px;
  height: 120px;
}

.avatar-profile {
  width: 180px;
  height: 180px;
}

.book-card-skeleton {
  min-height: 190px;
  border-radius: 16px;
  padding: 1.25rem;
  display: flex;
  gap: 1.25rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.book-copy {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  flex: 1;
  min-width: 0;
}

.genre-chip {
  width: 96px;
  height: 1.35rem;
  border-radius: 4px;
  margin-top: 0.1rem;
}

.meta-row,
.action-row {
  display: flex;
  gap: 0.5rem;
}

.meta-row {
  margin-top: auto;
}

.meta-pill {
  width: 54px;
  height: 1.1rem;
  border-radius: 999px;
}

.square-control {
  width: 34px;
  height: 34px;
  border-radius: 8px;
}

.authors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 2rem;
}

.author-card-skeleton {
  min-height: 220px;
  border-radius: 16px;
  padding: 1.5rem;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
}

.author-name { width: 70%; }
.author-count { width: 42%; }

.favourites-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 200px);
  gap: 1.5rem;
}

.favourite-card-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-shell {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 3rem;
  background: #ffffff;
  border-radius: 20px;
  padding: 2.5rem;
  box-shadow: 0 10px 30px -18px rgba(0, 0, 0, 0.16);
}

.form-media,
.form-fields {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-cover {
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: 12px;
  border-style: dashed;
}

.document-row,
.metadata-callout {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.metadata-callout {
  background: rgba(255, 255, 255, 0.54);
  border-color: var(--sk-edge);
}

.button-block {
  width: 128px;
  height: 42px;
  border-radius: 8px;
  margin-left: auto;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.label-line {
  width: 110px;
  height: 0.85rem;
  border-radius: 999px;
}

.input-block {
  height: 48px;
  border-radius: 10px;
}

.textarea-block {
  height: 124px;
  border-radius: 10px;
}

.form-action {
  align-self: flex-end;
  width: 170px;
  height: 48px;
  border-radius: 10px;
  margin-top: 1rem;
}

.metadata-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
}

.metadata-row {
  display: flex;
  gap: 1.5rem;
  padding: 1rem;
  border-radius: 12px;
  background: #ffffff;
}

.toc-list,
.lines-list {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.toc-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.toc-num {
  width: 26px;
  height: 0.75rem;
  border-radius: 999px;
  flex-shrink: 0;
}

.toc-title {
  width: min(72%, 180px);
}

.author-detail-shell {
  display: grid;
  grid-template-columns: 350px 1fr;
  min-height: 640px;
  background: #ffffff;
}

.author-detail-sidebar {
  padding: 3rem 2rem;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.profile-name {
  width: 72%;
  height: 1.35rem;
}

.stat-row {
  display: flex;
  gap: 1rem;
  margin: 0.4rem 0;
}

.stat-block {
  width: 70px;
  height: 42px;
  border-radius: 10px;
}

.bio-card {
  width: 100%;
  min-height: 180px;
  border-radius: 16px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  margin-top: 1rem;
}

.author-detail-main {
  padding: 3rem;
}

.pdf-page-skeleton,
.reader-page-skeleton {
  width: min(100%, 760px);
  min-height: 560px;
  border-radius: 3px;
  padding: 4rem 4.5rem;
  margin: 0 auto;
  background: #ffffff;
  box-shadow: 0 2px 24px rgba(0, 0, 0, 0.1);
}

.pdf-page-skeleton {
  width: min(100%, 860px);
  min-height: 760px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.pdf-top-lines,
.pdf-bottom-lines {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.pdf-cover {
  width: 46%;
  aspect-ratio: 2 / 3;
  border-radius: 5px;
  margin: 3.25rem 0;
  background: linear-gradient(135deg, var(--sk-base), var(--sk-mid));
  border-color: var(--sk-edge);
}

.reader-page-skeleton {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.paragraph-gap {
  height: 1.5rem;
}

@media (max-width: 1024px) {
  .home-lower,
  .popular-grid,
  .books-grid,
  .author-detail-shell {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .recent-grid {
    flex-direction: column;
    padding-top: 1rem;
  }

  .form-shell,
  .form-row {
    grid-template-columns: 1fr;
  }

  .button-block,
  .form-action {
    margin-left: 0;
    width: 100%;
  }
}
</style>
