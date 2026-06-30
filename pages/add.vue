<template>
  <MobileSettingsNav title="Add Book" back-to="/books" aria-label="Book form navigation" />
  <AddBookComp />
</template>

<script setup>
import MobileSettingsNav from '~/components/mobile/MobileSettingsNav.vue'
import AddBookComp from '~/components/shared/AddBookComp.vue'
</script>
