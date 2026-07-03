<template>
  <main class="settings-detail-page">
    <MobileSettingsNav title="Storage" back-to="/settings" aria-label="Settings navigation" />
    <ResponsiveViewSwitch>
      <template #mobile>
        <SettingsStorageMobile />
      </template>
      <template #desktop>
        <SettingsStoragePanel />
      </template>
    </ResponsiveViewSwitch>
  </main>
</template>

<script setup>
import MobileSettingsNav from '~/components/mobile/MobileSettingsNav.vue'
import SettingsStorageMobile from '~/components/mobile/SettingsStorageMobile.vue'
import ResponsiveViewSwitch from '~/components/shared/ResponsiveViewSwitch.vue'
import SettingsStoragePanel from '~/components/shared/SettingsStoragePanel.vue'
</script>

<style scoped>
.settings-detail-page {
  width: 100%;
  min-width: 0;
}
</style>
