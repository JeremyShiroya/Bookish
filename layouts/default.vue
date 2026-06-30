<template>
  <div class="app-layout">
    <Sidebar />
    <main class="main-content">
      <MobileTopNav v-if="showsProfileTopNav" />
      <div class="page-container" :class="{ 'has-profile-top-nav': showsProfileTopNav }">
        <slot />
      </div>
      <PlayingBar />
      <MobileBottomNav />
    </main>
  </div>
</template>

<script setup>
import Sidebar from '~/components/desktop/Sidebar.vue'
import MobileBottomNav from '~/components/mobile/MobileBottomNav.vue'
import MobileTopNav from '~/components/mobile/MobileTopNav.vue'
import PlayingBar from '~/components/shared/PlayingBar.vue'

const route = useRoute()

const showsProfileTopNav = computed(() => {
  if (route.path === '/') return true
  return route.path === '/books'
    || route.path === '/series'
    || route.path === '/playlists'
    || route.path === '/favourites'
    || route.path.startsWith('/playlist/')
    || route.path.startsWith('/playlists/')
})
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
    padding: calc(1rem + env(safe-area-inset-top)) 0px 1.125rem;
    padding-bottom: calc(88px + env(safe-area-inset-bottom));
  }

  .page-container.has-profile-top-nav {
    padding-top: calc(4.85rem + env(safe-area-inset-top));
  }

  :deep(.sidebar),
  :deep(.playing-bar) {
    display: none;
  }
}
</style>
