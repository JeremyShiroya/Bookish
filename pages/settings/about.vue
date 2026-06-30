<template>
  <main class="about-page">
    <MobileSettingsNav title="About" back-to="/settings" aria-label="Settings navigation" />

    <section class="about-card" aria-labelledby="about-title">
      <img src="/Images/Logo.png" alt="Bookish" class="about-logo" />

      <p class="eyebrow">About Bookish</p>
      <h1 id="about-title">A private shelf for reading and listening.</h1>

      <div class="about-copy">
        <p>
          <strong>Bookish</strong> is a local-first library for keeping books, favourites,
          playlists, reading status, and read-aloud sessions together in one calm workspace.
        </p>
        <p>
          It is built for readers who want their collection to feel personal without needing an
          account or cloud sync. Your day-to-day library data stays in this browser unless you
          choose to export it.
        </p>
        <p>
          Use Bookish to add books, group series, track what you are reading, listen from the
          player, and carry your backup with you through Storage import and export.
        </p>
      </div>

      <div class="about-facts" aria-label="App details">
        <div>
          <span>Version</span>
          <strong>{{ appVersion }}</strong>
        </div>
        <div>
          <span>Build</span>
          <strong>{{ buildNumber }}</strong>
        </div>
      </div>

      <h2>Built around control</h2>
      <p class="closing-copy">
        Bookish keeps library management, listening defaults, and storage tools visible so you can
        shape the app around your own reading habits.
      </p>
    </section>
  </main>
</template>

<script setup>
import MobileSettingsNav from '~/components/mobile/MobileSettingsNav.vue'

const runtimeConfig = useRuntimeConfig()
const appVersion = runtimeConfig.public.appVersion || '0.0.0'
const buildNumber = runtimeConfig.public.buildNumber || 'dev'
</script>

<style scoped>
.about-page {
  width: 100%;
  max-width: 520px;
  margin: 0 auto;
  padding: 0 10px 22px;
  color: var(--color-text-primary);
}

.about-card {
  line-height: 1.55;
}

.about-logo {
  width: 54px;
  height: 54px;
  margin-bottom: 18px;
  border-radius: 14px;
  object-fit: cover;
}

.eyebrow,
h1,
h2,
p {
  margin: 0;
}

.eyebrow {
  color: var(--color-brand-primary-hover);
  font-size: 13px;
  font-weight: 500;
}

h1 {
  margin-top: 6px;
  color: var(--color-text-primary);
  font-size: 24px;
  font-weight: 500;
  line-height: 1.18;
}

.about-copy {
  margin-top: 18px;
  color: var(--color-text-secondary);
  font-size: 15px;
}

.about-copy p + p {
  margin-top: 14px;
}

strong {
  color: var(--color-brand-primary);
  font-weight: 500;
}

.about-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 24px 0;
}

.about-facts div {
  border: 1px solid var(--color-border-subtle);
  border-radius: 14px;
  padding: 14px;
  background: var(--color-surface-card);
}

.about-facts span,
.about-facts strong {
  display: block;
}

.about-facts span {
  color: var(--color-text-muted);
  font-size: 12px;
}

.about-facts strong {
  margin-top: 3px;
  color: var(--color-text-primary);
  font-size: 17px;
}

h2 {
  margin-top: 4px;
  font-size: 18px;
  font-weight: 500;
}

.closing-copy {
  margin-top: 8px;
  color: var(--color-text-secondary);
  font-size: 15px;
  line-height: 1.55;
}
</style>
