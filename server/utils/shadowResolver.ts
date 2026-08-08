// Phase 0/1A Deliverable: Pure Functional Read-Only Shadow Resolver (ZERO MUTATION / ZERO DB ACCESS)

import {
  EvidenceItem,
  SeriesMembership,
  SeriesTotalStatus,
  SeriesVerificationState,
  StructuredOrdinal,
} from './seriesDomainTypes';
import { evaluateSeriesVerificationState, evaluateStandaloneVerificationState } from './seriesStateMachine';
import { calculateWeightedConfidence } from './evidenceScoringModel';
import { reconcileSeriesRoster } from './seriesRosterResolver';

export interface ShadowResolutionInput {
  bookId: string;
  title: string;
  author?: string;
  legacyData: {
    series: string | null;
    seriesInstallment: number | string | null;
    seriesTotal: number | string | null;
    userDefined?: { series?: boolean; seriesInstallment?: boolean; seriesTotal?: boolean };
  };
  evidenceList: EvidenceItem[];
  providerTotals?: { provider: string; reportedTotal: number | null }[];
}

export interface ShadowProposalReport {
  bookId: string;
  title: string;
  legacyData: ShadowResolutionInput['legacyData'];
  v3Proposal: {
    membershipStatus:
      | 'VERIFIED_SERIES'
      | 'PROBABLE_SERIES'
      | 'VERIFIED_STANDALONE'
      | 'PROBABLE_STANDALONE'
      | 'UNKNOWN'
      | 'CONFLICT'
      | 'UNRESOLVED';
    seriesName: string | null;
    ordinal: StructuredOrdinal | null;
    total: {
      mainWorks: number | null;
      allWorks: number | null;
      status: SeriesTotalStatus;
    };
    repairClassification:
      | 'SAFE_AUTO_REPAIR'
      | 'NEEDS_PROVIDER_VERIFICATION'
      | 'USER_OVERRIDE'
      | 'CONFLICT'
      | 'UNRESOLVED';
  };
  confidence: {
    membership: number;
    ordinal: number;
    total: number;
  };
  discrepancyCategory:
    | 'BOTH_CORRECT'
    | 'LEGACY_WRONG_V3_CORRECT'
    | 'LEGACY_CORRECT_V3_WRONG'
    | 'BOTH_WRONG';
  invariantsPassed: boolean;
  dbMutationAttempted: boolean;
}

