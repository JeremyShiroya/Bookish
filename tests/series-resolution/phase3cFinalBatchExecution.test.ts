// Phase 3C Deliverable: Final Batch Execution & Full Library Readback Audit Test Suite

import { describe, it, expect } from 'vitest';
import { executePhase3CFinalBatch } from '../../server/utils/phase3cFinalBatchExecutor';
import { ProductionBookRecord, createProductionSnapshot, computeContentHash } from '../../server/utils/productionSnapshotEngine';
import { ProposedRepairPlan } from '../../server/utils/repairPlanGenerator';

describe('Phase 3C Final Batch Execution & Full Library Readback Audit (Dune, Discworld, ASOIAF)', () => {

  // Post-Phase-3B Production Library Baseline (prod_01..03 already repaired to Mistborn #1..3 / 3)
  const postPhase3BProductionCorpus: ProductionBookRecord[] = [
    { id: 'prod_01', title: 'The Final Empire', author: 'Brandon Sanderson', series: 'Mistborn', seriesInstallment: 1, seriesTotal: 3, seriesChecked: true },
    { id: 'prod_02', title: 'The Well of Ascension', author: 'Brandon Sanderson', series: 'Mistborn', seriesInstallment: 2, seriesTotal: 3, seriesChecked: true },
    { id: 'prod_03', title: 'The Hero of Ages', author: 'Brandon Sanderson', series: 'Mistborn', seriesInstallment: 3, seriesTotal: 3, seriesChecked: true },
    { id: 'prod_04', title: 'Dune', author: 'Frank Herbert', series: 'Dune', seriesInstallment: 1, seriesTotal: 1 },
    { id: 'prod_05', title: 'Dune Messiah', author: 'Frank Herbert', series: 'Dune', seriesInstallment: 2, seriesTotal: 1 },
    { id: 'prod_06', title: 'The Color of Magic', author: 'Terry Pratchett', series: 'Discworld', seriesInstallment: 1, seriesTotal: 1 },
    { id: 'prod_07', title: 'A Game of Thrones', author: 'George R.R. Martin', series: 'A Song of Ice and Fire', seriesInstallment: 1, seriesTotal: 1 },
    { id: 'prod_08', title: 'User Protected Book 1', author: 'Custom Author', series: 'Custom Series', seriesInstallment: 1, seriesTotal: 3, userDefined: { series: true } },
    { id: 'prod_09', title: 'User Protected Book 2', author: 'Custom Author', series: 'Custom Series', seriesInstallment: 2, seriesTotal: 3, userDefined: { seriesInstallment: true } },
    { id: 'prod_10', title: 'To Kill a Mockingbird', author: 'Harper Lee', series: null, seriesInstallment: null, seriesTotal: null, seriesChecked: true }
  ];

  const freshBaselineSnapshotPhase3C = createProductionSnapshot(postPhase3BProductionCorpus);
  const baselineHashPhase3C = freshBaselineSnapshotPhase3C.manifest.contentHash;

  const phase3CRepairPlan: ProposedRepairPlan = {
    snapshotHash: baselineHashPhase3C,
    generatedAt: Date.now(),
    totalProposedModifications: 4,
    unchangedRecordsCount: 6,
    proposedDiffs: [
      { bookId: 'prod_04', title: 'Dune', classification: 'SAFE_AUTO_REPAIR', before: { seriesTotal: 1 }, after: { seriesName: 'Dune', ordinal: 1, mainWorksTotal: 6 }, evidenceSources: ['hardcover'], confidence: { membership: 0.95, ordinal: 0.95, total: 0.95 }, isReversible: true },
      { bookId: 'prod_05', title: 'Dune Messiah', classification: 'SAFE_AUTO_REPAIR', before: { seriesTotal: 1 }, after: { seriesName: 'Dune', ordinal: 2, mainWorksTotal: 6 }, evidenceSources: ['goodreads'], confidence: { membership: 0.95, ordinal: 0.95, total: 0.95 }, isReversible: true },
      { bookId: 'prod_06', title: 'The Color of Magic', classification: 'SAFE_AUTO_REPAIR', before: { seriesTotal: 1 }, after: { seriesName: 'Discworld', ordinal: 1, mainWorksTotal: 41 }, evidenceSources: ['wikidata'], confidence: { membership: 0.95, ordinal: 0.95, total: 0.95 }, isReversible: true },
      { bookId: 'prod_07', title: 'A Game of Thrones', classification: 'SAFE_AUTO_REPAIR', before: { seriesTotal: 1 }, after: { seriesName: 'A Song of Ice and Fire', ordinal: 1, mainWorksTotal: 7 }, evidenceSources: ['hardcover'], confidence: { membership: 0.95, ordinal: 0.95, total: 0.95 }, isReversible: true },
    ],
    rollbackPlan: []
  };

  const independentBackupJSONPhase3C = JSON.stringify({
    version: 1,
    dbName: 'bookish-library',
    exportedAt: new Date().toISOString(),
    stores: { books: postPhase3BProductionCorpus }
  });

  it('1. Phase 3C Final Batch Execution & Full 10-Book Library Readback Audit', async () => {
    const report = await executePhase3CFinalBatch(postPhase3BProductionCorpus, phase3CRepairPlan, independentBackupJSONPhase3C, 'PRODUCTION_APPROVED');

    // Audit Status Assertions
    expect(report.phase).toBe('PHASE_3C_FINAL_BATCH_REPAIRS');
    expect(report.status).toBe('SUCCESS');
    expect(report.productionRecordsModified).toBe(4); // EXACTLY 4 RECORDS MODIFIED IN PHASE 3C

    // Post-Phase-3C Reopened DB Readback Assertions
    expect(report.readbackStatesFromReopenedDB.prod_04).toEqual({ series: 'Dune', seriesInstallment: 1, seriesTotal: 6 });
    expect(report.readbackStatesFromReopenedDB.prod_05).toEqual({ series: 'Dune', seriesInstallment: 2, seriesTotal: 6 });
    expect(report.readbackStatesFromReopenedDB.prod_06).toEqual({ series: 'Discworld', seriesInstallment: 1, seriesTotal: 41 });
    expect(report.readbackStatesFromReopenedDB.prod_07).toEqual({ series: 'A Song of Ice and Fire', seriesInstallment: 1, seriesTotal: 7 });

    // Full Post-Phase-3C 10-Book Library Roster Proof
    expect(report.finalLibraryRosterState).toEqual({
      prod_01: 'Mistborn #1 / 3 (Phase 3A Canary)',
      prod_02: 'Mistborn #2 / 3 (Phase 3B Batch 2)',
      prod_03: 'Mistborn #3 / 3 (Phase 3B Batch 2)',
      prod_04: 'Dune #1 / 6 (Phase 3C Batch 3A)',
      prod_05: 'Dune #2 / 6 (Phase 3C Batch 3A)',
      prod_06: 'Discworld #1 / 41 (Phase 3C Batch 3B)',
      prod_07: 'A Song of Ice and Fire #1 / 7 (Phase 3C Batch 3B)',
      prod_08: 'UNCHANGED / USER OVERRIDE PROTECTED',
      prod_09: 'UNCHANGED / USER OVERRIDE PROTECTED',
      prod_10: 'UNCHANGED STANDALONE',
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

    // Full Untruncated 64-Character SHA-256 Content Hashes Proof
    expect(report.freshBaselineSnapshotHashPrePhase3C).toHaveLength(64);
    expect(report.finalSnapshotHashPostPhase3C).toHaveLength(64);
    expect(report.independentBackupHashPhase3C).toHaveLength(64);

    // Engine Completion & Council Review Lock
    expect(report.phase4Status).toBe('LOCKED_AWAITING_COUNCIL_REVIEW');
    expect(report.productionMigrationEngineStatus).toBe('COMPLETED_SUCCESSFULLY');
  });

  it('2. Negative Precondition Test: Aborts when mode is SHADOW_ONLY', async () => {
    const report = await executePhase3CFinalBatch(postPhase3BProductionCorpus, phase3CRepairPlan, independentBackupJSONPhase3C, 'SHADOW_ONLY');

    expect(report.status).toBe('PRECONDITION_FAILED');
    expect(report.hardPreconditionsCheckPassed).toBe(false);
  });
});
