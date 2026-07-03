# Mobile Native Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Bookish installable and native-wrappable while making mobile reader entry feel immediate.

**Architecture:** Keep Nuxt as the source app. Add PWA generation for browser-installed apps, add Capacitor config for Android/iOS shells, and introduce a client-side reader prewarm cache that can show recently requested content before slower persistent storage returns.

**Tech Stack:** Nuxt 4 SPA, `@vite-pwa/nuxt`, Capacitor, IndexedDB, Vitest.

---

### Task 1: Tests

**Files:**
- Modify: `tests/responsiveComponentSplit.test.js`
- Create: `tests/mobileNativeAppConfig.test.js`

- [ ] Add tests that assert the reader route preloads content through a dedicated helper and applies cached content before awaiting storage.
- [ ] Add tests that assert Nuxt has `@vite-pwa/nuxt`, app manifest metadata, runtime asset caching, and Capacitor output compatibility.
- [ ] Add tests that assert Capacitor config points to the generated Nuxt public output and enables Android/iOS app ids.
- [ ] Run `npx vitest run tests\responsiveComponentSplit.test.js tests\mobileNativeAppConfig.test.js --hookTimeout=30000` and verify the new tests fail before implementation.

### Task 2: Reader Prewarm

**Files:**
- Create: `composables/useReaderPrewarm.js`
- Modify: `pages/reader/[id].vue`
- Modify: mobile book/detail components that navigate to `/reader/:id`

- [ ] Implement a module-level memory cache keyed by book id.
- [ ] Expose `prewarmReaderContent(bookId)`, `getPrewarmedReaderContent(bookId)`, and `clearPrewarmedReaderContent(bookId)`.
- [ ] Call prewarm from mobile read actions before navigation.
- [ ] In the reader route, synchronously apply prewarmed content first, then refresh from persistent storage and native file storage when available.

### Task 3: PWA

**Files:**
- Modify: `package.json`
- Modify: `nuxt.config.ts`
- Create: `public/manifest.webmanifest` only if Nuxt module config is insufficient.

- [ ] Install `@vite-pwa/nuxt`.
- [ ] Add the module to Nuxt.
- [ ] Configure app name, icons, theme/background colors, display mode, and workbox caching for app shell, images, fonts, scripts, styles, and documents.
- [ ] Keep `ssr: false` and avoid server-only caching assumptions.

### Task 4: Capacitor

**Files:**
- Modify: `package.json`
- Create: `capacitor.config.ts`

- [ ] Install `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/ios`, `@capacitor/filesystem`, and `@capacitor/preferences`.
- [ ] Configure app id `com.bookish.app`, app name `Bookish`, `webDir: '.output/public'`, and bundled web runtime.
- [ ] Add scripts for `cap:sync`, `cap:open:android`, and `cap:open:ios`.
- [ ] Keep native platform folders out of this first pass unless the user runs `npx cap add android` or `npx cap add ios`.

### Task 5: Verification

**Files:**
- No new files.

- [ ] Run focused Vitest files.
- [ ] Run the full Vitest suite.
- [ ] Run `npm run build`.
- [ ] Run `npm run generate` to confirm `.output/public` exists for Capacitor.
- [ ] Report exact commands for native platform generation and sync.
