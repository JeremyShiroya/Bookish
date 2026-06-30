<template>
  <slot v-if="isMobile" name="mobile"></slot>
  <slot v-else name="desktop"></slot>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  breakpoint: {
    type: String,
    default: '(max-width: 768px)',
  },
})

const isMobile = ref(false)
let mediaQuery = null

const syncViewport = () => {
  isMobile.value = Boolean(mediaQuery?.matches)
}

onMounted(() => {
  mediaQuery = window.matchMedia(props.breakpoint)
  syncViewport()
  mediaQuery.addEventListener('change', syncViewport)
})

onBeforeUnmount(() => {
  mediaQuery?.removeEventListener('change', syncViewport)
  mediaQuery = null
})
</script>
