<template>
  <main class="about-page">
    <section class="about-card" aria-labelledby="about-title">
      <img src="/Images/Logo.png" alt="Bookish" class="about-logo" />
      <p class="eyebrow">About Bookish</p>
      <h1 id="about-title">Bookish</h1>
      <p class="lede">
        Bookish is a local-first reading library for collecting books, tracking reading progress,
        building playlists, and listening to read-aloud sessions from the same shelf.
      </p>

      <dl class="about-details">
        <div>
          <dt>Version</dt>
          <dd>{{ appVersion }}</dd>
        </div>
        <div>
          <dt>Build</dt>
          <dd>{{ buildNumber }}</dd>
        </div>
        <div>
          <dt>Storage</dt>
          <dd>Browser-local library data and reading content</dd>
        </div>
      </dl>

      <div class="about-section">
        <h2>What it does</h2>
        <p>
          Bookish keeps your book records, playlists, favourites, metadata, reading status,
          and player preferences together in one private workspace on this device.
        </p>
      </div>

      <div class="about-section">
        <h2>Data portability</h2>
        <p>
          Use Settings > Storage to export, import, or wipe your Bookish library whenever you need
          to move browsers or reset the app.
        </p>
      </div>
    </section>
  </main>
</template>

<script setup>
const runtimeConfig = useRuntimeConfig()
const appVersion = runtimeConfig.public.appVersion || '0.0.0'
const buildNumber = runtimeConfig.public.buildNumber || 'dev'
</script>

<style scoped>
.about-page {
  width: 100%;
  min-width: 0;
}

.about-card {
  padding: 1.5rem;
  border: 1px solid var(--color-border-card);
  border-radius: 10px;
  background: var(--color-surface-card);
  color: var(--color-text-primary);
}

.about-logo {
  width: 42px;
  height: 42px;
  object-fit: cover;
  margin-bottom: 0.9rem;
}

.eyebrow {
  margin: 0 0 0.35rem;
  color: var(--color-brand-primary-hover);
  font-size: 0.82rem;
}

h1,
h2,
p,
dl {
  margin: 0;
}

h1 {
  font-size: 1.8rem;
  color: var(--color-text-primary);
}

.lede {
  max-width: 720px;
  margin-top: 0.8rem;
  color: var(--color-text-muted);
  line-height: 1.55;
}

.about-details {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 1.4rem;
}

.about-details div,
.about-section {
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  padding: 1rem;
}

dt {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

dd {
  margin: 0.2rem 0 0;
  color: var(--color-text-primary);
}

.about-section {
  margin-top: 1rem;
}

.about-section h2 {
  margin-bottom: 0.4rem;
  font-size: 1rem;
}

.about-section p {
  color: var(--color-text-muted);
  line-height: 1.55;
}

@media (max-width: 760px) {
  .about-details {
    grid-template-columns: 1fr;
  }
}
</style>