export function resolveShadowProposal(input: Readonly<ShadowResolutionInput>): ShadowProposalReport {
  let dbMutationAttempted = false;

  // 1. Guard against user-defined overrides
  if (input.legacyData?.userDefined?.series || input.legacyData?.userDefined?.seriesInstallment || input.legacyData?.userDefined?.seriesTotal) {
    return {
      bookId: input.bookId,
      title: input.title,
      legacyData: input.legacyData,
      v3Proposal: {
        membershipStatus: input.legacyData.series ? 'VERIFIED_SERIES' : 'UNKNOWN',
        seriesName: input.legacyData.series,
        ordinal: input.legacyData.seriesInstallment ? { major: Number(input.legacyData.seriesInstallment), raw: String(input.legacyData.seriesInstallment) } : null,
        total: { mainWorks: Number(input.legacyData.seriesTotal) || null, allWorks: null, status: 'VERIFIED' },
        repairClassification: 'USER_OVERRIDE',
      },
      confidence: { membership: 1.0, ordinal: 1.0, total: 1.0 },
      discrepancyCategory: 'BOTH_CORRECT',
      invariantsPassed: true,
      dbMutationAttempted: false,
    };
  }

  // 2. Evaluate Series State & Standalone State
  const evidenceList = input.evidenceList || [];
  const seriesState = evaluateSeriesVerificationState('DISCOVERED', evidenceList);
  const standaloneState = evaluateStandaloneVerificationState(evidenceList);

  const seriesClaim = calculateWeightedConfidence(evidenceList, 'SERIES_MEMBERSHIP');
  const ordinalClaim = calculateWeightedConfidence(evidenceList, 'SERIES_ORDINAL');
  const totalClaim = calculateWeightedConfidence(evidenceList, 'SERIES_TOTAL');

  // 3. Resolve Membership Status
  let membershipStatus: ShadowProposalReport['v3Proposal']['membershipStatus'] = 'UNKNOWN';
  let seriesName: string | null = null;

  if (seriesState.nextState === 'CONFLICT') {
    membershipStatus = 'CONFLICT';
  } else if (seriesState.nextState === 'VERIFIED') {
    membershipStatus = 'VERIFIED_SERIES';
    seriesName = String(seriesClaim.topClaim || '');
  } else if (seriesState.nextState === 'PARTIALLY_VERIFIED' || seriesState.nextState === 'CANDIDATE') {
    membershipStatus = 'PROBABLE_SERIES';
    seriesName = String(seriesClaim.topClaim || '');
  } else if (standaloneState.nextState === 'VERIFIED_STANDALONE') {
    membershipStatus = 'VERIFIED_STANDALONE';
  } else if (standaloneState.nextState === 'PROBABLE_STANDALONE') {
    membershipStatus = 'PROBABLE_STANDALONE';
  }

  // 4. Resolve Ordinal
  let ordinal: StructuredOrdinal | null = null;
  if (ordinalClaim.topClaim) {
    if (typeof ordinalClaim.topClaim === 'object' && 'major' in (ordinalClaim.topClaim as object)) {
      ordinal = ordinalClaim.topClaim as StructuredOrdinal;
    } else {
      const num = Number(ordinalClaim.topClaim);
      ordinal = { major: Math.floor(num), minor: num % 1 !== 0 ? Math.round((num % 1) * 10) : undefined, raw: String(ordinalClaim.topClaim) };
    }
  }

  // 5. Reconcile Roster Totals (BansTotal=1 Contamination)
  const effectiveProviderTotals = (input.providerTotals && input.providerTotals.length > 0)
    ? input.providerTotals
    : evidenceList
        .filter((e) => e.claim === 'SERIES_TOTAL' && typeof e.value === 'number')
        .map((e) => ({ provider: e.provider, reportedTotal: e.value as number }));

  const rosterResult = reconcileSeriesRoster(
    ordinal ? [{ workId: input.bookId, title: input.title, ordinal, entryType: ordinal.minor ? 'NOVELLA' : 'MAIN', confidence: ordinalClaim.confidence }] : [],
    effectiveProviderTotals
  );

  // 6. Determine Repair Classification
  let repairClassification: ShadowProposalReport['v3Proposal']['repairClassification'] = 'UNRESOLVED';
  if (membershipStatus === 'CONFLICT') {
    repairClassification = 'CONFLICT';
  } else if (membershipStatus === 'VERIFIED_SERIES' && (rosterResult.totalStatus === 'VERIFIED' || rosterResult.totalStatus === 'PROBABLE')) {
    repairClassification = 'SAFE_AUTO_REPAIR';
  } else if (membershipStatus === 'PROBABLE_SERIES' || rosterResult.totalStatus === 'UNKNOWN') {
    repairClassification = 'NEEDS_PROVIDER_VERIFICATION';
  }

  // 7. Calculate Discrepancy Category against Legacy Data
  let discrepancyCategory: ShadowProposalReport['discrepancyCategory'] = 'BOTH_CORRECT';
  const legacyIsStandalone = !input.legacyData?.series;
  const legacyIsOneOfOne = Number(input.legacyData?.seriesTotal) === 1;

  if (legacyIsStandalone && membershipStatus === 'VERIFIED_SERIES') {
    discrepancyCategory = 'LEGACY_WRONG_V3_CORRECT';
  } else if (legacyIsOneOfOne && rosterResult.mainWorksCount && rosterResult.mainWorksCount > 1) {
    discrepancyCategory = 'LEGACY_WRONG_V3_CORRECT';
  }

  // 8. Enforce Hard-Zero Invariants
  let invariantsPassed = true;
  // Invariant: Single book lookup without verified multi-provider roster CANNOT set mainWorksCount = 1
  if (rosterResult.mainWorksCount === 1 && rosterResult.totalStatus !== 'VERIFIED') {
    invariantsPassed = false;
  }
  // Invariant: Negative provider lookup cannot convert UNKNOWN to STANDALONE
  if (standaloneState.nextState === 'INSUFFICIENT' && membershipStatus === 'VERIFIED_STANDALONE') {
    invariantsPassed = false;
  }

  return {
    bookId: input.bookId,
    title: input.title,
    legacyData: input.legacyData,
    v3Proposal: {
      membershipStatus,
      seriesName,
      ordinal,
      total: {
        mainWorks: rosterResult.mainWorksCount,
        allWorks: rosterResult.allWorksCount,
        status: rosterResult.totalStatus,
      },
      repairClassification,
    },
    confidence: {
      membership: seriesClaim.confidence,
      ordinal: ordinalClaim.confidence,
      total: rosterResult.confidence,
    },
    discrepancyCategory,
    invariantsPassed,
    dbMutationAttempted,
  };
}
