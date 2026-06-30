<template>
  <main class="settings-detail-page">
    <MobileSettingsNav title="Audio" back-to="/settings" aria-label="Settings navigation" />
    <SettingsAudioPanel />
  </main>
</template>

<script setup>
import MobileSettingsNav from '~/components/mobile/MobileSettingsNav.vue'
import SettingsAudioPanel from '~/components/shared/SettingsAudioPanel.vue'
</script>

<style scoped>
.settings-detail-page {
  width: 100%;
  min-width: 0;
}
</style>
