<template>
  <div>
    <HomeComp v-if="!showBooks" @show-all="toggleView" />
    <BooksComp v-else @back="toggleView" />
  </div>
</template>

<script setup>
import { ref } from 'vue';

const showBooks = ref(false);

const toggleView = () => {
  showBooks.value = !showBooks.value;
};
</script>