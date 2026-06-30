<template>
  <main class="privacy-page">
    <section class="privacy-card" aria-labelledby="privacy-title">
      <div class="privacy-heading">
        <i class="ri-shield-keyhole-line"></i>
        <div>
          <p class="eyebrow">Privacy Policy</p>
          <h1 id="privacy-title">Your library stays on this device.</h1>
        </div>
      </div>

      <div class="policy-section">
        <h2>Local data</h2>
        <p>
          Bookish stores your library records, playlists, favourites, reading content, progress,
          audio session state, and settings in this browser's local storage and IndexedDB.
        </p>
      </div>

      <div class="policy-section">
        <h2>Metadata lookups</h2>
        <p>
          When you choose metadata or author lookup actions, Bookish may request public book or
          author information from configured lookup services. Those requests are only used to fill
          your local library details.
        </p>
      </div>

      <div class="policy-section">
        <h2>Backups</h2>
        <p>
          Exports are generated in your browser as a JSON backup file. Imports replace the current
          browser copy after confirmation, and wiping storage removes local Bookish data from this browser.
        </p>
      </div>

      <div class="policy-section">
        <h2>Your control</h2>
        <p>
          Use Settings > Storage to export a copy of your library, import a backup, refresh local
          storage status, or wipe Bookish data from this browser.
        </p>
      </div>
    </section>
  </main>
</template>

<style scoped>
.privacy-page {
  width: 100%;
  min-width: 0;
}

.privacy-card {
  padding: 1.5rem;
  border: 1px solid var(--color-border-card);
  border-radius: 10px;
  background: var(--color-surface-card);
  color: var(--color-text-primary);
}

.privacy-heading {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border-subtle);
}

.privacy-heading > i {
  width: 46px;
  height: 46px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-brand-primary-muted);
  color: var(--color-brand-primary);
  font-size: 1.25rem;
  flex-shrink: 0;
}

.eyebrow,
h1,
h2,
p {
  margin: 0;
}

.eyebrow {
  color: var(--color-brand-primary-hover);
  font-size: 0.82rem;
}

h1 {
  margin-top: 0.25rem;
  color: var(--color-text-primary);
  font-size: 1.45rem;
}

.policy-section {
  padding: 1rem 0;
  border-bottom: 1px solid var(--color-border-subtle);
}

.policy-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.policy-section h2 {
  margin-bottom: 0.35rem;
  color: var(--color-text-primary);
  font-size: 1rem;
}

.policy-section p {
  max-width: 760px;
  color: var(--color-text-muted);
  line-height: 1.55;
}

@media (max-width: 760px) {
  .privacy-card {
    padding: 16px;
    border-radius: var(--mobile-card-radius);
  }

  .privacy-heading {
    align-items: flex-start;
    gap: 12px;
    padding-bottom: 16px;
  }

  .privacy-heading > i {
    width: var(--mobile-list-icon-size);
    height: var(--mobile-list-icon-size);
    font-size: var(--mobile-icon-size);
  }

  .eyebrow,
  .policy-section p {
    font-size: var(--mobile-subtext-size);
  }

  h1 {
    font-size: var(--mobile-title-size);
    line-height: 1.2;
  }

  .policy-section {
    padding: 16px 0;
  }

  .policy-section h2 {
    margin-bottom: 6px;
    font-size: var(--mobile-section-title-size);
    line-height: 1.25;
  }

  .policy-section p {
    line-height: 1.45;
  }
}
</style>
