<template>
  <NuxtLayout>
    <NuxtPage />
    <ToastComp />
    <DevicePermissionModal />
  </NuxtLayout>
</template>

<script setup>
import DevicePermissionModal from '~/components/shared/DevicePermissionModal.vue'
import ToastComp from '~/components/shared/ToastComp.vue'
</script>
