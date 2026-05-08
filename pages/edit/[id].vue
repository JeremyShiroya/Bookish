<template>
  <EditBookComp :bookId="bookId" />
</template>

<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()
const bookId = route.params.id
</script>
