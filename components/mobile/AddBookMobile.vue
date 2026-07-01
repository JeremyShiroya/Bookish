<template>
  <main class="mobile-book-form-page">
    <MobileSettingsNav title="Add Book" back-to="/books" aria-label="Book form navigation" />
    <AddBookComp />
  </main>
</template>

<script setup>
import AddBookComp from '~/components/shared/AddBookComp.vue'
import MobileSettingsNav from './MobileSettingsNav.vue'
</script>

<style scoped>
.mobile-book-form-page {
  width: 100%;
  min-height: 100vh;
  padding-bottom: calc(var(--mobile-bottom-nav-height, 72px) + env(safe-area-inset-bottom));
  background: var(--color-background-app);
}
</style>
