<template>
  <ResponsiveViewSwitch>
    <template #mobile>
      <PlaylistsMobile />
    </template>
    <template #desktop>
      <PlaylistsDesktop />
    </template>
  </ResponsiveViewSwitch>
</template>

<script setup>
import PlaylistsDesktop from '../desktop/PlaylistsDesktop.vue'
import PlaylistsMobile from '../mobile/PlaylistsMobile.vue'
import ResponsiveViewSwitch from './ResponsiveViewSwitch.vue'
</script>
