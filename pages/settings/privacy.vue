<template>
  <MobileSettingsNav title="Privacy Policy" back-to="/settings" aria-label="Settings navigation" />
  <main class="privacy-page">

    <article class="policy-card" aria-labelledby="privacy-title">
      <h2>Your library data is yours.</h2>
      <p class="lede">
        Bookish is designed as a local-first reading app. The records you create are stored in this
        browser and stay under your control.
      </p>

      <section>
        <h2>What Bookish Stores</h2>
        <p>
          Book records, covers, playlists, favourites, reading status, audio session state, and
          settings are saved locally through browser storage and IndexedDB.
        </p>
      </section>

      <section>
        <h2>Metadata Lookups</h2>
        <p>
          When you choose to fetch metadata, Bookish may request public book details from lookup
          providers. Those results are used to help fill your local book fields.
        </p>
      </section>

      <section>
        <h2>Imports And Exports</h2>
        <p>
          Storage exports are generated in your browser as backup files. Imports restore data into
          this browser, and wipe removes the local Bookish copy after confirmation.
        </p>
      </section>

      <section>
        <h2>Your Control</h2>
        <p>
          You can export, import, refresh storage status, or wipe local data from the Storage page.
          Clearing browser data may also remove your Bookish library from this device.
        </p>
      </section>
    </article>
  </main>
</template>

<script setup>
import MobileSettingsNav from '~/components/mobile/MobileSettingsNav.vue'
</script>

<style scoped>
.privacy-page {
  width: 100%;
  max-width: 520px;
  margin: 0 auto;
  padding: 0 22px 22px;
  color: var(--color-text-primary);
}

.policy-card {
  line-height: 1.55;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  margin-top: 6px;
  color: var(--color-text-primary);
  font-size: 24px;
  font-weight: 500;
  line-height: 1.18;
}

.lede {
  margin-top: 12px;
  color: var(--color-text-secondary);
  font-size: 15px;
}

section {
  padding: 18px 0;
  border-bottom: 1px solid var(--color-border-subtle);
}

section:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

h2 {
  color: var(--color-text-primary);
  font-size: 17px;
  font-weight: 500;
}

section p {
  margin-top: 7px;
  color: var(--color-text-secondary);
  font-size: 15px;
}
</style>
