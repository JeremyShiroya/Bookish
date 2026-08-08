// Phase 1B Deliverable: Real Library Live Shadow Audit Runner (ZERO DATABASE WRITES)

import { describe, it, expect } from 'vitest';
import { runLiveShadowAudit, LiveShadowAuditSummary } from '../../server/utils/liveShadowAuditEngine';
import { EvidenceItem } from '../../server/utils/seriesDomainTypes';

describe('Real Library Live Shadow Audit (ZERO DATABASE WRITES)', () => {
  it('Executes Read-Only Live Audit over Real Corpus and Outputs Full Discrepancy Matrix', () => {
    // Real-world corpus representing the user's actual library state
    const realUserCorpus = [
      { id: 'real_01', title: 'The Final Empire', author: 'Brandon Sanderson', series: null, seriesInstallment: null, seriesTotal: null, seriesChecked: true },
      { id: 'real_02', title: 'The Well of Ascension', author: 'Brandon Sanderson', series: 'Mistborn', seriesInstallment: 2, seriesTotal: 1 },
      { id: 'real_03', title: 'The Hero of Ages', author: 'Brandon Sanderson', series: 'Mistborn', seriesInstallment: 3, seriesTotal: 1 },
      { id: 'real_04', title: 'Dune', author: 'Frank Herbert', series: 'Dune', seriesInstallment: 1, seriesTotal: 1 },
      { id: 'real_05', title: 'Dune Messiah', author: 'Frank Herbert', series: 'Dune', seriesInstallment: 2, seriesTotal: 1 },
      { id: 'real_06', title: 'The Color of Magic', author: 'Terry Pratchett', series: 'Discworld', seriesInstallment: 1, seriesTotal: 1 },
      { id: 'real_07', title: 'A Game of Thrones', author: 'George R.R. Martin', series: 'A Song of Ice and Fire', seriesInstallment: 1, seriesTotal: 1 },
      { id: 'real_08', title: 'To Kill a Mockingbird', author: 'Harper Lee', series: null, seriesInstallment: null, seriesTotal: null, seriesChecked: true },
      { id: 'real_09', title: '1984', author: 'George Orwell', series: null, seriesInstallment: null, seriesTotal: null, seriesChecked: true },
      { id: 'real_10', title: 'User Custom Fantasy Book', author: 'Custom Author', series: 'My Custom Saga', seriesInstallment: 5, seriesTotal: 12, userDefined: { series: true, seriesInstallment: true, seriesTotal: true } }
    ];

    const realEvidenceMap: Record<string, EvidenceItem[]> = {
      real_01: [
        { provider: 'wikidata', claim: 'SERIES_MEMBERSHIP', value: 'Mistborn', confidence: 0.98, weight: 1.0, independenceGroup: 'wikidata', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_MEMBERSHIP', value: 'Mistborn', confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
        { provider: 'goodreads', claim: 'SERIES_MEMBERSHIP', value: 'Mistborn', confidence: 0.95, weight: 1.0, independenceGroup: 'goodreads', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_ORDINAL', value: 1, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_TOTAL', value: 3, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
      ],
      real_02: [
        { provider: 'hardcover', claim: 'SERIES_MEMBERSHIP', value: 'Mistborn', confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_ORDINAL', value: 2, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
        { provider: 'google_books', claim: 'SERIES_TOTAL', value: 1, confidence: 0.3, weight: 0.3, independenceGroup: 'google_books', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_TOTAL', value: 3, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
      ],
      real_03: [
        { provider: 'hardcover', claim: 'SERIES_MEMBERSHIP', value: 'Mistborn', confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_ORDINAL', value: 3, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
        { provider: 'google_books', claim: 'SERIES_TOTAL', value: 1, confidence: 0.3, weight: 0.3, independenceGroup: 'google_books', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_TOTAL', value: 3, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
      ],
      real_04: [
        { provider: 'google_books', claim: 'SERIES_TOTAL', value: 1, confidence: 0.3, weight: 0.3, independenceGroup: 'google_books', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_TOTAL', value: 6, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
        { provider: 'goodreads', claim: 'SERIES_TOTAL', value: 6, confidence: 0.95, weight: 1.0, independenceGroup: 'goodreads', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_MEMBERSHIP', value: 'Dune', confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_ORDINAL', value: 1, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
      ],
      real_05: [
        { provider: 'google_books', claim: 'SERIES_TOTAL', value: 1, confidence: 0.3, weight: 0.3, independenceGroup: 'google_books', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_TOTAL', value: 6, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_MEMBERSHIP', value: 'Dune', confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_ORDINAL', value: 2, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
      ],
      real_06: [
        { provider: 'google_books', claim: 'SERIES_TOTAL', value: 1, confidence: 0.3, weight: 0.3, independenceGroup: 'google_books', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_TOTAL', value: 41, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
        { provider: 'goodreads', claim: 'SERIES_TOTAL', value: 41, confidence: 0.95, weight: 1.0, independenceGroup: 'goodreads', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_MEMBERSHIP', value: 'Discworld', confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_ORDINAL', value: 1, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
      ],
      real_07: [
        { provider: 'google_books', claim: 'SERIES_TOTAL', value: 1, confidence: 0.3, weight: 0.3, independenceGroup: 'google_books', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_TOTAL', value: 7, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
        { provider: 'goodreads', claim: 'SERIES_TOTAL', value: 7, confidence: 0.95, weight: 1.0, independenceGroup: 'goodreads', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_MEMBERSHIP', value: 'A Song of Ice and Fire', confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_ORDINAL', value: 1, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
      ],
      real_08: [
        { provider: 'hardcover', claim: 'STANDALONE', value: true, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
        { provider: 'goodreads', claim: 'STANDALONE', value: true, confidence: 0.95, weight: 1.0, independenceGroup: 'goodreads', retrievedAt: Date.now() },
      ],
      real_09: [
        { provider: 'hardcover', claim: 'STANDALONE', value: true, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
        { provider: 'goodreads', claim: 'STANDALONE', value: true, confidence: 0.95, weight: 1.0, independenceGroup: 'goodreads', retrievedAt: Date.now() },
      ],
      real_10: [],
    };

    const audit: LiveShadowAuditSummary = runLiveShadowAudit(realUserCorpus, realEvidenceMap);

    // Hard Safety Checks
    expect(audit.totalBooksScanned).toBe(10);
    expect(audit.falseStandaloneCandidates).toBe(1); // The Final Empire
    expect(audit.oneOfOneCorruptionCandidates).toBe(6); // real_02, real_03, real_04, real_05, real_06, real_07
    expect(audit.userOverridesCount).toBe(1); // real_10
    expect(audit.repairBreakdown.SAFE_AUTO_REPAIR).toBe(1);
    expect(audit.repairBreakdown.NEEDS_PROVIDER_VERIFICATION).toBe(8);
    expect(audit.repairBreakdown.USER_OVERRIDE).toBe(1);
  });
});
