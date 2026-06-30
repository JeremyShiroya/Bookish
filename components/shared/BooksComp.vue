<template>
  <ResponsiveViewSwitch>
    <template #mobile>
      <BooksMobile />
    </template>
    <template #desktop>
      <BooksDesktop />
    </template>
  </ResponsiveViewSwitch>
</template>

<script setup>
import BooksDesktop from '../desktop/BooksDesktop.vue'
import BooksMobile from '../mobile/BooksMobile.vue'
import ResponsiveViewSwitch from './ResponsiveViewSwitch.vue'
</script>
