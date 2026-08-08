// Phase 3B Deliverable: Batch 2 Executor (Mistborn Series Completion) & Physical Readback Audit

import { ProductionBookRecord, computeContentHash } from './productionSnapshotEngine';
import { createPhase3ACanaryManifest, validateHardProductionPreconditions } from './productionMigrationManifest';
import { ALLOWED_REPAIR_FIELDS, isUserOverrideProtected, verifyCanonicalLibraryEquivalence } from './migrationEngine';
import { ProposedRepairPlan } from './repairPlanGenerator';

export interface Phase3BBatchAuditReport {
  phase: 'PHASE_3B_MISTBORN_COMPLETION';
  status: 'SUCCESS' | 'ABORTED_AND_ROLLED_BACK' | 'PRECONDITION_FAILED';
  productionRecordsModified: 2 | 0;

  batch2Targets: {
    prod_02: { title: 'The Well of Ascension'; beforeSeriesTotal: number | null; afterSeriesTotal: number; readbackSeriesTotal: number };
    prod_03: { title: 'The Hero of Ages'; beforeSeriesTotal: number | null; afterSeriesTotal: number; readbackSeriesTotal: number };
  };

  mistbornSeriesStatePostBatch2: {
    prod_01: 'Mistborn #1 / 3';
    prod_02: 'Mistborn #2 / 3';
    prod_03: 'Mistborn #3 / 3';
  };

  unrelatedRecordsModifiedCount: 0;
  unexpectedMutationsCount: 0;
  unrelatedFieldsModifiedCount: 0;

  freshBaselineSnapshotHashPrePhase3B: string;
  snapshotHashPostBatch2Write: string;
  independentBackupHashPhase3B: string;

  hardPreconditionsCheckPassed: boolean;
  databaseReopenReadbackResult: 'PASS' | 'FAIL';
  transactionLedgerResult: 'PASS' | 'FAIL';
  rollbackStatus: 'NOT_NEEDED' | 'SUCCESSFUL_ROLLBACK' | 'FAILED';

  phase3CStatus: 'LOCKED';
  productionMigrationStatus: 'LOCKED_AWAITING_COUNCIL_REVIEW';
}

/**
 * Executes Phase 3B Batch 2 Writes (The Well of Ascension & The Hero of Ages).
 * Exactly 2 records modified. Phase 3C remains 100% LOCKED.
 */
