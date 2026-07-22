<template>
  <MobileSettingsNav title="About" back-to="/settings" aria-label="Settings navigation" />
  <main class="about-page">

    <section class="about-card" aria-labelledby="about-title">

      <div class="about-copy">
        <p>
          <strong>Pages</strong> is a local-first library for keeping books, favourites,
          playlists, reading status, and read-aloud sessions together in one calm workspace.
        </p>
        <p>
          It is built for readers who want their collection to feel personal without needing an
          account or cloud sync. Your day-to-day library data stays in this browser unless you
          choose to export it.
        </p>
        <p>
          Use Pages to add books, group series, track what you are reading, listen from the
          player, and carry your backup with you through Storage import and export.
        </p>

        <p>
          Special thanks to <strong>Hope Makena Mutinda</strong>, who served as a key source of inspiration and provided 
          invaluable support through beta testing and feedback during the creation of the project.
        </p>
      </div>

      <p class="closing-copy">
        Pages keeps library management, listening defaults, and storage tools visible so you can
        shape the app around your own reading habits.
      </p>
    </section>
  </main>
</template>

<script setup>
import MobileSettingsNav from '~/components/mobile/MobileSettingsNav.vue'
</script>

<style scoped>
.about-page {
  width: 100%;
  max-width: 520px;
  margin: 0 auto;
  padding: 0 20px 22px;
  color: var(--color-text-primary);
}

.about-card {
  line-height: 1.55;
}

p {
  margin: 0;
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

.closing-copy {
  margin-top: 8px;
  color: var(--color-text-secondary);
  font-size: 15px;
  line-height: 1.55;
}
</style>
