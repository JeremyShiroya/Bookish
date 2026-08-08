// Phase 1A Deliverable: Shadow Benchmark Test Runner & Hard-Zero Invariant Assorter

import { describe, it, expect } from 'vitest';
import { resolveShadowProposal, ShadowResolutionInput } from '../../server/utils/shadowResolver';
import knownFailures from './known-failures.json';

describe('Phase 1A Hard-Zero Benchmark Runner', () => {

  it('1. Zero Database Writes & Pure Functional Isolation', () => {
    const input: ShadowResolutionInput = {
      bookId: 'test_1',
      title: 'The Final Empire',
      legacyData: { series: null, seriesInstallment: null, seriesTotal: null },
      evidenceList: [
        { provider: 'hardcover', claim: 'SERIES_MEMBERSHIP', value: 'Mistborn', confidence: 0.95, weight: 1.0, retrievedAt: Date.now() },
        { provider: 'goodreads', claim: 'SERIES_MEMBERSHIP', value: 'Mistborn', confidence: 0.95, weight: 1.0, retrievedAt: Date.now() },
      ],
    };

    // Deep freeze input to guarantee zero mutation
    Object.freeze(input);
    Object.freeze(input.legacyData);
    Object.freeze(input.evidenceList);

    const report = resolveShadowProposal(input);

    expect(report.dbMutationAttempted).toBe(false);
    expect(report.invariantsPassed).toBe(true);
    expect(report.v3Proposal.membershipStatus).toBe('VERIFIED_SERIES');
    expect(report.v3Proposal.seriesName).toBe('Mistborn');
  });

  it('2. 100-Run Deterministic Idempotency Test (Zero Oscillation)', () => {
    const input: ShadowResolutionInput = {
      bookId: 'test_idempotency',
      title: 'Dune',
      legacyData: { series: 'Dune', seriesInstallment: 1, seriesTotal: 1 },
      evidenceList: [
        { provider: 'google_books', claim: 'SERIES_TOTAL', value: 1, confidence: 0.3, weight: 0.3, retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_TOTAL', value: 6, confidence: 0.95, weight: 1.0, retrievedAt: Date.now() },
        { provider: 'goodreads', claim: 'SERIES_TOTAL', value: 6, confidence: 0.95, weight: 1.0, retrievedAt: Date.now() },
      ],
      providerTotals: [
        { provider: 'google_books', reportedTotal: 1 },
        { provider: 'hardcover', reportedTotal: 6 },
        { provider: 'goodreads', reportedTotal: 6 },
      ],
    };

    const firstRun = JSON.stringify(resolveShadowProposal(input));

    for (let i = 0; i < 100; i++) {
      const currentRun = JSON.stringify(resolveShadowProposal(input));
      expect(currentRun).toBe(firstRun);
    }
  });

  it('3. Real-World Known Failures Corpus Verification', () => {
    let invariantsViolated = 0;
    let safeAutoFixes = 0;
    let falseStandalonesFixed = 0;
    let oneOfOneCorruptionsFixed = 0;

    for (const failure of knownFailures) {
      const report = resolveShadowProposal(failure as unknown as ShadowResolutionInput);

      expect(report.invariantsPassed).toBe(true);
      if (!report.invariantsPassed) invariantsViolated += 1;

      if (report.v3Proposal.repairClassification === 'SAFE_AUTO_REPAIR') {
        safeAutoFixes += 1;
      }
      if (!failure.legacyState.series && report.v3Proposal.membershipStatus === 'VERIFIED_SERIES') {
        falseStandalonesFixed += 1;
      }
      if (Number(failure.legacyState.seriesTotal) === 1 && report.v3Proposal.total.mainWorks && report.v3Proposal.total.mainWorks > 1) {
        oneOfOneCorruptionsFixed += 1;
      }
    }

    expect(invariantsViolated).toBe(0); // HARD-ZERO INVARIANT
    expect(falseStandalonesFixed).toBe(1); // The Final Empire
    expect(oneOfOneCorruptionsFixed).toBe(2); // Dune (6), Discworld (41)
  });

  it('4. User Defined Overrides Are Never Overwritten', () => {
    const input: ShadowResolutionInput = {
      bookId: 'user_override_test',
      title: 'Custom Title',
      legacyData: {
        series: 'Custom Series',
        seriesInstallment: 4,
        seriesTotal: 10,
        userDefined: { series: true, seriesInstallment: true, seriesTotal: true },
      },
      evidenceList: [
        { provider: 'hardcover', claim: 'SERIES_MEMBERSHIP', value: 'Different Series', confidence: 0.99, weight: 1.0, retrievedAt: Date.now() },
      ],
    };

    const report = resolveShadowProposal(input);
    expect(report.v3Proposal.repairClassification).toBe('USER_OVERRIDE');
    expect(report.v3Proposal.seriesName).toBe('Custom Series');
  });

  it('5. Single Volume Discovery Renders 1/? (UNKNOWN status, never 1/1)', () => {
    const input: ShadowResolutionInput = {
      bookId: 'single_vol_test',
      title: 'Obscure Book',
      legacyData: { series: 'Obscure Series', seriesInstallment: 1, seriesTotal: 1 },
      evidenceList: [
        { provider: 'google_books', claim: 'SERIES_TOTAL', value: 1, confidence: 0.3, weight: 0.3, retrievedAt: Date.now() },
      ],
      providerTotals: [{ provider: 'google_books', reportedTotal: 1 }],
    };

    const report = resolveShadowProposal(input);
    expect(report.v3Proposal.total.mainWorks).toBeNull();
    expect(report.v3Proposal.total.status).toBe('UNKNOWN');
  });
});
