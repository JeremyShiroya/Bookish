// Phase 0 Deliverable 5: Series Roster Reconciliation & Total Resolver for Pages Intelligence Engine v3.0

import { CanonicalSeries, SeriesRosterEntry, EvidenceItem, SeriesTotalStatus } from './seriesDomainTypes';

export interface RosterReconciliationResult {
  reconciledRoster: SeriesRosterEntry[];
  mainWorksCount: number | null;
  allWorksCount: number | null;
  totalStatus: SeriesTotalStatus;
  confidence: number;
}

export function reconcileSeriesRoster(
  candidates: SeriesRosterEntry[],
  providerTotals: { provider: string; reportedTotal: number | null }[] = []
): RosterReconciliationResult {
  if (!candidates.length) {
    return {
      reconciledRoster: [],
      mainWorksCount: null,
      allWorksCount: null,
      totalStatus: 'UNKNOWN',
      confidence: 0,
    };
  }

  // 1. Deduplicate entries by workId or (entryType + ordinal)
  const rosterMap = new Map<string, SeriesRosterEntry>();

  for (const entry of candidates) {
    const key = `${entry.entryType}:${entry.ordinal.raw}`;
    const existing = rosterMap.get(key);
    if (!existing || entry.confidence > existing.confidence) {
      rosterMap.set(key, entry);
    }
  }

  const reconciledRoster = Array.from(rosterMap.values()).sort((a, b) => {
    if (a.ordinal.major !== b.ordinal.major) {
      return a.ordinal.major - b.ordinal.major;
    }
    return (a.ordinal.minor || 0) - (b.ordinal.minor || 0);
  });

  // 2. Separate Main Works from Novellas / Companions
  const mainWorks = reconciledRoster.filter((e) => e.entryType === 'MAIN');
  const allWorksCount = reconciledRoster.length;

  // 3. Evaluate Series Total Status
  const validReportedTotals = providerTotals
    .map((p) => p.reportedTotal)
    .filter((t): t is number => Number.isSafeInteger(t) && t > 1); // BAN total = 1 from overriding!

  let mainWorksCount: number | null = null;
  let totalStatus: SeriesTotalStatus = 'UNKNOWN';
  let confidence = 0.5;

  if (validReportedTotals.length > 0) {
    // Check for consensus among valid totals
    const counts = new Map<number, number>();
    for (const t of validReportedTotals) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }

    let topTotal: number | null = null;
    let topFreq = 0;
    for (const [t, freq] of counts.entries()) {
      if (freq > topFreq) {
        topFreq = freq;
        topTotal = t;
      }
    }

    if (topTotal && topFreq >= 2) {
      mainWorksCount = topTotal;
      totalStatus = 'VERIFIED';
      confidence = 0.95;
    } else if (topTotal) {
      mainWorksCount = topTotal;
      totalStatus = 'PROBABLE';
      confidence = 0.75;
    }
  }

  // Fallback to verified main roster length if roster is contiguous and contains >= 2 works
  if (!mainWorksCount && mainWorks.length >= 2) {
    const highestMajor = Math.max(...mainWorks.map((e) => e.ordinal.major));
    if (highestMajor === mainWorks.length) {
      // Contiguous 1..N roster
      mainWorksCount = highestMajor;
      totalStatus = 'PROBABLE';
      confidence = 0.85;
    }
  }

  return {
    reconciledRoster,
    mainWorksCount,
    allWorksCount,
    totalStatus,
    confidence,
  };
}
