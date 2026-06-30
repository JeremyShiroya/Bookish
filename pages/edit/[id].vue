<template>
  <MobileSettingsNav title="Edit Book" back-to="/books" aria-label="Book form navigation" />
  <EditBookComp :bookId="bookId" />
</template>

<script setup>
import MobileSettingsNav from '~/components/mobile/MobileSettingsNav.vue'
import EditBookComp from '~/components/shared/EditBookComp.vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const bookId = route.params.id
</script>