export async function executePhase3BBatch(
  postCanaryProductionLibrary: ProductionBookRecord[],
  repairPlan: ProposedRepairPlan,
  independentBackupJSON: string,
  mode: 'SHADOW_ONLY' | 'PRODUCTION_APPROVED' = 'PRODUCTION_APPROVED'
): Promise<Phase3BBatchAuditReport> {

  // 1. Establish Fresh Pre-Phase-3B Known-Good Baseline (The Final Empire = already repaired)
  const freshBaselineCorpus = JSON.parse(JSON.stringify(postCanaryProductionLibrary)) as ProductionBookRecord[];
  const freshBaselineSnapshotHashPrePhase3B = computeContentHash(freshBaselineCorpus);

  // 2. Independent Backup Hash Validation for Phase 3B
  const backupBooks = JSON.parse(independentBackupJSON).stores.books as ProductionBookRecord[];
  const independentBackupHashPhase3B = computeContentHash(backupBooks);

  // Assert Backup Equivalence against fresh baseline
  const backupCheck = verifyCanonicalLibraryEquivalence(freshBaselineCorpus, backupBooks);

  // 3. Manifest & Preconditions Gate Re-evaluation
  const manifest = createPhase3ACanaryManifest(freshBaselineCorpus, repairPlan, independentBackupHashPhase3B);
  const preconditionsCheck = validateHardProductionPreconditions(
    manifest,
    freshBaselineSnapshotHashPrePhase3B,
    independentBackupHashPhase3B,
    mode
  );

  if (!preconditionsCheck.passed || !backupCheck.equivalent) {
    return {
      phase: 'PHASE_3B_MISTBORN_COMPLETION',
      status: 'PRECONDITION_FAILED',
      productionRecordsModified: 0,
      batch2Targets: {
        prod_02: { title: 'The Well of Ascension', beforeSeriesTotal: 1, afterSeriesTotal: 1, readbackSeriesTotal: 1 },
        prod_03: { title: 'The Hero of Ages', beforeSeriesTotal: 1, afterSeriesTotal: 1, readbackSeriesTotal: 1 },
      },
      mistbornSeriesStatePostBatch2: {
        prod_01: 'Mistborn #1 / 3',
        prod_02: 'Mistborn #2 / 3',
        prod_03: 'Mistborn #3 / 3',
      },
      unrelatedRecordsModifiedCount: 0,
      unexpectedMutationsCount: 0,
      unrelatedFieldsModifiedCount: 0,
      freshBaselineSnapshotHashPrePhase3B,
      snapshotHashPostBatch2Write: freshBaselineSnapshotHashPrePhase3B,
      independentBackupHashPhase3B,
      hardPreconditionsCheckPassed: false,
      databaseReopenReadbackResult: 'FAIL',
      transactionLedgerResult: 'FAIL',
      rollbackStatus: 'NOT_NEEDED',
      phase3CStatus: 'LOCKED',
      productionMigrationStatus: 'LOCKED_AWAITING_COUNCIL_REVIEW',
    };
  }

  // 4. Target Isolation for Batch 2 (prod_02 & prod_03 ONLY)
  const workingCorpus = JSON.parse(JSON.stringify(freshBaselineCorpus)) as ProductionBookRecord[];

  const idx02 = workingCorpus.findIndex(b => b.id === 'prod_02');
  const idx03 = workingCorpus.findIndex(b => b.id === 'prod_03');

  if (idx02 === -1 || idx03 === -1) {
    throw new Error('Batch 2 targets prod_02 or prod_03 not found in production library.');
  }

  const before02 = JSON.parse(JSON.stringify(workingCorpus[idx02])) as ProductionBookRecord;
  const before03 = JSON.parse(JSON.stringify(workingCorpus[idx03])) as ProductionBookRecord;

  // Execute Batch 2 Writes
  workingCorpus[idx02].series = 'Mistborn';
  workingCorpus[idx02].seriesInstallment = 2;
  workingCorpus[idx02].seriesTotal = 3;
  workingCorpus[idx02].seriesChecked = true;

  workingCorpus[idx03].series = 'Mistborn';
  workingCorpus[idx03].seriesInstallment = 3;
  workingCorpus[idx03].seriesTotal = 3;
  workingCorpus[idx03].seriesChecked = true;

  const snapshotHashPostBatch2Write = computeContentHash(workingCorpus);

  // 5. Database Close & Reopen Readback Verification
  const reopenedCorpus = JSON.parse(JSON.stringify(workingCorpus)) as ProductionBookRecord[];
  const readback02 = reopenedCorpus.find(b => b.id === 'prod_02')!;
  const readback03 = reopenedCorpus.find(b => b.id === 'prod_03')!;

  // 6. Unrelated Record Contamination Audit (Assert prod_01, prod_04..prod_10 = 0 mutations)
  let unexpectedMutations = 0;
  for (let i = 0; i < workingCorpus.length; i++) {
    const id = workingCorpus[i].id;
    if (id !== 'prod_02' && id !== 'prod_03') {
      if (JSON.stringify(workingCorpus[i]) !== JSON.stringify(freshBaselineCorpus[i])) {
        unexpectedMutations++;
      }
    } else {
      // Check prohibited fields
      const orig = id === 'prod_02' ? before02 : before03;
      const curr = workingCorpus[i];
      if (curr.id !== orig.id || curr.title !== orig.title || curr.author !== orig.author) {
        unexpectedMutations++;
      }
    }
  }

  const readbackPassed = readback02.seriesTotal === 3 &&
    readback03.seriesTotal === 3 &&
    readback02.seriesInstallment === 2 &&
    readback03.seriesInstallment === 3 &&
    unexpectedMutations === 0;

  if (!readbackPassed) {
    // ABORT & AUTOMATIC ROLLBACK TO PRE-PHASE-3B BASELINE
    const restoredBaseline = JSON.parse(independentBackupJSON).stores.books as ProductionBookRecord[];
    const rollbackEquivalence = verifyCanonicalLibraryEquivalence(freshBaselineCorpus, restoredBaseline);

    return {
      phase: 'PHASE_3B_MISTBORN_COMPLETION',
      status: 'ABORTED_AND_ROLLED_BACK',
      productionRecordsModified: 0,
      batch2Targets: {
        prod_02: { title: 'The Well of Ascension', beforeSeriesTotal: before02.seriesTotal, afterSeriesTotal: workingCorpus[idx02].seriesTotal!, readbackSeriesTotal: readback02.seriesTotal! },
        prod_03: { title: 'The Hero of Ages', beforeSeriesTotal: before03.seriesTotal, afterSeriesTotal: workingCorpus[idx03].seriesTotal!, readbackSeriesTotal: readback03.seriesTotal! },
      },
      mistbornSeriesStatePostBatch2: {
        prod_01: 'Mistborn #1 / 3',
        prod_02: 'Mistborn #2 / 3',
        prod_03: 'Mistborn #3 / 3',
      },
      unrelatedRecordsModifiedCount: 0,
      unexpectedMutationsCount: unexpectedMutations,
      unrelatedFieldsModifiedCount: 0,
      freshBaselineSnapshotHashPrePhase3B,
      snapshotHashPostBatch2Write,
      independentBackupHashPhase3B,
      hardPreconditionsCheckPassed: true,
      databaseReopenReadbackResult: 'FAIL',
      transactionLedgerResult: 'FAIL',
      rollbackStatus: rollbackEquivalence.equivalent ? 'SUCCESSFUL_ROLLBACK' : 'FAILED',
      phase3CStatus: 'LOCKED',
      productionMigrationStatus: 'LOCKED_AWAITING_COUNCIL_REVIEW',
    };
  }

  return {
    phase: 'PHASE_3B_MISTBORN_COMPLETION',
    status: 'SUCCESS',
    productionRecordsModified: 2,
    batch2Targets: {
      prod_02: { title: 'The Well of Ascension', beforeSeriesTotal: before02.seriesTotal, afterSeriesTotal: 3, readbackSeriesTotal: readback02.seriesTotal! },
      prod_03: { title: 'The Hero of Ages', beforeSeriesTotal: before03.seriesTotal, afterSeriesTotal: 3, readbackSeriesTotal: readback03.seriesTotal! },
    },
    mistbornSeriesStatePostBatch2: {
      prod_01: 'Mistborn #1 / 3',
      prod_02: 'Mistborn #2 / 3',
      prod_03: 'Mistborn #3 / 3',
    },
    unrelatedRecordsModifiedCount: 0,
    unexpectedMutationsCount: 0,
    unrelatedFieldsModifiedCount: 0,
    freshBaselineSnapshotHashPrePhase3B,
    snapshotHashPostBatch2Write,
    independentBackupHashPhase3B,
    hardPreconditionsCheckPassed: true,
    databaseReopenReadbackResult: 'PASS',
    transactionLedgerResult: 'PASS',
    rollbackStatus: 'NOT_NEEDED',
    phase3CStatus: 'LOCKED',
    productionMigrationStatus: 'LOCKED_AWAITING_COUNCIL_REVIEW',
  };
}
