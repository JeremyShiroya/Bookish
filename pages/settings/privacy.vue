<template>
  <MobileSettingsNav title="Privacy Policy" back-to="/settings" aria-label="Settings navigation" />
  <main class="privacy-page">
    <article class="policy-card" aria-labelledby="privacy-title">
      <p class="lede">
        Pages is a local-first reading application. Your library lives on your own device, there
        are no user accounts, and Pages does not sell, rent, or trade any information about you.
        This policy explains exactly what data Pages handles, where it goes, and the choices you
        have.
      </p>

      <section>
        <h2>1. Data stored on your device</h2>
        <p>
          Everything you create in Pages is stored locally on the device you use it on, in browser
          storage (IndexedDB and localStorage) or the app's private storage on mobile. This includes:
        </p>
        <ul>
          <li>Books you upload (EPUB, PDF, and text files) and their extracted reading content;</li>
          <li>Book records: titles, authors, covers, series, genres, descriptions, and ratings;</li>
          <li>Playlists, favourites, collections, reading progress, and reading status;</li>
          <li>Audio (text-to-speech) session state, such as the last position narrated;</li>
          <li>Your settings, including theme, narrator voice, playback speed, and library layout;</li>
          <li>Your local profile name and avatar, if you set one.</li>
        </ul>
        <p>
          This data never leaves your device unless you explicitly export it or a feature described
          below requires a network request. Pages has no server-side copy of your library.
        </p>
      </section>

      <section>
        <h2>2. Text-to-speech narration</h2>
        <p>
          When you use the Listen feature, the sentences being narrated are sent to Microsoft's
          Read&nbsp;Aloud text-to-speech service to generate audio. Only the text of the passage being
          read is transmitted — never your identity, your library, or your reading history. Microsoft's
          handling of that text is governed by
          <a href="https://privacy.microsoft.com/privacystatement" target="_blank" rel="noopener">Microsoft's Privacy Statement</a>.
          If you do not use Listen, no book text is ever transmitted.
        </p>
      </section>

      <section>
        <h2>3. Metadata, cover, and author-image lookups</h2>
        <p>
          Metadata search runs only when you press a search button — it never runs automatically in
          the background. When you request it, Pages queries public book-information sources with
          the title, author, or publisher you typed (and nothing else). Depending on the search,
          those sources may include: Goodreads, Google Books, Google Images, Kobo, Open Library,
          Internet Archive, Bing Images, DuckDuckGo, Wikipedia, Wikidata, Wikimedia Commons, and
          public publisher websites. Each provider receives an ordinary web request containing your
          search terms and your device's network address (IP), as with any website visit, under that
          provider's own privacy policy.
        </p>
        <p>
          Returned details and images are saved into your local library only when you choose to
          apply them.
        </p>
      </section>

      <section>
        <h2>4. Optional self-hosted server</h2>
        <p>
          You may connect the app to your own Pages server (Settings → Storage → Server
          connection). When configured, metadata and image searches are performed by that server on
          your behalf instead of directly from the device. Pages only communicates with the server
          address you enter, and you can remove it at any time.
        </p>
      </section>

      <section>
        <h2>5. Analytics</h2>
        <p>
          The hosted web version of Pages may collect anonymous, aggregated page-view analytics
          (via Vercel Web Analytics) to understand overall usage. These analytics do not use cookies,
          do not identify you, and do not include the contents of your library.
          <strong>The installed mobile app collects no analytics at all.</strong>
        </p>
      </section>

      <section>
        <h2>6. What Pages does not do</h2>
        <ul>
          <li>No accounts, sign-ups, passwords, or profiles stored on our systems;</li>
          <li>No selling, renting, or sharing of personal data with third parties for marketing;</li>
          <li>No advertising and no advertising trackers;</li>
          <li>No reading of your files beyond what is needed to display and narrate them;</li>
          <li>No background transmission of your library, notes, or reading habits.</li>
        </ul>
      </section>

      <section>
        <h2>7. Your control: export, import, and deletion</h2>
        <p>
          From Settings → Storage you can export your full library as a backup file, import a
          backup, and permanently wipe all Pages data from the device. Because all data is local,
          uninstalling the app or clearing browser site data also removes your library entirely.
          Deletion is immediate and irreversible — there is no server copy to purge.
        </p>
      </section>

      <section>
        <h2>8. Data security</h2>
        <p>
          Your library is protected by your device's own security (device lock, browser sandboxing,
          and app sandboxing on mobile). All network requests Pages makes use encrypted HTTPS
          connections where the provider supports them. Because data is stored locally, anyone with
          access to your unlocked device profile can access your Pages library — please secure
          your device accordingly.
        </p>
      </section>

      <section>
        <h2>9. Children's privacy</h2>
        <p>
          Pages does not knowingly collect personal information from anyone, including children.
          Since no data is transmitted to us, there is nothing for us to collect, retain, or delete
          on a child's behalf.
        </p>
      </section>

      <section>
        <h2>10. Your rights</h2>
        <p>
          Depending on where you live (for example under the GDPR or CCPA), you may have rights to
          access, correct, delete, or port your personal data. Pages' design satisfies these by
          default: all of your data is already in your hands, exportable at any time from Settings →
          Storage, and deletable in full from the same page.
        </p>
      </section>

      <section>
        <h2>11. Changes to this policy</h2>
        <p>
          If Pages' data practices change, this policy will be updated and the effective date
          above revised. Material changes will be noted in the app's release notes. Continued use of
          Pages after an update constitutes acceptance of the revised policy.
        </p>
      </section>

      <section>
        <h2>12. Contact</h2>
        <p>
          Questions or concerns about privacy in Pages can be raised on the project's GitHub
          repository at
          <a href="https://github.com/JeremyShiroya/Pages" target="_blank" rel="noopener">github.com/JeremyShiroya/Pages</a>.
        </p>
        <p class="policy-meta">Effective date: 3 July 2026 · Applies to the Pages web app and the Pages mobile app.</p>
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
  max-width: 560px;
  margin: 0 auto;
  padding: 0 22px 34px;
  color: var(--color-text-primary);
}

.policy-card {
  line-height: 1.6;
}

h2,
p,
ul {
  margin: 0;
}

.policy-meta {
  margin-top: 8px;
  color: var(--color-text-muted);
  font-size: 12.5px;
  letter-spacing: 0.01em;
}

.lede {
  /* margin-top: 14px; */
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
  font-size: 16.5px;
  font-weight: 550;
}

section p {
  margin-top: 7px;
  color: var(--color-text-secondary);
  font-size: 14.5px;
}

section ul {
  margin-top: 8px;
  padding-left: 20px;
  color: var(--color-text-secondary);
  font-size: 14.5px;
  display: grid;
  gap: 5px;
}

a {
  color: var(--color-brand-primary);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}
</style>
