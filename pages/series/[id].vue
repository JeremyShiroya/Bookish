<template>
  <div class="series-redirect"></div>
</template>

<script setup>
const route = useRoute();

await navigateTo(`/serie/${route.params.id}`, { replace: true });
</script>
