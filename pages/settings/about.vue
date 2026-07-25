<template>
  <MobileSettingsNav title="About" back-to="/settings" aria-label="Settings navigation" />
  <main class="about-page">

    <section class="about-card" aria-labelledby="about-title">

      <div class="about-copy">

        <p>
          <strong>Pages</strong> is a private mobile library for readers who value simplicity, beautiful 
          design, and complete control. Keep your books, series, favourites, playlists, and reading 
          progress on your device, while enjoying natural read-aloud voices in a clean, intuitive reading experience.
        </p>

        <p>
          <strong>Pages</strong> was created by <strong>Jeremy Shiroya</strong>, a Kenya-based developer 
          and lifelong reader who believes reading apps should be simple, beautiful, and free. Inspired 
          by his own love of books, he built Pages to offer a clean, intuitive experience that puts books first. 
          Frustrated that many popular apps hide great features behind subscriptions while free 
          alternatives often compromise on design, Jeremy created Pages as a different kind of 
          reading app: thoughtfully designed, reader-first, and accessible to everyone. 
          Pages is a statement that enjoying books shouldn't come at a price. It continues to evolve 
          with new features for readers, and it always will be completely free to use.
        </p>

        <p>
          Special thanks to my love, <strong>Hope Makena Mutinda</strong>(Pending "Shiroya"), for her encouragement, thoughtful
          feedback, and dedicated beta testing throughout the development of Pages. Her support helped
          shape the app into what it is today.
        </p>
      </div>


      <p class="closing-copy">
        Pages is Built by a reader, for readers.
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
