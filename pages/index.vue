<template>
  <div>
    <HomeComp v-if="!showBooks" @show-all="toggleView" />
    <BooksComp v-else @back="toggleView" />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import BooksComp from '~/components/shared/BooksComp.vue'
import HomeComp from '~/components/shared/HomeComp.vue'

const showBooks = ref(false);

const toggleView = () => {
  showBooks.value = !showBooks.value;
};
</script>
