<template>
  <main class="settings-detail-page">
    <SettingsStoragePanel />
  </main>
</template>

<script setup>
import SettingsStoragePanel from '~/components/shared/SettingsStoragePanel.vue'
</script>

<style scoped>
.settings-detail-page {
  width: 100%;
  min-width: 0;
}
</style>
