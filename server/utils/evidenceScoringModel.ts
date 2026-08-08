// Phase 0 Deliverable 3: Provider x Field Reliability Matrix & Evidence Aggregation Model

import { ProviderReliabilityMatrix, EvidenceItem } from './seriesDomainTypes';

export const DEFAULT_PROVIDER_RELIABILITY_MATRIX: ProviderReliabilityMatrix = {
  wikidata: {
    workIdentity: 0.95,
    seriesIdentity: 0.98,
    seriesOrdinal: 0.90,
    seriesTotal: 0.85,
    description: 0.60,
    cover: 0.50,
  },
  hardcover: {
    workIdentity: 0.92,
    seriesIdentity: 0.95,
    seriesOrdinal: 0.95,
    seriesTotal: 0.90,
    description: 0.90,
    cover: 0.92,
  },
  goodreads: {
    workIdentity: 0.90,
    seriesIdentity: 0.92,
    seriesOrdinal: 0.95,
    seriesTotal: 0.85,
    description: 0.85,
    cover: 0.88,
  },
  google_books: {
    workIdentity: 0.88,
    seriesIdentity: 0.75,
    seriesOrdinal: 0.85,
    seriesTotal: 0.30, // Low reliability for total (volumeList totalItems contamination)
    description: 0.95,
    cover: 0.90,
  },
  publisher: {
    workIdentity: 0.98,
    seriesIdentity: 0.90,
    seriesOrdinal: 0.90,
    seriesTotal: 0.90,
    description: 0.99,
    cover: 0.95,
  },
  library_of_congress: {
    workIdentity: 0.99,
    seriesIdentity: 0.85,
    seriesOrdinal: 0.85,
    seriesTotal: 0.70,
    description: 0.70,
    cover: 0.10,
  },
  open_library: {
    workIdentity: 0.85,
    seriesIdentity: 0.80,
    seriesOrdinal: 0.80,
    seriesTotal: 0.60,
    description: 0.80,
    cover: 0.75,
  },
  bookbrainz: {
    workIdentity: 0.95,
    seriesIdentity: 0.95,
    seriesOrdinal: 0.90,
    seriesTotal: 0.85,
    description: 0.70,
    cover: 0.50,
  },
  ai_inference: {
    workIdentity: 0.50,
    seriesIdentity: 0.40,
    seriesOrdinal: 0.40,
    seriesTotal: 0.20,
    description: 0.30,
    cover: 0.00,
  },
};

export function calculateWeightedConfidence(
  evidenceList: EvidenceItem[],
  claimType: EvidenceItem['claim'],
  matrix: ProviderReliabilityMatrix = DEFAULT_PROVIDER_RELIABILITY_MATRIX
): { confidence: number; independentGroups: string[]; topClaim: unknown } {
  const relevant = evidenceList.filter((e) => e.claim === claimType);
  if (!relevant.length) {
    return { confidence: 0, independentGroups: [], topClaim: null };
  }

  // Deduplicate by independence group
  const groupScores = new Map<string, { weight: number; value: unknown }>();

  for (const item of relevant) {
    const groupKey = item.independenceGroup || item.provider;
    const providerReliability = matrix[item.provider]?.[
      claimType === 'WORK_ID' ? 'workIdentity' :
      claimType === 'SERIES_MEMBERSHIP' ? 'seriesIdentity' :
      claimType === 'SERIES_ORDINAL' ? 'seriesOrdinal' :
      claimType === 'SERIES_TOTAL' ? 'seriesTotal' : 'description'
    ] ?? 0.5;

    const effectiveWeight = item.weight * providerReliability;
    const current = groupScores.get(groupKey);

    if (!current || effectiveWeight > current.weight) {
      groupScores.set(groupKey, { weight: effectiveWeight, value: item.value });
    }
  }

  // Calculate Bayesian-style combined confidence
  let unconfidence = 1.0;
  for (const entry of groupScores.values()) {
    unconfidence *= (1 - Math.min(0.95, entry.weight));
  }

  const confidence = Math.min(0.99, Number((1 - unconfidence).toFixed(4)));
  const independentGroups = Array.from(groupScores.keys());

  // Find consensus value
  const valueCounts = new Map<string, number>();
  for (const entry of groupScores.values()) {
    const key = JSON.stringify(entry.value);
    valueCounts.set(key, (valueCounts.get(key) || 0) + entry.weight);
  }

  let topKey: string | null = null;
  let topWeight = -1;
  for (const [key, weight] of valueCounts.entries()) {
    if (weight > topWeight) {
      topWeight = weight;
      topKey = key;
    }
  }

  const topClaim = topKey ? JSON.parse(topKey) : null;

  return { confidence, independentGroups, topClaim };
}
