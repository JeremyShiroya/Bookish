<template>
  <nav class="nav" aria-label="Settings navigation">
    <div class="left" role="button" tabindex="0" aria-label="Go back" @click="goBack" @keydown.enter="goBack">
      <i class="ri-arrow-left-line"></i>
    </div>

    <div class="center">
      <h3>{{ pageTitle }}</h3>
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
})

const route = useRoute()
const router = useRouter()

const pageTitle = computed(() => {
  if (props.title) return props.title

  const titles = {
    '/settings': 'Settings',
    '/settings/audio': 'Audio',
    '/settings/storage': 'Storage',
    '/settings/about': 'About',
    '/settings/privacy': 'Privacy Policy',
  }

  if (titles[route.path]) return titles[route.path]

  const fallback = route.path.split('/').filter(Boolean).pop() || 'settings'
  return fallback.charAt(0).toUpperCase() + fallback.slice(1)
})

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
    return
  }

  router.push('/settings')
}
</script>

<style scoped>
.nav {
  display: none;
}

@media (width <= 768px) {
  .nav {
    display: flex;
    align-items: center;
    padding: 0 16px;
    min-height: 44px;
    color: var(--color-text-primary);
    font-family: var(--mobile-font-family);
  }

  .left {
    font-size: 20px;
    line-height: 1;
  }

  .left:focus-visible {
    outline: 2px solid var(--color-brand-primary);
    outline-offset: 4px;
  }

  .center {
    margin: 0 auto;
  }

  h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 400;
    line-height: 1.2;
  }

  .right {
    opacity: 0;
    font-size: 20px;
    line-height: 1;
  }
}
</style>
