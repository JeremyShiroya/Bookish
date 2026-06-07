# Series Data Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store series totals before navigation through a Settings backfill action and Add/Edit propagation.

**Architecture:** Extend `useSeriesProgress` with reusable resolve, propagate, and batch operations. Settings orchestrates the temporary backfill UI; Add/Edit propagate selected metadata after save; the series route becomes local-only.

**Tech Stack:** Nuxt 4, Vue 3, IndexedDB, Vitest

---

### Task 1: Batch Series Service

**Files:**
- Modify: `composables/useSeriesProgress.js`
- Test: `composables/useSeriesProgress.test.js`

- [ ] Write failing tests for unique-series batching, progress callbacks, unresolved totals, and matching-series propagation.
- [ ] Run `npx vitest run composables/useSeriesProgress.test.js` and confirm failure.
- [ ] Implement `propagateSeriesTotal` and `backfillSeriesTotals` using sequential calls to the existing metadata fetcher.
- [ ] Re-run the focused tests and confirm they pass.

### Task 2: Settings Backfill Control

**Files:**
- Modify: `components/SettingsComp.vue`

- [ ] Add the temporary Metadata row with disabled/loading/progress states.
- [ ] Wire it to `backfillSeriesTotals`, `seriesList`, `fetchBookMetadataResults`, and `updateBook`.
- [ ] Report updated and unresolved results with existing toast behavior.

### Task 3: Add/Edit Persistence

**Files:**
- Modify: `components/AddBookComp.vue`
- Modify: `components/EditBookComp.vue`

- [ ] After Add saves a book with a valid series total, propagate that total across matching local books.
- [ ] After Edit saves a book with a valid series total, propagate that total across matching local books.
- [ ] Keep standalone clearing behavior intact.

### Task 4: Local-Only Series Route

**Files:**
- Modify: `pages/serie/[id].vue`

- [ ] Remove page-load metadata search and checking state.
- [ ] Keep count formatting based only on stored local totals.

### Task 5: Verification

- [ ] Run `npx vitest run --exclude ".claude/worktrees/**"`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.

