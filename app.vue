<template>
  <NuxtLayout>
    <NuxtPage />
    <ToastComp />
    <DevicePermissionModal />
    <AppUpdateModal />
  </NuxtLayout>
</template>

<script setup>
import AppUpdateModal from '~/components/shared/AppUpdateModal.vue'
import DevicePermissionModal from '~/components/shared/DevicePermissionModal.vue'
import ToastComp from '~/components/shared/ToastComp.vue'
</script>
