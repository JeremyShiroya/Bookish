<template>
  <ResponsiveViewSwitch>
    <template #mobile>
      <HomeMobile />
    </template>
    <template #desktop>
      <HomeDesktop />
    </template>
  </ResponsiveViewSwitch>
</template>

<script setup>
import HomeDesktop from '../desktop/HomeDesktop.vue'
import HomeMobile from '../mobile/HomeMobile.vue'
import ResponsiveViewSwitch from './ResponsiveViewSwitch.vue'
</script>
