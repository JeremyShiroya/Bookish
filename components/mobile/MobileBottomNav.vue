<template>
  <nav class="mobile-bottom-nav" aria-label="Primary mobile navigation">
    <NuxtLink
      v-for="item in items"
      :key="item.path"
      :to="item.path"
      class="mobile-nav-item"
      :class="{ active: isActive(item) }"
    >
      <i :class="item.icon"></i>
      <span>{{ item.label }}</span>
    </NuxtLink>
  </nav>
</template>

<script setup>
import { useRoute } from "vue-router";

const route = useRoute();

const items = [
  { label: "Home", path: "/", icon: "ri-home-smile-2-line" },
  { label: "Books", path: "/books", icon: "ri-book-open-line" },
  { label: "Series", path: "/series", icon: "ri-book-shelf-line" },
  { label: "Favourites", path: "/favourites", icon: "ri-heart-line" },
  { label: "Playlists", path: "/playlists", icon: "ri-play-list-2-line" },
];

const isActive = (item) => {
  if (item.path === "/") return route.path === "/";
  return route.path.startsWith(item.path);
};
</script>

<style scoped>
.mobile-bottom-nav {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1100;
  display: none;
  height: var(--mobile-bottom-nav-height);
  padding: 0 12px env(safe-area-inset-bottom);
  grid-template-columns: repeat(5, minmax(0, 1fr));
  align-items: center;
  background: var(--color-background-app);
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
}

.mobile-nav-item {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: var(--mobile-bottom-nav-height);
  margin: 0 4px;
  border-radius: var(--mobile-control-radius);
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: var(--mobile-caption-size);
  line-height: 1;
}

.mobile-nav-item i {
  font-size: var(--mobile-icon-size);
  line-height: 1;
}

.mobile-nav-item.active {
  color: var(--color-brand-primary);
}

.mobile-nav-item.active i {
  font-size: var(--mobile-active-icon-size);
}

@media (width <= 768px) {
  .mobile-bottom-nav {
    display: grid;
  }
}

@media (max-width: 480px) {
  .mobile-nav-item {
    font-size: var(--mobile-tiny-size);
  }
}
</style>
