// Phase 1B Deliverable: Live Read-Only Shadow Audit Engine for Pages Intelligence Engine v3.0

import { resolveShadowProposal, ShadowProposalReport, ShadowResolutionInput } from './shadowResolver';
import { EvidenceItem } from './seriesDomainTypes';

export interface LiveShadowAuditSummary {
  scannedAt: number;
  totalBooksScanned: number;
  totalSeriesDetected: number;
  falseStandaloneCandidates: number;
  oneOfOneCorruptionCandidates: number;
  ordinalCorrectionsCount: number;
  seriesTotalCorrectionsCount: number;
  unknownCasesCount: number;
  conflictCasesCount: number;
  userOverridesCount: number;
  repairBreakdown: {
    SAFE_AUTO_REPAIR: number;
    NEEDS_PROVIDER_VERIFICATION: number;
    USER_OVERRIDE: number;
    CONFLICT: number;
    UNRESOLVED: number;
  };
  providerDiscrepancyStats: {
    hardcoverHits: number;
    goodreadsHits: number;
    wikidataHits: number;
    googleBooksVolumeTotalRejections: number;
  };
  proposals: ShadowProposalReport[];
}

export function runLiveShadowAudit(
  userBooks: {
    id: string;
    title: string;
    author?: string;
    series?: string | null;
    seriesInstallment?: number | string | null;
    seriesTotal?: number | string | null;
    userDefined?: { series?: boolean; seriesInstallment?: boolean; seriesTotal?: boolean };
  }[],
  fetchedEvidenceMap: Record<string, EvidenceItem[]> = {}
): LiveShadowAuditSummary {
  const proposals: ShadowProposalReport[] = [];

  let falseStandaloneCandidates = 0;
  let oneOfOneCorruptionCandidates = 0;
  let ordinalCorrectionsCount = 0;
  let seriesTotalCorrectionsCount = 0;
  let unknownCasesCount = 0;
  let conflictCasesCount = 0;
  let userOverridesCount = 0;

  const repairBreakdown = {
    SAFE_AUTO_REPAIR: 0,
    NEEDS_PROVIDER_VERIFICATION: 0,
    USER_OVERRIDE: 0,
    CONFLICT: 0,
    UNRESOLVED: 0,
  };

  const providerDiscrepancyStats = {
    hardcoverHits: 0,
    goodreadsHits: 0,
    wikidataHits: 0,
    googleBooksVolumeTotalRejections: 0,
  };

  const detectedSeriesNames = new Set<string>();

  for (const book of userBooks) {
    const evidenceList = fetchedEvidenceMap[book.id] || [];

    // Track provider hit metrics
    for (const ev of evidenceList) {
      if (ev.provider === 'hardcover') providerDiscrepancyStats.hardcoverHits += 1;
      if (ev.provider === 'goodreads') providerDiscrepancyStats.goodreadsHits += 1;
      if (ev.provider === 'wikidata') providerDiscrepancyStats.wikidataHits += 1;
      if (ev.provider === 'google_books' && ev.claim === 'SERIES_TOTAL' && Number(ev.value) === 1) {
        providerDiscrepancyStats.googleBooksVolumeTotalRejections += 1;
      }
    }

    const shadowInput: ShadowResolutionInput = {
      bookId: book.id,
      title: book.title,
      author: book.author,
      legacyData: {
        series: book.series || null,
        seriesInstallment: book.seriesInstallment || null,
        seriesTotal: book.seriesTotal || null,
        userDefined: book.userDefined,
      },
      evidenceList,
    };

    // PURE FUNCTIONAL CALL (ZERO DB MUTATION)
    const report = resolveShadowProposal(shadowInput);
    proposals.push(report);

    if (report.v3Proposal.seriesName) {
      detectedSeriesNames.add(report.v3Proposal.seriesName.toLowerCase());
    }

    repairBreakdown[report.v3Proposal.repairClassification] += 1;

    if (!book.series && report.v3Proposal.membershipStatus === 'VERIFIED_SERIES') {
      falseStandaloneCandidates += 1;
    }
    if (Number(book.seriesTotal) === 1 && report.v3Proposal.total.mainWorks && report.v3Proposal.total.mainWorks > 1) {
      oneOfOneCorruptionCandidates += 1;
    }
    if (book.seriesInstallment && report.v3Proposal.ordinal && String(book.seriesInstallment) !== report.v3Proposal.ordinal.raw) {
      ordinalCorrectionsCount += 1;
    }
    if (book.seriesTotal && report.v3Proposal.total.mainWorks && Number(book.seriesTotal) !== report.v3Proposal.total.mainWorks) {
      seriesTotalCorrectionsCount += 1;
    }
    if (report.v3Proposal.membershipStatus === 'UNKNOWN') {
      unknownCasesCount += 1;
    }
    if (report.v3Proposal.membershipStatus === 'CONFLICT') {
      conflictCasesCount += 1;
    }
    if (report.v3Proposal.repairClassification === 'USER_OVERRIDE') {
      userOverridesCount += 1;
    }
  }

  return {
    scannedAt: Date.now(),
    totalBooksScanned: userBooks.length,
    totalSeriesDetected: detectedSeriesNames.size,
    falseStandaloneCandidates,
    oneOfOneCorruptionCandidates,
    ordinalCorrectionsCount,
    seriesTotalCorrectionsCount,
    unknownCasesCount,
    conflictCasesCount,
    userOverridesCount,
    repairBreakdown,
    providerDiscrepancyStats,
    proposals,
  };
}
