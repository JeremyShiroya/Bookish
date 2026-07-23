<template>
  <main class="settings-detail-page">
    <MobileSettingsNav title="Connection test" back-to="/settings" aria-label="Settings navigation" />
    <div class="connection-body">
      <ConnectionTestPanel />
    </div>
  </main>
</template>

<script setup>
import MobileSettingsNav from '~/components/mobile/MobileSettingsNav.vue'
import ConnectionTestPanel from '~/components/shared/ConnectionTestPanel.vue'
</script>

<style scoped>
.settings-detail-page {
  width: 100%;
  min-width: 0;
}

.connection-body {
  padding: 0 var(--mobile-page-padding-inline, 16px)
    calc(var(--mobile-bottom-nav-height, 72px) + env(safe-area-inset-bottom));
}
</style>
