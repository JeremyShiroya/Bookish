<template>
  <NuxtLayout>
    <NuxtPage />
    <ToastComp />
    <DevicePermissionModal />
    <AppUpdateModal />
    <!-- First boot only: picks which formats the app handles at all, before the
         device scan has imported anything. -->
    <FormatChoiceModal v-if="showFormatChoice" @done="showFormatChoice = false" />
  </NuxtLayout>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import AppUpdateModal from '~/components/shared/AppUpdateModal.vue'
import DevicePermissionModal from '~/components/shared/DevicePermissionModal.vue'
import FormatChoiceModal from '~/components/shared/FormatChoiceModal.vue'
import ToastComp from '~/components/shared/ToastComp.vue'
import { useFormatEnablement } from '~/composables/useFormatEnablement'

// Read on the client only: settings come from localStorage, so deciding on the
// server would render the modal for everyone and then flash it away.
const showFormatChoice = ref(false)

onMounted(() => {
  const { needsFormatChoice } = useFormatEnablement()
  showFormatChoice.value = needsFormatChoice.value
})
</script>
