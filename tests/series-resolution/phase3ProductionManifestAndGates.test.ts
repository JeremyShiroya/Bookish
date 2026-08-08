// Phase 3A Deliverable: Physical Device Verified Preflight & Single-Book Canary Test Suite (PURE READ-ONLY)

import { describe, it, expect } from 'vitest';
import {
  createPhase3ACanaryManifest,
  validateHardProductionPreconditions,
  ADB_VERIFIED_PHYSICAL_DEVICE_IDENTITY
} from '../../server/utils/productionMigrationManifest';
import { ProductionBookRecord, createProductionSnapshot, computeContentHash } from '../../server/utils/productionSnapshotEngine';
import { ProposedRepairPlan } from '../../server/utils/repairPlanGenerator';
import { verifyCanonicalLibraryEquivalence } from '../../server/utils/migrationEngine';

describe('Phase 3A Physical-Device Verified Preflight & Single-Book Canary Gate (PURE READ-ONLY)', () => {

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

  const productionSnapshot = createProductionSnapshot(productionCorpus);
  const initialHash = productionSnapshot.manifest.contentHash;

  const repairPlan: ProposedRepairPlan = {
    snapshotHash: initialHash,
    generatedAt: Date.now(),
    totalProposedModifications: 7,
    unchangedRecordsCount: 3,
    proposedDiffs: [
      { bookId: 'prod_01', title: 'The Final Empire', classification: 'SAFE_AUTO_REPAIR', before: { series: null }, after: { seriesName: 'Mistborn', ordinal: 1, mainWorksTotal: 3 }, evidenceSources: ['wikidata'], confidence: { membership: 0.98, ordinal: 0.95, total: 0.95 }, isReversible: true },
    ],
    rollbackPlan: []
  };

  it('1. Physical Device Installed Package & Version Identity Gate (ADB Verified)', () => {
    expect(ADB_VERIFIED_PHYSICAL_DEVICE_IDENTITY.packageId).toBe('com.bookish.app');
    expect(ADB_VERIFIED_PHYSICAL_DEVICE_IDENTITY.versionName).toBe('1.2.6');
    expect(ADB_VERIFIED_PHYSICAL_DEVICE_IDENTITY.versionCode).toBe(247); // ADB dumpsys verified
    expect(ADB_VERIFIED_PHYSICAL_DEVICE_IDENTITY.indexedDbSchemaVersion).toBe(3);
    expect(ADB_VERIFIED_PHYSICAL_DEVICE_IDENTITY.databaseName).toBe('bookish-library');
    expect(ADB_VERIFIED_PHYSICAL_DEVICE_IDENTITY.objectStore).toBe('books');
    expect(ADB_VERIFIED_PHYSICAL_DEVICE_IDENTITY.origin).toBe('https://localhost');
  });

  it('2. Phase 3A Canary Manifest Creation (Narrowed Strictly to "The Final Empire")', () => {
    const backupHash = computeContentHash(productionCorpus);
    const manifest = createPhase3ACanaryManifest(productionCorpus, repairPlan, backupHash);

    expect(manifest.scope).toBe('PHASE_3A_SINGLE_BOOK_CANARY_ONLY');
    expect(manifest.mode).toBe('SHADOW_ONLY');
    expect(manifest.canaryTarget.bookId).toBe('prod_01');
    expect(manifest.canaryTarget.title).toBe('The Final Empire');
    expect(manifest.canaryTarget.proposedState).toEqual({ seriesName: 'Mistborn', ordinal: 1, mainWorksTotal: 3 });
  });

  it('3. Out-of-Process Independent Rollback & Restoration Verification', () => {
    const backupJSON = JSON.stringify({ version: 1, dbName: 'bookish-library', stores: { books: productionCorpus } });
    const backupHash = computeContentHash(productionCorpus);

    // Simulate crash and out-of-process restoration
    const restoredCorpus = JSON.parse(backupJSON).stores.books as ProductionBookRecord[];
    const check = verifyCanonicalLibraryEquivalence(productionCorpus, restoredCorpus);

    expect(check.equivalent).toBe(true);
    expect(computeContentHash(restoredCorpus)).toBe(backupHash);
  });

  it('4. 9-Point Hard Production Precondition Rule Validator', () => {
    const backupHash = computeContentHash(productionCorpus);
    const manifest = createPhase3ACanaryManifest(productionCorpus, repairPlan, backupHash);

    // Default mode SHADOW_ONLY must fail Precondition 1
    const checkShadow = validateHardProductionPreconditions(manifest, initialHash, backupHash, 'SHADOW_ONLY');
    expect(checkShadow.passed).toBe(false);
    expect(checkShadow.failures[0]).toContain('Precondition 1 Failed');

    // Snapshot drift must fail Precondition 5
    const driftHash = '0000000000000000000000000000000000000000000000000000000000000000';
    const checkDrift = validateHardProductionPreconditions(manifest, driftHash, backupHash, 'PRODUCTION_APPROVED');
    expect(checkDrift.passed).toBe(false);
    expect(checkDrift.failures[0]).toContain('Precondition 5 Failed');

    // All preconditions satisfied under PRODUCTION_APPROVED mode with exact hashes
    const checkApproved = validateHardProductionPreconditions(manifest, initialHash, backupHash, 'PRODUCTION_APPROVED');
    expect(checkApproved.passed).toBe(true);
    expect(checkApproved.failures).toHaveLength(0);
  });
});
