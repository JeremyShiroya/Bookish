<template>
  <link
    href="https://cdn.jsdelivr.net/npm/remixicon@2.5.0/fonts/remixicon.css"
    rel="stylesheet"
  />
  <aside class="sidebar">
    <div class="top">
      <router-link to="/" class="brand-link">
        <div class="logo-container">
          <div class="logo">
            <img src="/Images/Logo.png" alt="Logo" class="logo-image" />
          </div>
          <h1 class="title">Bookish</h1>
        </div>
      </router-link>
    </div>
    <nav class="nav-menu" ref="navRef" @mouseleave="hoverIndex = -1">
      <div
        class="highlight-pill"
        :style="highlightStyle"
        :class="{ 'is-active': isHighlightActive }"
      ></div>

      <ul class="menu-list">
        <li v-for="(item, index) in menuItems" :key="item.name">
          <router-link
            :to="item.path"
            class="menu-item"
            :class="{ active: isMenuItemActive(index) }"
            active-class="active"
            @mouseenter="hoverIndex = index"
          >
            <i class="ri" :class="item.icon"></i>
            <span>{{ item.name }}</span>
          </router-link>
        </li>
      </ul>
      <!-- Settings at bottom -->
      <div class="settings">
        <router-link
          :to="settingsItem.path"
          class="menu-item"
          :class="{ active: isSettingsActive }"
          active-class="active"
          @mouseenter="hoverIndex = menuItems.length"
        >
          <i class="ri" :class="settingsItem.icon"></i>
          <span>{{ settingsItem.name }}</span>
        </router-link>
      </div>
    </nav>
  </aside>
</template>

<script setup>
import { computed, ref, onMounted, watch, nextTick } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const navRef = ref(null);

const menuItems = [
  { name: "Home", icon: "ri-home-smile-2-line", path: "/" },
  { name: "Books", icon: "ri-book-open-line", path: "/books" },
  { name: "Series", icon: "ri-book-shelf-line", path: "/series" },
  // { name: "Genres", icon: "ri-price-tag-3-line", path: "/genres" },
  { name: "Authors", icon: "ri-team-line", path: "/authors" },
  { name: "Playlists", icon: "ri-play-list-2-line", path: "/playlists" },
  { name: "Favourites", icon: "ri-heart-line", path: "/favourites" },
];

const settingsItem = {
  name: "Settings",
  icon: "ri-settings-3-line",
  path: "/settings",
};

const hoverIndex = ref(-1);
const highlightStyle = ref({ top: "0px", height: "0px", opacity: 0 });
const isHighlightActive = ref(false);

const getActiveRouteIndex = () => {
  if (route.path.startsWith("/settings")) return menuItems.length;
  if (route.path === "/") return 0;
  if (
    route.path === "/add" ||
    route.path.startsWith("/edit") ||
    route.path.startsWith("/reader")
  ) {
    return menuItems.findIndex((item) => item.path === "/books");
  }
  if (route.path.startsWith("/author/")) {
    return menuItems.findIndex((item) => item.path === "/authors");
  }
  if (route.path.startsWith("/playlist/")) {
    return menuItems.findIndex((item) => item.path === "/playlists");
  }
  if (route.path.startsWith("/serie/")) {
    return menuItems.findIndex((item) => item.path === "/series");
  }
  const idx = menuItems.findIndex(
    (item) => item.path !== "/" && route.path.startsWith(item.path),
  );
  return idx !== -1 ? idx : 0;
};

const isMenuItemActive = (index) => getActiveRouteIndex() === index;
const isSettingsActive = computed(() => getActiveRouteIndex() === menuItems.length);

const updateHighlight = async () => {
  await nextTick();
  if (!navRef.value) return;

  let targetIndex = hoverIndex.value;
  let isActive = false;

  const activeRouteIndex = getActiveRouteIndex();

  if (targetIndex === -1) {
    targetIndex = activeRouteIndex;
    isActive = true;
  } else if (targetIndex === activeRouteIndex) {
    isActive = true;
  }

  isHighlightActive.value = isActive;

  let targetEl;
  if (targetIndex >= 0 && targetIndex < menuItems.length) {
    const listEl = navRef.value.querySelector(".menu-list");
    if (listEl && listEl.children[targetIndex]) {
      targetEl = listEl.children[targetIndex];
    }
  } else if (targetIndex === menuItems.length) {
    targetEl = navRef.value.querySelector(".settings");
  }

  if (targetEl) {
    const itemEl = targetEl.querySelector(".menu-item") || targetEl;

    let currentEl = itemEl;
    let absoluteTop = 0;
    while (currentEl && currentEl !== navRef.value) {
      absoluteTop += currentEl.offsetTop;
      currentEl = currentEl.offsetParent;
    }

    highlightStyle.value = {
      top: `${absoluteTop}px`,
      height: `${itemEl.offsetHeight}px`,
      opacity: 1,
    };
  } else {
    highlightStyle.value.opacity = 0;
  }
};

onMounted(() => {
  // Slight delay to ensure fonts/layout are fully rendered
  setTimeout(updateHighlight, 100);
  window.addEventListener("resize", updateHighlight);
});

watch(() => route.path, updateHighlight);
watch(hoverIndex, updateHighlight);
</script>

<style scoped>
.sidebar {
  background-color: var(--purple-sidebar);
  width: var(--sidebar-width);
  height: calc(100vh - var(--layout-playing-bar-height));
  position: fixed;
  left: 0;
  top: 0;
  padding: 20px 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 100;
}

.top {
  display: flex;
  align-items: center;
  padding: 0 20px;
  margin-bottom: 10px;
}

.brand-link {
  color: var(--purple-logo);
  text-decoration: none;
}

.logo-container {
  display: flex;
  align-items: center;
}

.logo {
  width: 40px;
  height: 40px;
  overflow: hidden;
  margin-right: 10px;
}

.logo-image {
  width: 50px;
  height: 100%;
  object-fit: cover;
}

.title {
  font-size: 1.2rem;
  font-weight: 400;
}

.nav-menu {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  scrollbar-width: none;
  position: relative;
}

.nav-menu::-webkit-scrollbar {
  display: none;
}

.highlight-pill {
  position: absolute;
  left: 10px;
  right: 10px;
  border-radius: 10px;
  background-color: var(--purple-ul-hover);
  transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
  pointer-events: none;
  z-index: 0;
}

.highlight-pill.is-active {
  background-color: var(--purple-li-active);
}

.menu-list {
  list-style-type: none;
  padding: 0 10px;
  margin: 0;
}

.menu-item {
  position: relative;
  display: flex;
  align-items: center;
  padding: 15px 20px;
  text-decoration: none;
  color: var(--purple-li);
  font-weight: 400;
  border-radius: 10px;
  transition: color 0.3s ease;
  cursor: pointer;
  z-index: 1;
}

.menu-item.active {
  color: var(--color-brand-primary);
}

.menu-item i {
  margin-right: 10px;
  font-size: 20px;
}

.settings {
  margin-top: auto;
  padding: 10px;
  /* border-top: 1px solid var(--color-border-on-image); */
  position: relative;
}

@media (max-width: 768px) {
  .title {
    font-size: 1rem;
  }
}

@media screen and (max-width: 375px) {
  .sidebar {
    min-height: 100%;
  }

  .logo-image {
    width: 40px;
  }

  .title {
    font-size: 0.9rem;
  }
}
</style>
