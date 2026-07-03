<template>
  <nav class="nav" :aria-label="ariaLabel">
    <div class="left" role="button" tabindex="0" aria-label="Go back" @click="goBack" @keydown.enter="goBack">
      <i class="ri-arrow-left-line"></i>
    </div>

    <div class="center">
      <h3 :title="pageTitle">{{ compactPageTitle }}</h3>
    </div>

    <div class="right" aria-hidden="true">
      <i class="ri-arrow-left-line"></i>
    </div>
  </nav>
</template>

<script setup>
const props = defineProps({
  title: {
    type: String,
    default: '',
  },
  backTo: {
    type: String,
    default: '/settings',
  },
  ariaLabel: {
    type: String,
    default: 'Page navigation',
  },
})

const route = useRoute()
const router = useRouter()

const pageTitle = computed(() => {
  if (props.title) return props.title

  const titles = {
    '/settings': 'Settings',
    '/settings/storage': 'Storage',
    '/settings/about': 'About',
    '/settings/privacy': 'Privacy Policy',
  }

  if (titles[route.path]) return titles[route.path]

  const fallback = route.path.split('/').filter(Boolean).pop() || 'settings'
  return fallback.charAt(0).toUpperCase() + fallback.slice(1)
})

const formatLongTitle = (value) => {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim()
  if (normalized.length <= 42) return normalized
  return `${normalized.slice(0, 39).trimEnd()}...`
}

const compactPageTitle = computed(() => formatLongTitle(pageTitle.value))

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
    return
  }

  router.push(props.backTo)
}
</script>

<style scoped>
.nav {
  display: none;
}

@media (width <= 768px) {
  .nav {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) 44px;
    align-items: center;
    padding: 0 16px;
    min-height: 70px;
    color: var(--color-text-primary);
    font-family: var(--mobile-font-family);
  }

  .left {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    width: 44px;
    height: 44px;
    font-size: 20px;
    line-height: 1;
  }

  .left:focus-visible {
    outline: 2px solid var(--color-brand-primary);
    outline-offset: 4px;
  }

  .center {
    min-width: 0;
    text-align: center;
  }

  h3 {
    overflow: hidden;
    margin: 0;
    max-width: 100%;
    font-size: 20px;
    font-weight: 400;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .right {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    width: 44px;
    height: 44px;
    opacity: 0;
    font-size: 20px;
    line-height: 1;
  }
}
</style>
