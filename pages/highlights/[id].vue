<template>
  <main class="annotation-page">
    <AnnotationListMobile mode="highlights" />
  </main>
</template>

<script setup>
// Deliberately NOT nested under /book/[id]: Nuxt treats `pages/book/[id].vue`
// plus a `pages/book/[id]/` directory as a parent route with children, so the
// child would only render inside a <NuxtPage /> the detail page does not have.
import AnnotationListMobile from '~/components/mobile/AnnotationListMobile.vue'
</script>

<style scoped>
.annotation-page {
  width: 100%;
  min-width: 0;
}
</style>
