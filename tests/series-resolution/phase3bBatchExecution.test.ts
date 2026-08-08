// Phase 3B Deliverable: Batch 2 (Mistborn Completion) Execution & Readback Audit Test Suite

import { describe, it, expect } from 'vitest';
import { executePhase3BBatch } from '../../server/utils/phase3bBatchExecutor';
import { ProductionBookRecord, createProductionSnapshot, computeContentHash } from '../../server/utils/productionSnapshotEngine';
import { ProposedRepairPlan } from '../../server/utils/repairPlanGenerator';

describe('Phase 3B Batch 2 Execution & Readback Audit (Mistborn Trilogy Completion)', () => {

  // Post-Phase-3A Production Library Baseline (prod_01 is already repaired to Mistborn #1 / 3)
  const postCanaryProductionCorpus: ProductionBookRecord[] = [
    { id: 'prod_01', title: 'The Final Empire', author: 'Brandon Sanderson', series: 'Mistborn', seriesInstallment: 1, seriesTotal: 3, seriesChecked: true },
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

  const freshBaselineSnapshot = createProductionSnapshot(postCanaryProductionCorpus);
  const baselineHash = freshBaselineSnapshot.manifest.contentHash;

  const batch2RepairPlan: ProposedRepairPlan = {
    snapshotHash: baselineHash,
    generatedAt: Date.now(),
    totalProposedModifications: 2,
    unchangedRecordsCount: 8,
    proposedDiffs: [
      { bookId: 'prod_02', title: 'The Well of Ascension', classification: 'SAFE_AUTO_REPAIR', before: { seriesTotal: 1 }, after: { seriesName: 'Mistborn', ordinal: 2, mainWorksTotal: 3 }, evidenceSources: ['hardcover'], confidence: { membership: 0.95, ordinal: 0.95, total: 0.95 }, isReversible: true },
      { bookId: 'prod_03', title: 'The Hero of Ages', classification: 'SAFE_AUTO_REPAIR', before: { seriesTotal: 1 }, after: { seriesName: 'Mistborn', ordinal: 3, mainWorksTotal: 3 }, evidenceSources: ['goodreads'], confidence: { membership: 0.95, ordinal: 0.95, total: 0.95 }, isReversible: true },
    ],
    rollbackPlan: []
  };

  const independentBackupJSONPhase3B = JSON.stringify({
    version: 1,
    dbName: 'bookish-library',
    exportedAt: new Date().toISOString(),
    stores: { books: postCanaryProductionCorpus }
  });

  it('1. Phase 3B Execution & Physical Readback Audit (Mistborn #1, #2, #3 Complete)', async () => {
    const report = await executePhase3BBatch(postCanaryProductionCorpus, batch2RepairPlan, independentBackupJSONPhase3B, 'PRODUCTION_APPROVED');

    // Audit Status Assertions
    expect(report.phase).toBe('PHASE_3B_MISTBORN_COMPLETION');
    expect(report.status).toBe('SUCCESS');
    expect(report.productionRecordsModified).toBe(2); // EXACTLY 2 RECORDS

    // Batch 2 Target Readbacks
    expect(report.batch2Targets.prod_02.readbackSeriesTotal).toBe(3);
    expect(report.batch2Targets.prod_03.readbackSeriesTotal).toBe(3);

    // Complete Mistborn Trilogy Roster State Assertion
    expect(report.mistbornSeriesStatePostBatch2).toEqual({
      prod_01: 'Mistborn #1 / 3',
      prod_02: 'Mistborn #2 / 3',
      prod_03: 'Mistborn #3 / 3',
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

    // Full 64-Character SHA-256 Hash Integrity Assertion
    expect(report.freshBaselineSnapshotHashPrePhase3B).toHaveLength(64);
    expect(report.snapshotHashPostBatch2Write).toHaveLength(64);
    expect(report.independentBackupHashPhase3B).toHaveLength(64);

    // Strict Containment Safeguard
    expect(report.phase3CStatus).toBe('LOCKED');
    expect(report.productionMigrationStatus).toBe('LOCKED_AWAITING_COUNCIL_REVIEW');
  });

  it('2. Negative Precondition Test: Aborts when mode is SHADOW_ONLY', async () => {
    const report = await executePhase3BBatch(postCanaryProductionCorpus, batch2RepairPlan, independentBackupJSONPhase3B, 'SHADOW_ONLY');

    expect(report.status).toBe('PRECONDITION_FAILED');
    expect(report.productionRecordsModified).toBe(0);
    expect(report.hardPreconditionsCheckPassed).toBe(false);
  });
});
