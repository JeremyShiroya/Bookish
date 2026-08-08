// Phase 0 Deliverable: TypeScript Domain Schemas for Pages Intelligence Engine v3.0

export type SeriesVerificationState = 
  | 'DISCOVERED'
  | 'CANDIDATE'
  | 'PARTIALLY_VERIFIED'
  | 'VERIFIED'
  | 'STALE'
  | 'CONFLICT';

export type StandaloneVerificationState =
  | 'NO_EVIDENCE'
  | 'INSUFFICIENT'
  | 'PROBABLE_STANDALONE'
  | 'VERIFIED_STANDALONE';

export type SeriesTotalStatus = 
  | 'VERIFIED'
  | 'PROBABLE'
  | 'UNKNOWN'
  | 'ONGOING'
  | 'CONFLICT';

export type EntryType =
  | 'MAIN'
  | 'NOVELLA'
  | 'SHORT_STORY'
  | 'COMPANION'
  | 'PREQUEL'
  | 'SEQUEL'
  | 'SIDE_STORY'
  | 'OMNIBUS'
  | 'BOX_SET'
  | 'COLLECTION'
  | 'UPCOMING'
  | 'UNKNOWN';

export type EvidenceClaimType =
  | 'SERIES_MEMBERSHIP'
  | 'SERIES_ORDINAL'
  | 'SERIES_TOTAL'
  | 'STANDALONE'
  | 'AUTHOR'
  | 'WORK_ID';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface StructuredOrdinal {
  major: number;       // e.g. 1
  minor?: number;      // e.g. 5 for 1.5
  raw: string;         // "1.5"
}

export interface EvidenceItem {
  provider: string;
  claim: EvidenceClaimType;
  value: unknown;
  confidence: number;
  weight: number;
  independenceGroup?: string;
  sourceRecordId?: string;
  sourceUrl?: string;
  retrievedAt: number;
  expiresAt?: number;
}

export interface CanonicalWork {
  workId: string; // Internal ID e.g. "work_01HX..."
  canonicalTitle: string;
  primaryAuthor: string;
  editions: {
    isbn13?: string;
    isbn10?: string;
    openLibraryKey?: string;
    hardcoverId?: string;
    goodreadsId?: string;
  }[];
  identityConfidence: number;
}

export interface SeriesRosterEntry {
  workId: string;
  title: string;
  ordinal: StructuredOrdinal;
  entryType: EntryType;
  confidence: number;
}

export interface CanonicalSeries {
  seriesId: string; // Internal ID e.g. "series_01HX..."
  canonicalName: string;
  externalIds: {
    wikidata?: string;
    goodreads?: string;
    hardcover?: string;
    bookbrainz?: string;
  };
  roster: SeriesRosterEntry[];
  total: {
    mainWorks: number | null;
    allWorks: number | null;
    status: SeriesTotalStatus;
    confidence: number;
  };
  verificationState: SeriesVerificationState;
  verifiedAt: number;
  rosterFetchedAt: number;
  resolverVersion: string;
}

export interface SeriesMembership {
  workId: string;
  seriesId: string;
  ordinal: StructuredOrdinal;
  membershipStatus:
    | 'VERIFIED_SERIES'
    | 'PROBABLE_SERIES'
    | 'VERIFIED_STANDALONE'
    | 'PROBABLE_STANDALONE'
    | 'UNKNOWN'
    | 'CONFLICT'
    | 'UNRESOLVED';
  confidence: {
    membership: number;
    ordinal: number;
    total: number;
  };
  evidenceLedger: EvidenceItem[];
  userDefined?: {
    series?: boolean;
    seriesInstallment?: boolean;
    seriesTotal?: boolean;
    title?: boolean;
  };
}

export interface ProviderReliability {
  workIdentity: number;
  seriesIdentity: number;
  seriesOrdinal: number;
  seriesTotal: number;
  description: number;
  cover: number;
}

export type ProviderReliabilityMatrix = Record<string, ProviderReliability>;
