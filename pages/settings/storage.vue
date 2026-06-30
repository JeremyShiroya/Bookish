<template>
  <main class="settings-detail-page">
    <MobileSettingsNav title="Storage" />
    <SettingsStoragePanel />
  </main>
</template>

<script setup>
import MobileSettingsNav from '~/components/mobile/MobileSettingsNav.vue'
import SettingsStoragePanel from '~/components/shared/SettingsStoragePanel.vue'
</script>

<style scoped>
.settings-detail-page {
  width: 100%;
  min-width: 0;
}
</style>
