<template>
  <div class="app-layout">
    <Sidebar />
    <main class="main-content">
      <div class="page-container">
        <slot />
      </div>
      <PlayingBar />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
}

.main-content {
  transition: margin-left 0.3s ease;
  margin-left: var(--sidebar-width);
  background-color: var(--app);
  min-height: 100vh;
}

.page-container {
  padding: 2.5rem;
  padding-bottom: 120px; /* Account for PlayingBar (90px) + 30px breathing room */
}

@media (max-width: 768px) {
  .page-container {
    padding: 1.5rem;
    padding-bottom: 110px;
  }
}
</style>
