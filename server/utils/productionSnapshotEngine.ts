// Phase 1C Deliverable: Immutable Production Snapshot & Integrity Verification Engine

import crypto from 'node:crypto';
import { ShadowResolutionInput } from './shadowResolver';

export interface AuditSnapshotManifest {
  snapshotVersion: string;
  auditVersion: string;
  createdAt: number;
  bookCount: number;
  contentHash: string;
  schemaVersion: string;
  storageEngine: string;
  dbName: string;
  readOnly: true;
}

export interface ProductionBookRecord {
  id: string;
  title: string;
  author?: string;
  series?: string | null;
  seriesInstallment?: number | string | null;
  seriesTotal?: number | string | null;
  seriesChecked?: boolean;
  userDefined?: {
    series?: boolean;
    seriesInstallment?: boolean;
    seriesTotal?: boolean;
  };
  updatedAt?: number;
}

export interface ProductionSnapshotBundle {
  manifest: AuditSnapshotManifest;
  books: ProductionBookRecord[];
}

export function computeContentHash(books: ProductionBookRecord[]): string {
  const jsonString = JSON.stringify(books);
  return crypto.createHash('sha256').update(jsonString).digest('hex');
}

export function createProductionSnapshot(books: ProductionBookRecord[]): ProductionSnapshotBundle {
  const readOnlyBooks: ProductionBookRecord[] = JSON.parse(JSON.stringify(books));
  const contentHash = computeContentHash(readOnlyBooks);

  const manifest: AuditSnapshotManifest = {
    snapshotVersion: 'v3.0-snapshot-1.0',
    auditVersion: 'Phase-1C-DryRun',
    createdAt: Date.now(),
    bookCount: readOnlyBooks.length,
    contentHash,
    schemaVersion: 'bookish-library-v1',
    storageEngine: 'IndexedDB (bookish-library / books store)',
    dbName: 'bookish-library',
    readOnly: true,
  };

  return {
    manifest,
    books: readOnlyBooks,
  };
}

export function verifySnapshotIntegrity(bundle: ProductionSnapshotBundle): boolean {
  const currentHash = computeContentHash(bundle.books);
  return currentHash === bundle.manifest.contentHash;
}
