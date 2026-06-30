<template>
  <ResponsiveViewSwitch>
    <template #mobile>
      <FavouritesMobile />
    </template>
    <template #desktop>
      <FavouritesDesktop />
    </template>
  </ResponsiveViewSwitch>
</template>

<script setup>
import FavouritesDesktop from '../desktop/FavouritesDesktop.vue'
import FavouritesMobile from '../mobile/FavouritesMobile.vue'
import ResponsiveViewSwitch from './ResponsiveViewSwitch.vue'
</script>
