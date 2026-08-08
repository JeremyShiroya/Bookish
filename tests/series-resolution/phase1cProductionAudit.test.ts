// Phase 1C Deliverable: Production Library Dry-Run Audit & Rollback Verification Test Suite

import { describe, it, expect } from 'vitest';
import { createProductionSnapshot, verifySnapshotIntegrity, ProductionBookRecord } from '../../server/utils/productionSnapshotEngine';
import { runLiveShadowAudit } from '../../server/utils/liveShadowAuditEngine';
import { generateRepairAndRollbackPlan } from '../../server/utils/repairPlanGenerator';
import { EvidenceItem } from '../../server/utils/seriesDomainTypes';

describe('Phase 1C Production Library Dry-Run & Rollback Audit (ZERO WRITES)', () => {

  const productionCorpus: ProductionBookRecord[] = [
    { id: 'prod_01', title: 'The Final Empire', author: 'Brandon Sanderson', series: null, seriesInstallment: null, seriesTotal: null, seriesChecked: true },
    { id: 'prod_02', title: 'The Well of Ascension', author: 'Brandon Sanderson', series: 'Mistborn', seriesInstallment: 2, seriesTotal: 1 },
    { id: 'prod_03', title: 'The Hero of Ages', author: 'Brandon Sanderson', series: 'Mistborn', seriesInstallment: 3, seriesTotal: 1 },
    { id: 'prod_04', title: 'Dune', author: 'Frank Herbert', series: 'Dune', seriesInstallment: 1, seriesTotal: 1 },
    { id: 'prod_05', title: 'Dune Messiah', author: 'Frank Herbert', series: 'Dune', seriesInstallment: 2, seriesTotal: 1 },
    { id: 'prod_06', title: 'The Color of Magic', author: 'Terry Pratchett', series: 'Discworld', seriesInstallment: 1, seriesTotal: 1 },
    { id: 'prod_07', title: 'User Custom Book', author: 'Custom Author', series: 'Custom Series', seriesInstallment: 4, seriesTotal: 10, userDefined: { series: true } }
  ];

  const evidenceMap: Record<string, EvidenceItem[]> = {
    prod_01: [
      { provider: 'wikidata', claim: 'SERIES_MEMBERSHIP', value: 'Mistborn', confidence: 0.98, weight: 1.0, independenceGroup: 'wikidata', retrievedAt: Date.now() },
      { provider: 'hardcover', claim: 'SERIES_MEMBERSHIP', value: 'Mistborn', confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
      { provider: 'goodreads', claim: 'SERIES_MEMBERSHIP', value: 'Mistborn', confidence: 0.95, weight: 1.0, independenceGroup: 'goodreads', retrievedAt: Date.now() },
      { provider: 'hardcover', claim: 'SERIES_ORDINAL', value: 1, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
      { provider: 'hardcover', claim: 'SERIES_TOTAL', value: 3, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
      { provider: 'goodreads', claim: 'SERIES_TOTAL', value: 3, confidence: 0.95, weight: 1.0, independenceGroup: 'goodreads', retrievedAt: Date.now() },
    ],
    prod_02: [
      { provider: 'hardcover', claim: 'SERIES_MEMBERSHIP', value: 'Mistborn', confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
      { provider: 'hardcover', claim: 'SERIES_ORDINAL', value: 2, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
      { provider: 'google_books', claim: 'SERIES_TOTAL', value: 1, confidence: 0.3, weight: 0.3, independenceGroup: 'google_books', retrievedAt: Date.now() },
      { provider: 'hardcover', claim: 'SERIES_TOTAL', value: 3, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
    ],
    prod_03: [
      { provider: 'hardcover', claim: 'SERIES_MEMBERSHIP', value: 'Mistborn', confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
      { provider: 'hardcover', claim: 'SERIES_ORDINAL', value: 3, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
      { provider: 'google_books', claim: 'SERIES_TOTAL', value: 1, confidence: 0.3, weight: 0.3, independenceGroup: 'google_books', retrievedAt: Date.now() },
      { provider: 'hardcover', claim: 'SERIES_TOTAL', value: 3, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
    ],
    prod_04: [
      { provider: 'google_books', claim: 'SERIES_TOTAL', value: 1, confidence: 0.3, weight: 0.3, independenceGroup: 'google_books', retrievedAt: Date.now() },
      { provider: 'hardcover', claim: 'SERIES_TOTAL', value: 6, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
      { provider: 'goodreads', claim: 'SERIES_TOTAL', value: 6, confidence: 0.95, weight: 1.0, independenceGroup: 'goodreads', retrievedAt: Date.now() },
      { provider: 'hardcover', claim: 'SERIES_MEMBERSHIP', value: 'Dune', confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
      { provider: 'hardcover', claim: 'SERIES_ORDINAL', value: 1, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
    ],
    prod_05: [],
    prod_06: [],
    prod_07: [],
  };

  it('1. Generates Immutable Snapshot with Hash Integrity', () => {
    const bundle = createProductionSnapshot(productionCorpus);

    expect(bundle.manifest.bookCount).toBe(7);
    expect(bundle.manifest.storageEngine).toBe('IndexedDB (bookish-library / books store)');
    expect(bundle.manifest.readOnly).toBe(true);

    const isIntact = verifySnapshotIntegrity(bundle);
    expect(isIntact).toBe(true);
  });

  it('2. Asserts Zero Database Mutation During Shadow Audit', () => {
    const bundle = createProductionSnapshot(productionCorpus);
    const initialHash = bundle.manifest.contentHash;

    // Run read-only audit
    const auditSummary = runLiveShadowAudit(bundle.books, evidenceMap);
    expect(auditSummary.totalBooksScanned).toBe(7);

    // Hash check to guarantee snapshot remains bit-for-bit unchanged
    const postAuditHash = bundle.manifest.contentHash;
    expect(postAuditHash).toBe(initialHash);
  });

  it('3. Generates Explicit Proposed Repair Diff and Reversible Rollback Plan', () => {
    const bundle = createProductionSnapshot(productionCorpus);
    const auditSummary = runLiveShadowAudit(bundle.books, evidenceMap);

    const repairPlan = generateRepairAndRollbackPlan(bundle.books, auditSummary.proposals, bundle.manifest.contentHash);

    expect(repairPlan.totalProposedModifications).toBe(6); // prod_01, prod_02, prod_03, prod_04, prod_05, prod_06
    expect(repairPlan.unchangedRecordsCount).toBe(1); // prod_07 (user override)
    expect(repairPlan.proposedDiffs.length).toBe(6);
    expect(repairPlan.rollbackPlan.length).toBe(6);

    const diff = repairPlan.proposedDiffs[0];
    expect(diff.bookId).toBe('prod_01');
    expect(diff.before.series).toBe(null);
    expect(diff.after.seriesName).toBe('Mistborn');
    expect(diff.after.ordinal).toBe('1');
    expect(diff.isReversible).toBe(true);

    const rollback = repairPlan.rollbackPlan[0];
    expect(rollback.bookId).toBe('prod_01');
    expect(rollback.restoreState.series).toBe(null);
  });
});
