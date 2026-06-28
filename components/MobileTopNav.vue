<template>
  <header class="mobile-top-nav">
    <div class="streak-pill" title="Reading streak">
      <i class="ri-fire-line"></i>
      <span>{{ streakCount }}</span>
    </div>

    <button
      class="mobile-menu-button"
      type="button"
      title="Open menu"
      @click="menuOpen = true"
    >
      <i class="ri-menu-line"></i>
    </button>

    <div v-if="menuOpen" class="mobile-menu-panel">
      <div class="mobile-menu-scrim" @click="menuOpen = false"></div>
      <nav class="mobile-menu-sheet" aria-label="Mobile menu">
        <button
          class="mobile-menu-close"
          type="button"
          title="Close menu"
          @click="menuOpen = false"
        >
          <i class="ri-close-line"></i>
        </button>
        <NuxtLink to="/" @click="menuOpen = false">Home</NuxtLink>
        <NuxtLink to="/books" @click="menuOpen = false">Books</NuxtLink>
        <NuxtLink to="/series" @click="menuOpen = false">Series</NuxtLink>
        <NuxtLink to="/authors" @click="menuOpen = false">Authors</NuxtLink>
        <NuxtLink to="/playlists" @click="menuOpen = false">Playlists</NuxtLink>
        <NuxtLink to="/favourites" @click="menuOpen = false">Favourites</NuxtLink>
        <NuxtLink to="/settings" @click="menuOpen = false">Settings</NuxtLink>
      </nav>
    </div>
  </header>
</template>

<script setup>
import { ref } from 'vue'
import { useStreak } from '~/composables/useStreak'

const menuOpen = ref(false)
const { streakCount } = useStreak()
</script>

<style scoped>
.mobile-top-nav {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 1100;
  display: none;
  height: 58px;
  align-items: center;
  justify-content: space-between;
  padding: calc(10px + env(safe-area-inset-top)) 22px 8px;
  background: var(--color-background-app);
}

.streak-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-width: 42px;
  color: var(--color-text-primary);
  font-size: 0.95rem;
  line-height: 1;
}

.streak-pill i {
  font-size: 1.05rem;
}

.mobile-menu-button,
.mobile-menu-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text-primary);
  cursor: pointer;
}

.mobile-menu-button {
  width: 36px;
  height: 36px;
  font-size: 1.62rem;
}

.mobile-menu-panel {
  position: fixed;
  inset: 0;
  z-index: 1200;
}

.mobile-menu-scrim {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.28);
}

.mobile-menu-sheet {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  width: min(280px, 78vw);
  height: 100%;
  flex-direction: column;
  gap: 2px;
  padding: calc(18px + env(safe-area-inset-top)) 18px 18px;
  background: var(--color-background-app);
  box-shadow: -20px 0 40px rgba(15, 23, 42, 0.14);
}

.mobile-menu-sheet a,
.mobile-menu-close {
  min-height: 42px;
  border-radius: 8px;
  color: var(--color-text-primary);
  text-decoration: none;
  font-size: 0.95rem;
}

.mobile-menu-sheet a {
  display: flex;
  align-items: center;
  padding: 0 10px;
}

.mobile-menu-sheet a.router-link-active {
  background: var(--color-brand-primary-faint);
  color: var(--color-brand-primary);
}

.mobile-menu-close {
  width: 42px;
  margin-bottom: 10px;
  font-size: 1.35rem;
}

@media (max-width: 768px) {
  .mobile-top-nav {
    display: flex;
  }
}
</style>
