// Phase 1B Deliverable: Live Read-Only Shadow Audit Test Suite

import { describe, it, expect } from 'vitest';
import { runLiveShadowAudit } from '../../server/utils/liveShadowAuditEngine';
import { EvidenceItem } from '../../server/utils/seriesDomainTypes';

describe('Phase 1B Live Shadow Audit Suite (ZERO DATABASE WRITES)', () => {

  it('1. Execute Live Read-Only Shadow Audit on Sample User Library', () => {
    const userBooks = [
      { id: 'b1', title: 'The Final Empire', author: 'Brandon Sanderson', series: null, seriesInstallment: null, seriesTotal: null },
      { id: 'b2', title: 'The Well of Ascension', author: 'Brandon Sanderson', series: 'Mistborn', seriesInstallment: 2, seriesTotal: 1 },
      { id: 'b3', title: 'Dune', author: 'Frank Herbert', series: 'Dune', seriesInstallment: 1, seriesTotal: 1 },
      { id: 'b4', title: 'The Color of Magic', author: 'Terry Pratchett', series: 'Discworld', seriesInstallment: 1, seriesTotal: 1 },
      { id: 'b5', title: 'Standalone Novel', author: 'Jane Doe', series: null, seriesInstallment: null, seriesTotal: null },
      { id: 'b6', title: 'User Custom Book', author: 'Custom Author', series: 'Custom Series', seriesInstallment: 4, seriesTotal: 10, userDefined: { series: true } },
    ];

    const evidenceMap: Record<string, EvidenceItem[]> = {
      b1: [
        { provider: 'hardcover', claim: 'SERIES_MEMBERSHIP', value: 'Mistborn', confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
        { provider: 'goodreads', claim: 'SERIES_MEMBERSHIP', value: 'Mistborn', confidence: 0.95, weight: 1.0, independenceGroup: 'goodreads', retrievedAt: Date.now() },
        { provider: 'wikidata', claim: 'SERIES_MEMBERSHIP', value: 'Mistborn', confidence: 0.98, weight: 1.0, independenceGroup: 'wikidata', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_ORDINAL', value: 1, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_TOTAL', value: 3, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
      ],
      b2: [
        { provider: 'hardcover', claim: 'SERIES_MEMBERSHIP', value: 'Mistborn', confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_ORDINAL', value: 2, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
        { provider: 'google_books', claim: 'SERIES_TOTAL', value: 1, confidence: 0.3, weight: 0.3, independenceGroup: 'google_books', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_TOTAL', value: 3, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
      ],
      b3: [
        { provider: 'google_books', claim: 'SERIES_TOTAL', value: 1, confidence: 0.3, weight: 0.3, independenceGroup: 'google_books', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_TOTAL', value: 6, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
        { provider: 'goodreads', claim: 'SERIES_TOTAL', value: 6, confidence: 0.95, weight: 1.0, independenceGroup: 'goodreads', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_MEMBERSHIP', value: 'Dune', confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_ORDINAL', value: 1, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
      ],
      b4: [
        { provider: 'google_books', claim: 'SERIES_TOTAL', value: 1, confidence: 0.3, weight: 0.3, independenceGroup: 'google_books', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_TOTAL', value: 41, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
        { provider: 'goodreads', claim: 'SERIES_TOTAL', value: 41, confidence: 0.95, weight: 1.0, independenceGroup: 'goodreads', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_MEMBERSHIP', value: 'Discworld', confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
        { provider: 'hardcover', claim: 'SERIES_ORDINAL', value: 1, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
      ],
      b5: [
        { provider: 'hardcover', claim: 'STANDALONE', value: true, confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
        { provider: 'goodreads', claim: 'STANDALONE', value: true, confidence: 0.95, weight: 1.0, independenceGroup: 'goodreads', retrievedAt: Date.now() },
      ],
      b6: [],
    };

    const summary = runLiveShadowAudit(userBooks, evidenceMap);

    expect(summary.totalBooksScanned).toBe(6);
    expect(summary.falseStandaloneCandidates).toBe(1); // b1 (The Final Empire)
    expect(summary.oneOfOneCorruptionCandidates).toBe(3); // b2, b3, b4
    expect(summary.userOverridesCount).toBe(1); // b6
    expect(summary.providerDiscrepancyStats.googleBooksVolumeTotalRejections).toBe(3); // b2, b3, b4
  });
});
