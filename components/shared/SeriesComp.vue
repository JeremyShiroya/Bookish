<template>
  <ResponsiveViewSwitch>
    <template #mobile>
      <SeriesMobile />
    </template>
    <template #desktop>
      <SeriesDesktop />
    </template>
  </ResponsiveViewSwitch>
</template>

<script setup>
import SeriesDesktop from '../desktop/SeriesDesktop.vue'
import SeriesMobile from '../mobile/SeriesMobile.vue'
import ResponsiveViewSwitch from './ResponsiveViewSwitch.vue'
</script>
