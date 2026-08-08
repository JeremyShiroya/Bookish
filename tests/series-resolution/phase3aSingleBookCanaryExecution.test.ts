// Phase 3A Deliverable: Single-Book Production Canary Execution & Readback Audit Test Suite

import { describe, it, expect } from 'vitest';
import { executePhase3ACanary } from '../../server/utils/phase3aCanaryExecutor';
import { ProductionBookRecord, createProductionSnapshot, computeContentHash } from '../../server/utils/productionSnapshotEngine';
import { ProposedRepairPlan } from '../../server/utils/repairPlanGenerator';

describe('Phase 3A Single-Book Production Canary Write & Readback Audit (EXACTLY 1 RECORD MODIFIED)', () => {

  const productionCorpus: ProductionBookRecord[] = [
    { id: 'prod_01', title: 'The Final Empire', author: 'Brandon Sanderson', series: null, seriesInstallment: null, seriesTotal: null, seriesChecked: true },
    { id: 'prod_02', title: 'The Well of Ascension', author: 'Brandon Sanderson', series: 'Mistborn', seriesInstallment: 2, seriesTotal: 1 },
    { id: 'prod_03', title: 'The Hero of Ages', author: 'Brandon Sanderson', series: 'Mistborn', seriesInstallment: 3, seriesTotal: 1 },
    { id: 'prod_04', title: 'Dune', author: 'Frank Herbert', series: 'Dune', seriesInstallment: 1, seriesTotal: 1 },
    { id: 'prod_05', title: 'Dune Messiah', author: 'Frank Herbert', series: 'Dune', seriesInstallment: 2, seriesTotal: 1 },
    { id: 'prod_06', title: 'The Color of Magic', author: 'Terry Pratchett', series: 'Discworld', seriesInstallment: 1, seriesTotal: 1 },
    { id: 'prod_07', title: 'A Game of Thrones', author: 'George R.R. Martin', series: 'A Song of Ice and Fire', seriesInstallment: 1, seriesTotal: 1 },
    { id: 'prod_08', title: 'User Protected Book 1', author: 'Custom Author', series: 'Custom Series', seriesInstallment: 1, seriesTotal: 3, userDefined: { series: true } },
    { id: 'prod_09', title: 'User Protected Book 2', author: 'Custom Author', series: 'Custom Series', seriesInstallment: 2, seriesTotal: 3, userDefined: { seriesInstallment: true } },
    { id: 'prod_10', title: 'To Kill a Mockingbird', author: 'Harper Lee', series: null, seriesInstallment: null, seriesTotal: null, seriesChecked: true }
  ];

  const snapshot = createProductionSnapshot(productionCorpus);
  const initialHash = snapshot.manifest.contentHash;

  const repairPlan: ProposedRepairPlan = {
    snapshotHash: initialHash,
    generatedAt: Date.now(),
    totalProposedModifications: 1,
    unchangedRecordsCount: 9,
    proposedDiffs: [
      { bookId: 'prod_01', title: 'The Final Empire', classification: 'SAFE_AUTO_REPAIR', before: { series: null }, after: { seriesName: 'Mistborn', ordinal: 1, mainWorksTotal: 3 }, evidenceSources: ['wikidata'], confidence: { membership: 0.98, ordinal: 0.95, total: 0.95 }, isReversible: true },
    ],
    rollbackPlan: []
  };

  const backupJSON = JSON.stringify({
    version: 1,
    dbName: 'bookish-library',
    exportedAt: new Date().toISOString(),
    stores: { books: productionCorpus }
  });

  it('1. Phase 3A Single-Book Canary Execution & Readback Audit (prod_01 ONLY)', async () => {
    const report = await executePhase3ACanary(productionCorpus, repairPlan, backupJSON);

    // Audit Status Assertions
    expect(report.phase).toBe('PHASE_3A_SINGLE_BOOK_CANARY');
    expect(report.status).toBe('SUCCESS');
    expect(report.productionRecordsModified).toBe(1); // EXACTLY 1 RECORD

    // Before State Assertion
    expect(report.beforeState).toEqual({
      id: 'prod_01',
      title: 'The Final Empire',
      series: null,
      seriesInstallment: null,
      seriesTotal: null,
    });

    // After State Assertion
    expect(report.afterState).toEqual({
      id: 'prod_01',
      title: 'The Final Empire',
      series: 'Mistborn',
      seriesInstallment: 1,
      seriesTotal: 3,
    });

    // Readback from Reopened Database Assertion
    expect(report.readbackStateFromReopenedDB).toEqual({
      id: 'prod_01',
      title: 'The Final Empire',
      series: 'Mistborn',
      seriesInstallment: 1,
      seriesTotal: 3,
    });

    // Zero Contamination Assertions
    expect(report.unrelatedRecordsModifiedCount).toBe(0);
    expect(report.unexpectedMutationsCount).toBe(0);
    expect(report.unrelatedFieldsModifiedCount).toBe(0);

    // Verification Checks
    expect(report.hardPreconditionsCheckPassed).toBe(true);
    expect(report.databaseReopenReadbackResult).toBe('PASS');
    expect(report.transactionLedgerResult).toBe('PASS');
    expect(report.rollbackStatus).toBe('NOT_NEEDED');

    // Strict Containment Safeguard
    expect(report.batches2And3Status).toBe('LOCKED');
    expect(report.productionMigrationStatus).toBe('LOCKED_AWAITING_COUNCIL_REVIEW');
  });

  it('2. Negative Precondition Test: Aborts when mode is SHADOW_ONLY', async () => {
    const report = await executePhase3ACanary(productionCorpus, repairPlan, backupJSON, 'SHADOW_ONLY');

    expect(report.status).toBe('PRECONDITION_FAILED');
    expect(report.productionRecordsModified).toBe(0);
    expect(report.hardPreconditionsCheckPassed).toBe(false);
  });
});
