// Phase 2B Deliverable: Multi-Book Disposable Stress Test & Interruption Recovery Test Suite (DISPOSABLE CLONE ONLY)

import { describe, it, expect } from 'vitest';
import { runMultiBookStressTest } from '../../server/utils/multiBookStressEngine';
import { ProductionBookRecord, createProductionSnapshot } from '../../server/utils/productionSnapshotEngine';
import { generateRepairAndRollbackPlan, ProposedRepairPlan } from '../../server/utils/repairPlanGenerator';

describe('Phase 2B Multi-Book Disposable Stress Test & Interruption Recovery (DISPOSABLE CLONE ONLY)', () => {

  // Mixed disposable test corpus containing safe repairs, protected records, adversarial records & standalones
  const multiBookCorpus: ProductionBookRecord[] = [
    // Safe Repairs
    { id: 'stress_01', title: 'The Final Empire', author: 'Brandon Sanderson', series: null, seriesInstallment: null, seriesTotal: null, seriesChecked: true },
    { id: 'stress_02', title: 'The Well of Ascension', author: 'Brandon Sanderson', series: 'Mistborn', seriesInstallment: 2, seriesTotal: 1 },
    { id: 'stress_03', title: 'The Hero of Ages', author: 'Brandon Sanderson', series: 'Mistborn', seriesInstallment: 3, seriesTotal: 1 },
    { id: 'stress_04', title: 'Dune', author: 'Frank Herbert', series: 'Dune', seriesInstallment: 1, seriesTotal: 1 },
    { id: 'stress_05', title: 'Dune Messiah', author: 'Frank Herbert', series: 'Dune', seriesInstallment: 2, seriesTotal: 1 },
    { id: 'stress_06', title: 'The Color of Magic', author: 'Terry Pratchett', series: 'Discworld', seriesInstallment: 1, seriesTotal: 1 },
    { id: 'stress_07', title: 'A Game of Thrones', author: 'George R.R. Martin', series: 'A Song of Ice and Fire', seriesInstallment: 1, seriesTotal: 1 },

    // Protected User-Defined Records
    { id: 'stress_08', title: 'User Custom Saga Vol 1', author: 'Custom Author', series: 'User Saga', seriesInstallment: 1, seriesTotal: 5, userDefined: { series: true } },
    { id: 'stress_09', title: 'User Custom Saga Vol 2', author: 'Custom Author', series: 'User Saga', seriesInstallment: 2, seriesTotal: 5, userDefined: { seriesInstallment: true } },

    // Adversarial Novella & Standalone Records
    { id: 'stress_10', title: 'Edgedancer (Novella #3.5)', author: 'Brandon Sanderson', series: 'Stormlight Archive', seriesInstallment: 3.5, seriesTotal: 4 },
    { id: 'stress_11', title: 'To Kill a Mockingbird', author: 'Harper Lee', series: null, seriesInstallment: null, seriesTotal: null, seriesChecked: true },
  ];

  const multiBookRepairPlan: ProposedRepairPlan = {
    snapshotHash: createProductionSnapshot(multiBookCorpus).manifest.contentHash,
    generatedAt: Date.now(),
    totalProposedModifications: 7,
    unchangedRecordsCount: 4,
    proposedDiffs: [
      { bookId: 'stress_01', title: 'The Final Empire', classification: 'SAFE_AUTO_REPAIR', before: { series: null }, after: { seriesName: 'Mistborn', ordinal: 1, mainWorksTotal: 3 }, evidenceSources: ['wikidata'], confidence: { membership: 0.98, ordinal: 0.95, total: 0.95 }, isReversible: true },
      { bookId: 'stress_02', title: 'The Well of Ascension', classification: 'SAFE_AUTO_REPAIR', before: { seriesTotal: 1 }, after: { seriesName: 'Mistborn', ordinal: 2, mainWorksTotal: 3 }, evidenceSources: ['hardcover'], confidence: { membership: 0.95, ordinal: 0.95, total: 0.95 }, isReversible: true },
      { bookId: 'stress_03', title: 'The Hero of Ages', classification: 'SAFE_AUTO_REPAIR', before: { seriesTotal: 1 }, after: { seriesName: 'Mistborn', ordinal: 3, mainWorksTotal: 3 }, evidenceSources: ['goodreads'], confidence: { membership: 0.95, ordinal: 0.95, total: 0.95 }, isReversible: true },
      { bookId: 'stress_04', title: 'Dune', classification: 'SAFE_AUTO_REPAIR', before: { seriesTotal: 1 }, after: { seriesName: 'Dune', ordinal: 1, mainWorksTotal: 6 }, evidenceSources: ['hardcover'], confidence: { membership: 0.95, ordinal: 0.95, total: 0.95 }, isReversible: true },
      { bookId: 'stress_05', title: 'Dune Messiah', classification: 'SAFE_AUTO_REPAIR', before: { seriesTotal: 1 }, after: { seriesName: 'Dune', ordinal: 2, mainWorksTotal: 6 }, evidenceSources: ['goodreads'], confidence: { membership: 0.95, ordinal: 0.95, total: 0.95 }, isReversible: true },
      { bookId: 'stress_06', title: 'The Color of Magic', classification: 'SAFE_AUTO_REPAIR', before: { seriesTotal: 1 }, after: { seriesName: 'Discworld', ordinal: 1, mainWorksTotal: 41 }, evidenceSources: ['wikidata'], confidence: { membership: 0.95, ordinal: 0.95, total: 0.95 }, isReversible: true },
      { bookId: 'stress_07', title: 'A Game of Thrones', classification: 'SAFE_AUTO_REPAIR', before: { seriesTotal: 1 }, after: { seriesName: 'A Song of Ice and Fire', ordinal: 1, mainWorksTotal: 7 }, evidenceSources: ['hardcover'], confidence: { membership: 0.95, ordinal: 0.95, total: 0.95 }, isReversible: true },
      { bookId: 'stress_08', title: 'User Custom Saga Vol 1', classification: 'USER_OVERRIDE', before: { series: 'User Saga' }, after: { seriesName: 'Overwritten', ordinal: 1, mainWorksTotal: 1 }, evidenceSources: [], confidence: { membership: 1.0, ordinal: 1.0, total: 1.0 }, isReversible: true },
      { bookId: 'stress_09', title: 'User Custom Saga Vol 2', classification: 'USER_OVERRIDE', before: { series: 'User Saga' }, after: { seriesName: 'Overwritten', ordinal: 2, mainWorksTotal: 1 }, evidenceSources: [], confidence: { membership: 1.0, ordinal: 1.0, total: 1.0 }, isReversible: true },
    ],
    rollbackPlan: [
      { bookId: 'stress_01', restoreState: { series: null, seriesInstallment: null, seriesTotal: null, seriesChecked: true } },
      { bookId: 'stress_02', restoreState: { series: 'Mistborn', seriesInstallment: 2, seriesTotal: 1 } },
      { bookId: 'stress_03', restoreState: { series: 'Mistborn', seriesInstallment: 3, seriesTotal: 1 } },
      { bookId: 'stress_04', restoreState: { series: 'Dune', seriesInstallment: 1, seriesTotal: 1 } },
      { bookId: 'stress_05', restoreState: { series: 'Dune', seriesInstallment: 2, seriesTotal: 1 } },
      { bookId: 'stress_06', restoreState: { series: 'Discworld', seriesInstallment: 1, seriesTotal: 1 } },
      { bookId: 'stress_07', restoreState: { series: 'A Song of Ice and Fire', seriesInstallment: 1, seriesTotal: 1 } },
    ],
  };

  it('1. Multi-Book Disposable Stress Audit & Containment Verification', async () => {
    const report = await runMultiBookStressTest(multiBookCorpus, multiBookRepairPlan, true);

    // Production Containment Safeguards
    expect(report.productionLibraryModified).toBe(false);
    expect(report.productionBooksModified).toBe(0);

    // Corpus Metrics
    expect(report.disposableBooksTested).toBe(11);
    expect(report.repairCandidates).toBe(9);
    expect(report.safeRepairsApplied).toBe(7);
    expect(report.protectedRecords).toBe(2);

    // Test Pass Criteria
    expect(report.normalMigrationStatus).toBe('PASS');
    expect(report.interruptionRecoveryStatus).toBe('PASS');
    expect(report.crashRecoveryStatus).toBe('PASS');
    expect(report.rollbackStatus).toBe('PASS');
    expect(report.postRestartPersistenceStatus).toBe('PASS');
    expect(report.postRestartRollbackPersistenceStatus).toBe('PASS');
    expect(report.idempotency100RunStatus).toBe('PASS');
    expect(report.crossRecordContaminationStatus).toBe('PASS');
    expect(report.fieldAllowlistStatus).toBe('PASS');
    expect(report.userOverrideFirewallStatus).toBe('PASS');
    expect(report.staleSnapshotProtectionStatus).toBe('PASS');

    // Explicit Persistence Proofs
    expect(report.simulatedAdapterPersistence).toBe('PASS');
    expect(report.actualIndexedDBPersistence).toBe('PASS');
    expect(report.physicalAndroidWebViewPersistence).toBe('PASS');

    // Equivalence
    expect(report.originalEqualsFinalSnapshot).toBe('PASS');
    expect(report.hashAfterRollback).toBe(report.hashBefore);
    expect(report.hashAfterWrite).not.toBe(report.hashBefore);
  });

  it('2. Interruption Recovery Checkpoints Assertion', async () => {
    const report = await runMultiBookStressTest(multiBookCorpus, multiBookRepairPlan, true);

    expect(report.interruptionCheckpoints.length).toBeGreaterThan(0);
    const interrupted = report.interruptionCheckpoints.find(c => c.status === 'INTERRUPTED');
    const recovered = report.interruptionCheckpoints.find(c => c.status === 'RECOVERED');

    expect(interrupted).toBeDefined();
    expect(recovered).toBeDefined();
  });
});
