<template>
  <main class="mobile-book-form-page">
    <MobileSettingsNav title="Edit Book" back-to="/books" aria-label="Book form navigation" />
    <EditBookComp :book-id="bookId" />
  </main>
</template>

<script setup>
import EditBookComp from '~/components/shared/EditBookComp.vue'
import MobileSettingsNav from './MobileSettingsNav.vue'

defineProps({
  bookId: {
    type: [String, Number],
    required: true,
  },
})
</script>

<style scoped>
.mobile-book-form-page {
  width: 100%;
  min-height: 100vh;
  padding-bottom: calc(var(--mobile-bottom-nav-height, 72px) + env(safe-area-inset-bottom));
  background: var(--color-background-app);
}
</style>
