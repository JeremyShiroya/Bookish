<template>
  <div class="reader-layout">
    <Sidebar />
    <div class="reader-main">
      <slot />
    </div>
    <PlayingBar />
  </div>
</template>

<script setup>
import Sidebar from '~/components/desktop/Sidebar.vue'
import PlayingBar from '~/components/shared/PlayingBar.vue'
</script>

<style scoped>
.reader-layout {
  min-height: 100vh;
  display: flex;
}

.reader-main {
  flex: 1;
  margin-left: var(--sidebar-width);
  min-height: 100vh;
  overflow-x: hidden;
  padding-bottom: 90px;
}
</style>
