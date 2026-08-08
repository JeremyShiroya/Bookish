// Phase 0 Deliverable 2: Series & Standalone State Machine for Pages Intelligence Engine v3.0

import { SeriesVerificationState, StandaloneVerificationState, EvidenceItem } from './seriesDomainTypes';

export interface StateTransitionResult<T> {
  nextState: T;
  reason: string;
  confidence: number;
}

export function evaluateSeriesVerificationState(
  currentState: SeriesVerificationState,
  evidence: EvidenceItem[] = [],
  {
    verifiedAt = 0,
    ttlMs = 30 * 24 * 60 * 60 * 1000, // 30 days
  }: { verifiedAt?: number; ttlMs?: number } = {}
): StateTransitionResult<SeriesVerificationState> {
  const now = Date.now();

  // 1. Check for Conflict
  const claims = evidence.filter((e) => e.claim === 'SERIES_MEMBERSHIP');
  const uniqueValues = new Set(claims.map((c) => String(c.value).toLowerCase().trim()));

  if (uniqueValues.size > 1) {
    return {
      nextState: 'CONFLICT',
      reason: `Conflicting series membership claims detected across independent sources: ${Array.from(uniqueValues).join(', ')}`,
      confidence: 0.5,
    };
  }

  // 2. Check for Staleness
  if (currentState === 'VERIFIED' && verifiedAt > 0 && now - verifiedAt > ttlMs) {
    return {
      nextState: 'STALE',
      reason: 'Verification age exceeded 30-day cache TTL; requires revalidation sweep.',
      confidence: 0.85,
    };
  }

  // 3. Score Independent Evidence
  const groups = new Set(claims.map((c) => c.independenceGroup || c.provider));
  const weightedScore = claims.reduce((acc, c) => acc + (c.confidence * c.weight), 0);

  if (groups.size >= 2 && weightedScore >= 1.5) {
    return {
      nextState: 'VERIFIED',
      reason: `High multi-source confidence across ${groups.size} independent provider groups.`,
      confidence: Math.min(0.99, weightedScore / (groups.size * 1.0)),
    };
  }

  if (claims.length >= 1 && weightedScore >= 0.75) {
    return {
      nextState: 'PARTIALLY_VERIFIED',
      reason: 'Single provider or moderate-confidence series membership evidence.',
      confidence: 0.75,
    };
  }

  if (claims.length >= 1) {
    return {
      nextState: 'CANDIDATE',
      reason: 'Low-confidence series hypothesis discovered.',
      confidence: 0.5,
    };
  }

  return {
    nextState: 'DISCOVERED',
    reason: 'Initial un-verified series discovery state.',
    confidence: 0.1,
  };
}

export function evaluateStandaloneVerificationState(
  evidence: EvidenceItem[] = []
): StateTransitionResult<StandaloneVerificationState> {
  const claims = evidence.filter((e) => e.claim === 'STANDALONE');
  const seriesClaims = evidence.filter((e) => e.claim === 'SERIES_MEMBERSHIP');

  if (seriesClaims.length > 0) {
    return {
      nextState: 'NO_EVIDENCE',
      reason: 'Book has positive series evidence; standalone state rejected.',
      confidence: 0,
    };
  }

  const explicitNegative = claims.filter((c) => c.value === true);
  const groups = new Set(explicitNegative.map((c) => c.independenceGroup || c.provider));

  if (groups.size >= 2) {
    return {
      nextState: 'VERIFIED_STANDALONE',
      reason: `Confirmed standalone by ${groups.size} independent structured authorities.`,
      confidence: 0.95,
    };
  }

  if (groups.size === 1) {
    return {
      nextState: 'PROBABLE_STANDALONE',
      reason: 'Single provider suggests standalone; pending second confirmation.',
      confidence: 0.7,
    };
  }

  if (claims.length > 0) {
    return {
      nextState: 'INSUFFICIENT',
      reason: 'Lookup returned empty series field but lacks explicit negative confirmation.',
      confidence: 0.3,
    };
  }

  return {
    nextState: 'NO_EVIDENCE',
    reason: 'No queries completed yet.',
    confidence: 0,
  };
}
