<template>
  <div class="app-layout">
    <Sidebar />
    <main class="main-content">
      <MobileTopNav />
      <div class="page-container">
        <slot />
      </div>
      <PlayingBar />
      <MobileBottomNav />
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
  .main-content {
    margin-left: 0;
  }

  .page-container {
    padding: calc(4.25rem + env(safe-area-inset-top)) 10px 1.125rem;
    padding-bottom: calc(88px + env(safe-area-inset-bottom));
  }

  :deep(.sidebar),
  :deep(.playing-bar) {
    display: none;
  }
}
</style>
