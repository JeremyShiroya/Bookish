// Phase 0 Deliverable 6: Database Migration & Dry-Run Audit Log Schema for v3.0-series-intelligence

import { EvidenceItem } from './seriesDomainTypes';

export interface BookAuditRecord {
  bookId: string;
  title: string;
  author: string;
  current: {
    series: string | null;
    seriesInstallment: number | string | null;
    seriesTotal: number | string | null;
    seriesChecked?: boolean;
  };
  proposed: {
    seriesId: string | null;
    seriesName: string | null;
    ordinal: { major: number; minor?: number; raw: string } | null;
    verifiedTotal: number | null;
    status: 'VERIFIED_SERIES' | 'PROBABLE_SERIES' | 'VERIFIED_STANDALONE' | 'PROBABLE_STANDALONE' | 'UNKNOWN' | 'CONFLICT';
  };
  decision: 'SAFE_AUTO_FIX' | 'HIGH_RISK_MANUAL_REVIEW' | 'NO_CHANGE' | 'REJECTED';
  reason: string;
  evidence: EvidenceItem[];
  confidence: {
    membership: number;
    ordinal: number;
    total: number;
  };
}

export interface DryRunAuditReport {
  migrationVersion: 'v3.0-series-intelligence';
  scannedAt: number;
  scannedCount: number;
  summary: {
    falseStandalonesDetected: number;
    oneOfOneCorruptionsFound: number;
    seriesConflictsDetected: number;
    safeAutoFixesCount: number;
    unresolvedCount: number;
  };
  bookRecords: BookAuditRecord[];
}

export function generateDryRunAuditReport(records: BookAuditRecord[]): DryRunAuditReport {
  let falseStandalonesDetected = 0;
  let oneOfOneCorruptionsFound = 0;
  let seriesConflictsDetected = 0;
  let safeAutoFixesCount = 0;
  let unresolvedCount = 0;

  for (const r of records) {
    if (!r.current.series && r.proposed.status === 'VERIFIED_SERIES') {
      falseStandalonesDetected += 1;
    }
    if (Number(r.current.seriesTotal) === 1 && r.proposed.verifiedTotal && r.proposed.verifiedTotal > 1) {
      oneOfOneCorruptionsFound += 1;
    }
    if (r.proposed.status === 'CONFLICT') {
      seriesConflictsDetected += 1;
    }
    if (r.decision === 'SAFE_AUTO_FIX') {
      safeAutoFixesCount += 1;
    }
    if (r.proposed.status === 'UNKNOWN' || r.decision === 'HIGH_RISK_MANUAL_REVIEW') {
      unresolvedCount += 1;
    }
  }

  return {
    migrationVersion: 'v3.0-series-intelligence',
    scannedAt: Date.now(),
    scannedCount: records.length,
    summary: {
      falseStandalonesDetected,
      oneOfOneCorruptionsFound,
      seriesConflictsDetected,
      safeAutoFixesCount,
      unresolvedCount,
    },
    bookRecords: records,
  };
}
