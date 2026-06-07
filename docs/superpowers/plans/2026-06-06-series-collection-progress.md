# Series Collection Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist a trustworthy metadata-derived series size and display owned-versus-total progress on series detail pages.

**Architecture:** Extend the existing Goodreads metadata provider to resolve primary-work counts from canonical series pages, then carry `seriesTotal` through the existing metadata endpoint and local book record. Keep rendering logic in a pure client helper so all label states are directly testable.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript/JavaScript, Cheerio, Vitest

---

## File Structure

- `server/utils/goodreadsScraper.ts`: Parse series links and series-page primary-work counts.
- `server/utils/goodreadsScraper.test.ts`: Verify parsing and enrichment behavior.
- `server/api/books/metadata.get.ts`: Carry provider totals into `MetadataSource`.
- `server/utils/metadataAggregator.ts`: Select the highest valid matched total.
- `server/utils/metadataEnrichment.test.ts`: Verify total propagation and conflict handling.
- `composables/useBookMetadataSearch.js`: Preserve totals in browser fallback results.
- `composables/useSeriesProgress.js`: Pure normalization and label formatting.
- `composables/useSeriesProgress.test.js`: Verify user-facing count states.
- `components/BookGroupDetail.vue`: Render a supplied count label without series-specific persistence logic.
- `pages/serie/[id].vue`: Derive the stored total and series count label.
- `components/AddBookComp.vue`: Persist selected metadata totals and retain manual correction field.
- `components/EditBookComp.vue`: Persist refreshed metadata totals and retain manual correction field.

### Task 1: Goodreads Series Count

- [ ] Add failing parser tests for series links, `6 primary works`, and malformed pages.
- [ ] Run `npx vitest run server/utils/goodreadsScraper.test.ts` and confirm the new assertions fail.
- [ ] Add a `seriesUrl` field, export a pure `parseGoodreadsSeriesTotal` helper, and enrich book details by fetching the canonical series page without making metadata failure fatal.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Metadata Propagation

- [ ] Add failing aggregator tests proving `seriesTotal` is returned and the highest valid matched total wins.
- [ ] Run `npx vitest run server/utils/metadataEnrichment.test.ts` and confirm failure.
- [ ] Pass `seriesTotal` through every metadata adapter, include it in completeness scoring, normalize positive integer totals, and preserve it in browser fallback merging.
- [ ] Re-run the focused test and confirm it passes.

### Task 3: Series Progress Labels

- [ ] Create failing tests for `4/6 books collected`, `Complete series`, `4 Books`, and `1 Book`.
- [ ] Run `npx vitest run composables/useSeriesProgress.test.js` and confirm failure.
- [ ] Implement `formatSeriesCollectionProgress`, use it from `pages/serie/[id].vue`, and simplify `BookGroupDetail.vue` to render the supplied label.
- [ ] Re-run the focused test and confirm it passes.

### Task 4: End-to-End Verification

- [ ] Run `npx vitest run` and fix any regressions.
- [ ] Run `npm run build` and fix type or Nuxt compilation errors.
- [ ] Inspect the final diff to ensure unrelated worktree changes were preserved.
- [ ] Start the local app and verify the series header in the in-app browser when local library data is available.

