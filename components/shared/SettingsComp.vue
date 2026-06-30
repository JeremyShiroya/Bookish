<template>
  <ResponsiveViewSwitch>
    <template #mobile>
      <SettingsMobile />
    </template>
    <template #desktop>
      <SettingsDesktop />
    </template>
  </ResponsiveViewSwitch>
</template>

<script setup>
import SettingsDesktop from '../desktop/SettingsDesktop.vue'
import SettingsMobile from '../mobile/SettingsMobile.vue'
import ResponsiveViewSwitch from './ResponsiveViewSwitch.vue'
</script>
