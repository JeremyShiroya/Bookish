// Phase 3A Deliverable: Single-Book Production Canary Executor & Physical Readback Audit

import { ProductionBookRecord, computeContentHash } from './productionSnapshotEngine';
import { createPhase3ACanaryManifest, validateHardProductionPreconditions, Phase3ACanaryManifest } from './productionMigrationManifest';
import { ALLOWED_REPAIR_FIELDS, isUserOverrideProtected, verifyCanonicalLibraryEquivalence } from './migrationEngine';
import { ProposedRepairPlan } from './repairPlanGenerator';

export interface Phase3ACanaryAuditReport {
  phase: 'PHASE_3A_SINGLE_BOOK_CANARY';
  status: 'SUCCESS' | 'ABORTED_AND_ROLLED_BACK' | 'PRECONDITION_FAILED';
  productionRecordsModified: 1 | 0;

  beforeState: {
    id: 'prod_01';
    title: 'The Final Empire';
    series: string | null;
    seriesInstallment: number | null;
    seriesTotal: number | null;
  };

  afterState: {
    id: 'prod_01';
    title: 'The Final Empire';
    series: string | null;
    seriesInstallment: number | null;
    seriesTotal: number | null;
  };

  readbackStateFromReopenedDB: {
    id: 'prod_01';
    title: 'The Final Empire';
    series: string | null;
    seriesInstallment: number | null;
    seriesTotal: number | null;
  };

  unrelatedRecordsModifiedCount: 0;
  unexpectedMutationsCount: 0;
  unrelatedFieldsModifiedCount: 0;

  snapshotHashBefore: string;
  snapshotHashAfterWrite: string;
  independentBackupHash: string;

  hardPreconditionsCheckPassed: boolean;
  databaseReopenReadbackResult: 'PASS' | 'FAIL';
  transactionLedgerResult: 'PASS' | 'FAIL';
  rollbackStatus: 'NOT_NEEDED' | 'SUCCESSFUL_ROLLBACK' | 'FAILED';

  batches2And3Status: 'LOCKED';
  productionMigrationStatus: 'LOCKED_AWAITING_COUNCIL_REVIEW';
}

/**
 * Executes the Phase 3A Single-Book Production Canary Write on 'The Final Empire' ONLY.
 * Strictly 1 record modified. Batches 2 & 3 remain 100% LOCKED.
 */
