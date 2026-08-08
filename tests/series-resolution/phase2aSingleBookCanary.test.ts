// Phase 2A Deliverable: Controlled Single-Book Canary Write Test Suite (DISPOSABLE CLONE ONLY)

import { describe, it, expect } from 'vitest';
import { executeSingleBookCanary } from '../../server/utils/canaryMigrationAdapter';
import { ProductionBookRecord, createProductionSnapshot } from '../../server/utils/productionSnapshotEngine';
import { validateMutationAllowlist, isUserOverrideProtected } from '../../server/utils/migrationEngine';
import { ProposedBookDiff } from '../../server/utils/repairPlanGenerator';

describe('Phase 2A Controlled Single-Book Canary Write (DISPOSABLE CLONE ONLY)', () => {

  // Disposable clone library corpus (isolated from live physical device)
  const disposableCloneCorpus: ProductionBookRecord[] = [
    { id: 'dev_01', title: 'The Final Empire', author: 'Brandon Sanderson', series: null, seriesInstallment: null, seriesTotal: null, seriesChecked: true },
    { id: 'dev_02', title: 'The Well of Ascension', author: 'Brandon Sanderson', series: 'Mistborn', seriesInstallment: 2, seriesTotal: 1 },
    { id: 'dev_03', title: 'The Hero of Ages', author: 'Brandon Sanderson', series: 'Mistborn', seriesInstallment: 3, seriesTotal: 1 },
    { id: 'dev_04', title: 'User Protected Book', author: 'Custom Author', series: 'Custom Saga', seriesInstallment: 5, seriesTotal: 12, userDefined: { series: true } }
  ];

  const validCanaryDiff: ProposedBookDiff = {
    bookId: 'dev_01',
    title: 'The Final Empire',
    classification: 'SAFE_AUTO_REPAIR',
    before: { series: null, seriesInstallment: null, seriesTotal: null },
    after: { seriesName: 'Mistborn', ordinal: 1, mainWorksTotal: 3, membershipStatus: 'VERIFIED' },
    evidenceSources: ['wikidata', 'hardcover', 'goodreads'],
    confidence: { membership: 0.98, ordinal: 0.95, total: 0.95 },
    repairReason: 'Single-book canary repair for false standalone candidate.',
    isReversible: true,
  };

  it('1. Controlled Single-Book Canary Execution & Complete Rollback Verification', async () => {
    const report = await executeSingleBookCanary(disposableCloneCorpus, 'dev_01', validCanaryDiff);

    // Containment Assertions
    expect(report.productionLibraryModified).toBe(false);
    expect(report.productionBooksModified).toBe(0);
    expect(report.productionSnapshotChanged).toBe(false);
    expect(report.canaryBooksModified).toBe(1);
    expect(report.canaryRollbackStatus).toBe('SUCCESS');

    // Field & Firewall Assertions
    expect(report.fieldAllowlistVerified).toBe(true);
    expect(report.userOverrideFirewallVerified).toBe(true);

    // Hash Identity Verification
    expect(report.snapshotHashAfterRollback).toBe(report.snapshotHashBefore);
    expect(report.snapshotHashAfterWrite).not.toBe(report.snapshotHashBefore);

    // Details Verification
    expect(report.canaryBookDetails.before.series).toBeNull();
    expect(report.canaryBookDetails.after.series).toBe('Mistborn');
    expect(report.canaryBookDetails.after.seriesInstallment).toBe(1);
    expect(report.canaryBookDetails.after.seriesTotal).toBe(3);
    expect(report.canaryBookDetails.restored.series).toBeNull();
  });

  it('2. Deliberate Negative Test A: Rejects Malicious Non-Allowlisted Mutations', () => {
    const maliciousDiff: ProposedBookDiff = {
      bookId: 'dev_01',
      title: 'The Final Empire',
      classification: 'SAFE_AUTO_REPAIR',
      before: { series: null },
      after: { seriesName: 'Mistborn', author: 'MALICIOUS CHANGE' } as any,
      evidenceSources: ['hardcover'],
      confidence: { membership: 0.9, ordinal: 0.9, total: 0.9 },
      isReversible: true,
    };

    const check = validateMutationAllowlist(maliciousDiff);
    expect(check.valid).toBe(false);
    expect(check.forbiddenFields).toContain('author');
  });

  it('3. Deliberate Negative Test B: Rejects Mutations on User-Defined Override Books', async () => {
    const overrideBookDiff: ProposedBookDiff = {
      bookId: 'dev_04',
      title: 'User Protected Book',
      classification: 'SAFE_AUTO_REPAIR',
      before: { series: 'Custom Saga' },
      after: { seriesName: 'Overwritten Saga', ordinal: 1, mainWorksTotal: 1 },
      evidenceSources: ['hardcover'],
      confidence: { membership: 0.9, ordinal: 0.9, total: 0.9 },
      isReversible: true,
    };

    const isProtected = isUserOverrideProtected(disposableCloneCorpus[3]);
    expect(isProtected).toBe(true);

    await expect(
      executeSingleBookCanary(disposableCloneCorpus, 'dev_04', overrideBookDiff)
    ).rejects.toThrow('protected by user-defined overrides');
  });
});
