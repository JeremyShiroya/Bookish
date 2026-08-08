// Phase 1E Deliverable: Round-Trip Reversibility, Mutation Allowlist & Safety Firewalls Test Suite

import { describe, it, expect } from 'vitest';
import { createProductionSnapshot, computeContentHash, ProductionBookRecord } from '../../server/utils/productionSnapshotEngine';
import { runLiveShadowAudit } from '../../server/utils/liveShadowAuditEngine';
import { generateRepairAndRollbackPlan, ProposedRepairPlan } from '../../server/utils/repairPlanGenerator';
import {
  simulateApplyRepairPlan,
  simulateRollbackRepairPlan,
  verifyCanonicalLibraryEquivalence,
  validateMutationAllowlist,
  ALLOWED_REPAIR_FIELDS
} from '../../server/utils/migrationEngine';
import { EvidenceItem } from '../../server/utils/seriesDomainTypes';

describe('Phase 1E Round-Trip Reversibility, Mutation Allowlist & Safety Firewalls', () => {

  const sampleLibraryCorpus: ProductionBookRecord[] = [
    { id: 'book_01', title: 'The Final Empire', author: 'Brandon Sanderson', series: null, seriesInstallment: null, seriesTotal: null, seriesChecked: true },
    { id: 'book_02', title: 'The Well of Ascension', author: 'Brandon Sanderson', series: 'Mistborn', seriesInstallment: 2, seriesTotal: 1 },
    { id: 'book_03', title: 'The Hero of Ages', author: 'Brandon Sanderson', series: 'Mistborn', seriesInstallment: 3, seriesTotal: 1 },
    { id: 'book_04', title: 'User Protected Book', author: 'Custom Author', series: 'Custom Series', seriesInstallment: 4, seriesTotal: 10, userDefined: { series: true } }
  ];

  const evidenceMap: Record<string, EvidenceItem[]> = {
    book_01: [
      { provider: 'wikidata', claim: 'SERIES_MEMBERSHIP', value: 'Mistborn', confidence: 0.98, weight: 1.0, independenceGroup: 'wikidata', retrievedAt: Date.now() },
      { provider: 'hardcover', claim: 'SERIES_MEMBERSHIP', value: 'Mistborn', confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
      { provider: 'hardcover', claim: 'SERIES_ORDINAL', value: 1, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
      { provider: 'hardcover', claim: 'SERIES_TOTAL', value: 3, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
    ],
    book_02: [
      { provider: 'hardcover', claim: 'SERIES_TOTAL', value: 3, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
      { provider: 'goodreads', claim: 'SERIES_TOTAL', value: 3, confidence: 0.95, weight: 1.0, independenceGroup: 'goodreads', retrievedAt: Date.now() },
    ],
    book_03: [
      { provider: 'hardcover', claim: 'SERIES_TOTAL', value: 3, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
      { provider: 'goodreads', claim: 'SERIES_TOTAL', value: 3, confidence: 0.95, weight: 1.0, independenceGroup: 'goodreads', retrievedAt: Date.now() },
    ],
    book_04: [],
  };

  it('1. Round-Trip Reversibility: restore(apply(snapshot)) === snapshot', () => {
    const beforeSnapshot = createProductionSnapshot(sampleLibraryCorpus);
    const initialHash = beforeSnapshot.manifest.contentHash;

    // Generate repair plan
    const audit = runLiveShadowAudit(beforeSnapshot.books, evidenceMap);
    const plan = generateRepairAndRollbackPlan(beforeSnapshot.books, audit.proposals, initialHash);

    // Apply simulated repair
    const applyResult = simulateApplyRepairPlan(beforeSnapshot.books, plan, initialHash);
    expect(applyResult.success).toBe(true);

    // Apply simulated rollback
    const restoredLibrary = simulateRollbackRepairPlan(applyResult.modifiedBooks, applyResult.rollbackActions);

    // Verify canonical library equivalence
    const check = verifyCanonicalLibraryEquivalence(beforeSnapshot.books, restoredLibrary);
    if (!check.equivalent) {
      console.log('DIFFERENCES DETECTED:', check.differences);
    }
    expect(check.equivalent).toBe(true);
    expect(check.differences).toHaveLength(0);
  });

  it('2. Mutation Allowlist Firewall: Rejects modifications to forbidden fields', () => {
    const check = validateMutationAllowlist({
      bookId: 'book_01',
      title: 'The Final Empire',
      classification: 'SAFE_AUTO_REPAIR',
      before: { series: null },
      after: { seriesName: 'Mistborn', ordinal: 1, mainWorksTotal: 3 },
      evidenceSources: [],
      confidence: { membership: 0.9, ordinal: 0.9, total: 0.9 },
      isReversible: true,
    });

    expect(check.valid).toBe(true);

    // Attempt invalid modification to forbidden 'author' field
    const forbiddenCheck = validateMutationAllowlist({
      bookId: 'book_01',
      title: 'The Final Empire',
      classification: 'SAFE_AUTO_REPAIR',
      before: { series: null },
      after: { seriesName: 'Mistborn', author: 'Malicious Author' } as any,
      evidenceSources: [],
      confidence: { membership: 0.9, ordinal: 0.9, total: 0.9 },
      isReversible: true,
    });

    expect(forbiddenCheck.valid).toBe(false);
    expect(forbiddenCheck.forbiddenFields).toContain('author');
  });

  it('3. User-Override Firewall at Persistence Boundary: Rejects protected books', () => {
    const beforeSnapshot = createProductionSnapshot(sampleLibraryCorpus);
    const initialHash = beforeSnapshot.manifest.contentHash;

    // Construct malicious plan attempting to overwrite user-defined book_04
    const maliciousPlan: ProposedRepairPlan = {
      snapshotHash: initialHash,
      generatedAt: Date.now(),
      totalProposedModifications: 1,
      unchangedRecordsCount: 3,
      proposedDiffs: [
        {
          bookId: 'book_04',
          title: 'User Protected Book',
          classification: 'SAFE_AUTO_REPAIR',
          before: { series: 'Custom Series' },
          after: { seriesName: 'Overwritten Series', ordinal: 1, mainWorksTotal: 1 },
          evidenceSources: ['hardcover'],
          confidence: { membership: 0.9, ordinal: 0.9, total: 0.9 },
          isReversible: true,
        }
      ],
      rollbackPlan: [],
    };

    const applyResult = simulateApplyRepairPlan(beforeSnapshot.books, maliciousPlan, initialHash);
    expect(applyResult.success).toBe(false);
    expect(applyResult.manifest.status).toBe('REJECTED_USER_OVERRIDE');
    expect(applyResult.error).toContain('user-defined overrides');
  });

  it('4. Stale-Snapshot Protection: Rejects plan if library modified after plan creation', () => {
    const beforeSnapshot = createProductionSnapshot(sampleLibraryCorpus);
    const plan = generateRepairAndRollbackPlan(beforeSnapshot.books, [], beforeSnapshot.manifest.contentHash);

    const staleHash = '0000000000000000000000000000000000000000000000000000000000000000';

    const result = simulateApplyRepairPlan(beforeSnapshot.books, plan, staleHash);
    expect(result.success).toBe(false);
    expect(result.manifest.status).toBe('REJECTED_STALE_HASH');
    expect(result.error).toContain('Migration rejected: Current snapshot hash');
  });

  it('5. Idempotency Proof: runMigration() === runMigration() + runMigration()', () => {
    const beforeSnapshot = createProductionSnapshot(sampleLibraryCorpus);
    const initialHash = beforeSnapshot.manifest.contentHash;

    const audit = runLiveShadowAudit(beforeSnapshot.books, evidenceMap);
    const plan = generateRepairAndRollbackPlan(beforeSnapshot.books, audit.proposals, initialHash);

    // First execution
    const run1 = simulateApplyRepairPlan(beforeSnapshot.books, plan, initialHash);
    expect(run1.success).toBe(true);

    // Second execution against modified library (new snapshot hash generated for updated state)
    const run1Hash = computeContentHash(run1.modifiedBooks);
    const planRun2 = generateRepairAndRollbackPlan(run1.modifiedBooks, audit.proposals, run1Hash);

    const run2 = simulateApplyRepairPlan(run1.modifiedBooks, planRun2, run1Hash);
    expect(run2.success).toBe(true);

    // Equivalence check between run1 and run2
    const check = verifyCanonicalLibraryEquivalence(run1.modifiedBooks, run2.modifiedBooks);
    expect(check.equivalent).toBe(true);
  });
});
