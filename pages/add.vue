<template>
  <ResponsiveViewSwitch>
    <template #mobile>
      <component :is="mobilePageComponent" />
    </template>

    <template #desktop>
      <AddBookComp />
    </template>
  </ResponsiveViewSwitch>
</template>

<script setup>
import AddBookMobile from '~/components/mobile/AddBookMobile.vue'
import AddBookComp from '~/components/shared/AddBookComp.vue'
import ResponsiveViewSwitch from '~/components/shared/ResponsiveViewSwitch.vue'

const mobilePageComponent = AddBookMobile
</script>
