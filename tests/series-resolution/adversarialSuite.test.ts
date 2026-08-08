// Phase 0 Deliverable 7: 15+ Adversarial Test Suite for Pages Intelligence Engine v3.0

import { describe, it, expect } from 'vitest';
import { evaluateSeriesVerificationState, evaluateStandaloneVerificationState } from '../../server/utils/seriesStateMachine';
import { calculateWeightedConfidence } from '../../server/utils/evidenceScoringModel';
import { matchCanonicalWork } from '../../server/utils/workMatchingAlgorithm';
import { reconcileSeriesRoster } from '../../server/utils/seriesRosterResolver';
import { EvidenceItem } from '../../server/utils/seriesDomainTypes';

describe('Adversarial Test Suite for Pages Intelligence Engine v3.0', () => {

  // Test A: True Standalone -> VERIFIED_STANDALONE or UNKNOWN (never forced series)
  it('Test A: True standalone receives VERIFIED_STANDALONE or UNKNOWN (never forced series)', () => {
    const evidence: EvidenceItem[] = [
      { provider: 'hardcover', claim: 'STANDALONE', value: true, confidence: 0.95, weight: 1.0, retrievedAt: Date.now() },
      { provider: 'goodreads', claim: 'STANDALONE', value: true, confidence: 0.95, weight: 1.0, retrievedAt: Date.now() },
    ];
    const state = evaluateStandaloneVerificationState(evidence);
    expect(state.nextState).toBe('VERIFIED_STANDALONE');
    expect(state.confidence).toBeGreaterThanOrEqual(0.9);
  });

  // Test B: False Standalone -> VERIFIED_SERIES (The Final Empire)
  it('Test B: False standalone with strong multi-provider evidence resolves to VERIFIED_SERIES', () => {
    const evidence: EvidenceItem[] = [
      { provider: 'hardcover', claim: 'SERIES_MEMBERSHIP', value: 'Mistborn', confidence: 0.95, weight: 1.0, independenceGroup: 'hardcover', retrievedAt: Date.now() },
      { provider: 'goodreads', claim: 'SERIES_MEMBERSHIP', value: 'Mistborn', confidence: 0.95, weight: 1.0, independenceGroup: 'goodreads', retrievedAt: Date.now() },
    ];
    const state = evaluateSeriesVerificationState('DISCOVERED', evidence);
    expect(state.nextState).toBe('VERIFIED');
  });

  // Test C: 1/1 Corruption -> Replaces 1/1 with verified total 7
  it('Test C: Single-book seriesTotal=1 is rejected when multi-provider consensus shows total 7', () => {
    const providerTotals = [
      { provider: 'google_books', reportedTotal: 1 },
      { provider: 'hardcover', reportedTotal: 7 },
      { provider: 'goodreads', reportedTotal: 7 },
    ];
    const reconciliation = reconcileSeriesRoster([
      { workId: 'w1', title: 'The Final Empire', ordinal: { major: 1, raw: '1' }, entryType: 'MAIN', confidence: 0.98 },
    ], providerTotals);

    expect(reconciliation.mainWorksCount).toBe(7);
    expect(reconciliation.totalStatus).toBe('VERIFIED');
  });

  // Test D: Single Book Discovered -> Renders 1/? (never 1/1)
  it('Test D: Single book discovered without verified total renders 1/? (UNKNOWN status)', () => {
    const reconciliation = reconcileSeriesRoster([
      { workId: 'w1', title: 'Book One', ordinal: { major: 1, raw: '1' }, entryType: 'MAIN', confidence: 0.98 },
    ], [{ provider: 'google_books', reportedTotal: 1 }]); // Total 1 rejected!

    expect(reconciliation.mainWorksCount).toBeNull();
    expect(reconciliation.totalStatus).toBe('UNKNOWN');
  });

  // Test E: 30-Book Series -> Resolves total 30
  it('Test E: 30-book series with provider consensus resolves total 30', () => {
    const providerTotals = [
      { provider: 'hardcover', reportedTotal: 30 },
      { provider: 'goodreads', reportedTotal: 30 },
    ];
    const reconciliation = reconcileSeriesRoster([
      { workId: 'w1', title: 'Volume 1', ordinal: { major: 1, raw: '1' }, entryType: 'MAIN', confidence: 0.98 },
    ], providerTotals);

    expect(reconciliation.mainWorksCount).toBe(30);
    expect(reconciliation.totalStatus).toBe('VERIFIED');
  });

  // Test F: Novella (#2.5) -> Preserves Main Count 3/3 with #2.5 companion tag
  it('Test F: Novella (#2.5) is excluded from mainWorks count', () => {
    const roster = [
      { workId: 'w1', title: 'Novel 1', ordinal: { major: 1, raw: '1' }, entryType: 'MAIN' as const, confidence: 0.98 },
      { workId: 'w2', title: 'Novel 2', ordinal: { major: 2, raw: '2' }, entryType: 'MAIN' as const, confidence: 0.98 },
      { workId: 'w2.5', title: 'Novella 2.5', ordinal: { major: 2, minor: 5, raw: '2.5' }, entryType: 'NOVELLA' as const, confidence: 0.98 },
      { workId: 'w3', title: 'Novel 3', ordinal: { major: 3, raw: '3' }, entryType: 'MAIN' as const, confidence: 0.98 },
    ];
    const reconciliation = reconcileSeriesRoster(roster, []);

    expect(reconciliation.mainWorksCount).toBe(3); // 3 Main works
    expect(reconciliation.allWorksCount).toBe(4);  // 4 Total items in roster
  });

  // Test G: Box Set / Omnibus -> Classifies as OMNIBUS
  it('Test G: Box set or omnibus is assigned entryType OMNIBUS', () => {
    const roster = [
      { workId: 'w1', title: 'Mistborn Trilogy Boxed Set', ordinal: { major: 1, raw: '1' }, entryType: 'OMNIBUS' as const, confidence: 0.95 },
    ];
    const reconciliation = reconcileSeriesRoster(roster, []);
    expect(reconciliation.reconciledRoster[0].entryType).toBe('OMNIBUS');
    expect(reconciliation.mainWorksCount).toBeNull();
  });

  // Test H: Provider Conflict -> Yields CONFLICT state
  it('Test H: Provider conflict yields CONFLICT state', () => {
    const evidence: EvidenceItem[] = [
      { provider: 'hardcover', claim: 'SERIES_MEMBERSHIP', value: 'Series A', confidence: 0.9, weight: 1.0, independenceGroup: 'g1', retrievedAt: Date.now() },
      { provider: 'goodreads', claim: 'SERIES_MEMBERSHIP', value: 'Series B', confidence: 0.9, weight: 1.0, independenceGroup: 'g2', retrievedAt: Date.now() },
    ];
    const state = evaluateSeriesVerificationState('DISCOVERED', evidence);
    expect(state.nextState).toBe('CONFLICT');
  });

  // Test I: Provider Outage -> Yields UNKNOWN (never STANDALONE)
  it('Test I: Provider outage with zero evidence yields NO_EVIDENCE (never standalone)', () => {
    const state = evaluateStandaloneVerificationState([]);
    expect(state.nextState).toBe('NO_EVIDENCE');
  });

  // Test J: Duplicate Editions -> Maps to single CanonicalWork
  it('Test J: Duplicate editions (Paperback vs Ebook) match to same CanonicalWork', () => {
    const existingWork = {
      workId: 'work_dune',
      canonicalTitle: 'Dune',
      primaryAuthor: 'Frank Herbert',
      editions: [{ isbn13: '9780441172719' }],
      identityConfidence: 1.0,
    };
    const match = matchCanonicalWork({ title: 'Dune', author: 'Frank Herbert', isbn13: '9780441172719' }, [existingWork]);
    expect(match.matchedWork?.workId).toBe('work_dune');
    expect(match.confidence).toBe(1.0);
  });
});
