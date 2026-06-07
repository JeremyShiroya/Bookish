# Library and Playlist UI Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add independent grid/table pagination settings, complete playlist edit/delete flows, improve book card and table styling, and redesign the add-to-playlist modal.

**Architecture:** Extend the existing settings and IndexedDB composables, then keep UI behavior in the current Vue components with one reusable playlist editor modal. Shared table styling is driven by a new global theme token, while Books continues to own its add-to-playlist workflow.

**Tech Stack:** Nuxt 4, Vue 3 Composition API, IndexedDB, Vitest, scoped CSS.

---

### Task 1: Independent Pagination Settings

**Files:**
- Modify: `composables/useBookishSettings.js`
- Modify: `composables/useBookishSettings.test.js`
- Modify: `components/SettingsComp.vue`
- Modify: `components/BooksComp.vue`

- [ ] Add failing tests asserting defaults of 12 grid items and 10 table items.
- [ ] Add a failing test asserting legacy `libraryItemsPerPage` migration.
- [ ] Add the two normalized settings and allowed options.
- [ ] Replace the Settings control with separate grid and table controls.
- [ ] Select the active page size in Books from `viewMode`.
- [ ] Run focused settings tests.

### Task 2: Remove Temporary Series Backfill UI

**Files:**
- Modify: `components/SettingsComp.vue`

- [ ] Remove the Retrieve Series Data setting row.
- [ ] Remove its metadata imports, state, computed message, and handler.
- [ ] Confirm no backfill identifiers remain in Settings.

### Task 3: Playlist Persistence Operations

**Files:**
- Modify: `composables/useLibraryStore.js`
- Modify: `composables/useLibraryStore.test.js`
- Modify: `composables/useBooks.js`

- [ ] Add a failing store test for deleting a collection.
- [ ] Implement `deleteCollection`.
- [ ] Add optimistic `updatePlaylist` and `deletePlaylist` wrappers with rollback.
- [ ] Run focused store tests.

### Task 4: Reusable Playlist Editor

**Files:**
- Create: `components/PlaylistEditModal.vue`
- Modify: `components/PlaylistComp.vue`
- Modify: `components/BookGroupDetail.vue`
- Modify: `pages/playlist/[id].vue`
- Modify: `pages/playlists/[id].vue`

- [ ] Build a modal that edits playlist name and optional description.
- [ ] Add right-click context menu handling to playlist cards.
- [ ] Add Edit and Delete actions with deletion confirmation.
- [ ] Add an optional title action slot/event to `BookGroupDetail`.
- [ ] Add the edit icon and shared modal to both playlist detail routes.
- [ ] Ensure Escape and outside-click close transient UI.

### Task 5: Grid Progress and Table Hover Styling

**Files:**
- Modify: `assets/css/main.css`
- Modify: `components/BooksComp.vue`
- Modify: `components/BookGroupDetail.vue`

- [ ] Add light and dark `--color-table-row-hover` tokens.
- [ ] Apply the token to Books and shared detail rows.
- [ ] Move grid progress below the genre tag and update layout CSS.
- [ ] Confirm personal rating remains separate.

### Task 6: Redesign Add-to-Playlist Modal

**Files:**
- Modify: `components/BooksComp.vue`

- [ ] Add selected-book cover and author preview.
- [ ] Add playlist search state and filtered selectable playlists.
- [ ] Restyle the segmented mode control.
- [ ] Restyle playlist options with icon, count, and selected indicator.
- [ ] Improve empty states and footer selection summary.
- [ ] Preserve existing create/add behavior and reset all new state on close.

### Task 7: Verification

**Files:**
- Verify all modified files.

- [ ] Run focused settings and store tests.
- [ ] Run `npx vitest run --exclude ".claude/worktrees/**"`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
- [ ] Perform rendered Books and Playlists interaction checks when browser tooling is available.