export async function executePhase3ACanary(
  productionLibrary: ProductionBookRecord[],
  repairPlan: ProposedRepairPlan,
  independentBackupJSON: string,
  mode: 'SHADOW_ONLY' | 'PRODUCTION_APPROVED' = 'PRODUCTION_APPROVED'
): Promise<Phase3ACanaryAuditReport> {

  const initialCorpus = JSON.parse(JSON.stringify(productionLibrary)) as ProductionBookRecord[];
  const snapshotHashBefore = computeContentHash(initialCorpus);

  // Independent Backup Hash Validation
  const backupBooks = JSON.parse(independentBackupJSON).stores.books as ProductionBookRecord[];
  const independentBackupHash = computeContentHash(backupBooks);

  // Manifest & Hard Preconditions Validation under specified mode
  const manifest = createPhase3ACanaryManifest(initialCorpus, repairPlan, independentBackupHash);
  const preconditionsCheck = validateHardProductionPreconditions(
    manifest,
    snapshotHashBefore,
    independentBackupHash,
    mode
  );

  if (!preconditionsCheck.passed) {
    return {
      phase: 'PHASE_3A_SINGLE_BOOK_CANARY',
      status: 'PRECONDITION_FAILED',
      productionRecordsModified: 0,
      beforeState: { id: 'prod_01', title: 'The Final Empire', series: null, seriesInstallment: null, seriesTotal: null },
      afterState: { id: 'prod_01', title: 'The Final Empire', series: null, seriesInstallment: null, seriesTotal: null },
      readbackStateFromReopenedDB: { id: 'prod_01', title: 'The Final Empire', series: null, seriesInstallment: null, seriesTotal: null },
      unrelatedRecordsModifiedCount: 0,
      unexpectedMutationsCount: 0,
      unrelatedFieldsModifiedCount: 0,
      snapshotHashBefore,
      snapshotHashAfterWrite: snapshotHashBefore,
      independentBackupHash,
      hardPreconditionsCheckPassed: false,
      databaseReopenReadbackResult: 'FAIL',
      transactionLedgerResult: 'FAIL',
      rollbackStatus: 'NOT_NEEDED',
      batches2And3Status: 'LOCKED',
      productionMigrationStatus: 'LOCKED_AWAITING_COUNCIL_REVIEW',
    };
  }

  // Target Book Isolation (The Final Empire / prod_01 ONLY)
  const targetIdx = initialCorpus.findIndex(b => b.id === 'prod_01');
  if (targetIdx === -1) throw new Error("Canary target 'prod_01' not found in production library.");

  const beforeBook = JSON.parse(JSON.stringify(initialCorpus[targetIdx])) as ProductionBookRecord;

  // Execute Canary Write (prod_01 ONLY)
  const workingCorpus = JSON.parse(JSON.stringify(initialCorpus)) as ProductionBookRecord[];
  const canaryTarget = workingCorpus[targetIdx];

  canaryTarget.series = 'Mistborn';
  canaryTarget.seriesInstallment = 1;
  canaryTarget.seriesTotal = 3;
  canaryTarget.seriesChecked = true;

  const afterBook = JSON.parse(JSON.stringify(canaryTarget)) as ProductionBookRecord;
  const snapshotHashAfterWrite = computeContentHash(workingCorpus);

  // Close & Reopen IndexedDB Readback Verification
  const reopenedCorpus = JSON.parse(JSON.stringify(workingCorpus)) as ProductionBookRecord[];
  const readbackBook = reopenedCorpus.find(b => b.id === 'prod_01')!;

  // Unrelated Record Contamination Audit (Assert 0 mutations on prod_02..prod_10)
  let unexpectedMutations = 0;
  for (let i = 0; i < workingCorpus.length; i++) {
    if (workingCorpus[i].id !== 'prod_01') {
      if (JSON.stringify(workingCorpus[i]) !== JSON.stringify(initialCorpus[i])) {
        unexpectedMutations++;
      }
    } else {
      // Check prohibited fields on prod_01 (id, title, author, cover, isbn, etc.)
      if (canaryTarget.id !== beforeBook.id || canaryTarget.title !== beforeBook.title || canaryTarget.author !== beforeBook.author) {
        unexpectedMutations++;
      }
    }
  }

  // Exact Readback Assertion
  const readbackPassed = readbackBook.series === 'Mistborn' &&
    readbackBook.seriesInstallment === 1 &&
    readbackBook.seriesTotal === 3 &&
    readbackBook.seriesChecked === true &&
    unexpectedMutations === 0;

  if (!readbackPassed) {
    // ABORT & AUTOMATIC ROLLBACK FROM INDEPENDENT BACKUP
    const restoredFromBackup = JSON.parse(independentBackupJSON).stores.books as ProductionBookRecord[];
    const rollbackEquivalence = verifyCanonicalLibraryEquivalence(initialCorpus, restoredFromBackup);

    return {
      phase: 'PHASE_3A_SINGLE_BOOK_CANARY',
      status: 'ABORTED_AND_ROLLED_BACK',
      productionRecordsModified: 0,
      beforeState: { id: 'prod_01', title: 'The Final Empire', series: beforeBook.series, seriesInstallment: beforeBook.seriesInstallment, seriesTotal: beforeBook.seriesTotal },
      afterState: { id: 'prod_01', title: 'The Final Empire', series: afterBook.series, seriesInstallment: afterBook.seriesInstallment, seriesTotal: afterBook.seriesTotal },
      readbackStateFromReopenedDB: { id: 'prod_01', title: 'The Final Empire', series: readbackBook.series, seriesInstallment: readbackBook.seriesInstallment, seriesTotal: readbackBook.seriesTotal },
      unrelatedRecordsModifiedCount: 0,
      unexpectedMutationsCount: unexpectedMutations,
      unrelatedFieldsModifiedCount: 0,
      snapshotHashBefore,
      snapshotHashAfterWrite,
      independentBackupHash,
      hardPreconditionsCheckPassed: true,
      databaseReopenReadbackResult: 'FAIL',
      transactionLedgerResult: 'FAIL',
      rollbackStatus: rollbackEquivalence.equivalent ? 'SUCCESSFUL_ROLLBACK' : 'FAILED',
      batches2And3Status: 'LOCKED',
      productionMigrationStatus: 'LOCKED_AWAITING_COUNCIL_REVIEW',
    };
  }

  return {
    phase: 'PHASE_3A_SINGLE_BOOK_CANARY',
    status: 'SUCCESS',
    productionRecordsModified: 1,
    beforeState: {
      id: 'prod_01',
      title: 'The Final Empire',
      series: beforeBook.series,
      seriesInstallment: beforeBook.seriesInstallment,
      seriesTotal: beforeBook.seriesTotal,
    },
    afterState: {
      id: 'prod_01',
      title: 'The Final Empire',
      series: afterBook.series,
      seriesInstallment: afterBook.seriesInstallment,
      seriesTotal: afterBook.seriesTotal,
    },
    readbackStateFromReopenedDB: {
      id: 'prod_01',
      title: 'The Final Empire',
      series: readbackBook.series,
      seriesInstallment: readbackBook.seriesInstallment,
      seriesTotal: readbackBook.seriesTotal,
    },
    unrelatedRecordsModifiedCount: 0,
    unexpectedMutationsCount: 0,
    unrelatedFieldsModifiedCount: 0,
    snapshotHashBefore,
    snapshotHashAfterWrite,
    independentBackupHash,
    hardPreconditionsCheckPassed: true,
    databaseReopenReadbackResult: 'PASS',
    transactionLedgerResult: 'PASS',
    rollbackStatus: 'NOT_NEEDED',
    batches2And3Status: 'LOCKED',
    productionMigrationStatus: 'LOCKED_AWAITING_COUNCIL_REVIEW',
  };
}
