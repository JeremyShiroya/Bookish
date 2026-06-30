<template>
  <ResponsiveViewSwitch>
    <template #mobile>
      <ProfileMobile />
    </template>
    <template #desktop>
      <ProfileDesktop />
    </template>
  </ResponsiveViewSwitch>
</template>

<script setup>
import ProfileDesktop from '~/components/desktop/ProfileDesktop.vue'
import ProfileMobile from '~/components/mobile/ProfileMobile.vue'
import ResponsiveViewSwitch from '~/components/shared/ResponsiveViewSwitch.vue'
</script>
