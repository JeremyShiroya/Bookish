<template>
  <div class="app-layout">
    <Sidebar />
    <main class="main-content">
      <div class="page-container">
        <slot />
      </div>
      <PlayingBar />
      <MobilePlayingBar />
    </main>
  </div>
</template>

<script setup>
import Sidebar from '~/components/desktop/Sidebar.vue'
import MobilePlayingBar from '~/components/mobile/MobilePlayingBar.vue'
import PlayingBar from '~/components/shared/PlayingBar.vue'
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
}

.main-content {
  transition: margin-left 0.3s ease;
  margin-left: var(--sidebar-width);
  background-color: var(--app);
  min-height: 100vh;
}

.page-container {
  padding: 2.5rem;
  padding-bottom: 120px; /* Account for PlayingBar (90px) + 30px breathing room */
}

@media (max-width: 768px) {
  .main-content {
    margin-left: 0;
  }

  .page-container {
    padding: 0;
  }

  :deep(.sidebar),
  :deep(.playing-bar) {
    display: none;
  }
}
</style>
