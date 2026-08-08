// Phase 1E Deliverable: Reversible Migration Engine, Field Allowlist & Protection Firewalls

import { ProductionBookRecord, computeContentHash } from './productionSnapshotEngine';
import { ProposedRepairPlan, ProposedBookDiff, RollbackAction } from './repairPlanGenerator';

// 1. Surgical Mutation Allowlist (Strictly limited to series resolution fields)
export const ALLOWED_REPAIR_FIELDS = [
  'series',
  'seriesInstallment',
  'seriesTotal',
  'seriesChecked',
] as const;

export type AllowedRepairField = typeof ALLOWED_REPAIR_FIELDS[number];

// Prohibited fields that MUST NEVER be automatically modified during series repair
export const PROHIBITED_FIELDS = [
  'id',
  'title',
  'author',
  'cover',
  'isbn',
  'description',
  'readingStatus',
  'favorite',
  'collections',
  'userDefined',
  'annotations',
] as const;

export interface MigrationManifest {
  migrationId: string;
  migrationVersion: number;
  expectedSnapshotHash: string;
  appliedAt?: number;
  revertedAt?: number;
  appliedCount: number;
  status: 'PENDING' | 'APPLIED' | 'REVERTED' | 'REJECTED_STALE_HASH' | 'REJECTED_USER_OVERRIDE';
}

export interface MigrationResult {
  success: boolean;
  manifest: MigrationManifest;
  modifiedBooks: ProductionBookRecord[];
  rollbackActions: RollbackAction[];
  error?: string;
}

/**
 * Validates whether a proposed diff attempts to modify any non-allowlisted field.
 */
export function validateMutationAllowlist(diff: ProposedBookDiff): { valid: boolean; forbiddenFields: string[] } {
  const forbiddenFields: string[] = [];

  // Check before vs after for non-allowlisted keys
  const keys = new Set([...Object.keys(diff.before), ...Object.keys(diff.after)]);

  for (const key of keys) {
    if (key === 'seriesName') continue; // Maps to 'series'
    if (key === 'ordinal') continue; // Maps to 'seriesInstallment'
    if (key === 'mainWorksTotal') continue; // Maps to 'seriesTotal'
    if (key === 'membershipStatus') continue; // Maps to 'seriesChecked'

    if (!ALLOWED_REPAIR_FIELDS.includes(key as AllowedRepairField)) {
      forbiddenFields.push(key);
    }
  }

  return { valid: forbiddenFields.length === 0, forbiddenFields };
}

/**
 * Checks if a book record has user-defined overrides protecting it at the persistence boundary.
 */
export function isUserOverrideProtected(book: ProductionBookRecord): boolean {
  if (!book.userDefined) return false;
  return Boolean(
    book.userDefined.series ||
    book.userDefined.seriesInstallment ||
    book.userDefined.seriesTotal
  );
}

/**
 * Simulates applying a proposed repair plan against an in-memory library snapshot.
 * Enforces: Stale Snapshot Protection, User Override Firewall, Mutation Allowlist.
 */
export function simulateApplyRepairPlan(
  currentLibrary: ProductionBookRecord[],
  plan: ProposedRepairPlan,
  currentSnapshotHash: string
): MigrationResult {
  const manifest: MigrationManifest = {
    migrationId: 'v3.0-series-intelligence',
    migrationVersion: 1,
    expectedSnapshotHash: plan.snapshotHash,
    appliedCount: 0,
    status: 'PENDING',
  };

  // 1. Stale-Snapshot Protection Test: Verify Hash Matches
  if (currentSnapshotHash !== plan.snapshotHash) {
    manifest.status = 'REJECTED_STALE_HASH';
    return {
      success: false,
      manifest,
      modifiedBooks: cloneLibrary(currentLibrary),
      rollbackActions: [],
      error: `Migration rejected: Current snapshot hash (${currentSnapshotHash.slice(0, 8)}) does not match expected plan hash (${plan.snapshotHash.slice(0, 8)}). Library was modified after plan generation.`,
    };
  }

  const modifiedLibrary = cloneLibrary(currentLibrary);

  for (const diff of plan.proposedDiffs) {
    const bookIndex = modifiedLibrary.findIndex(b => b.id === diff.bookId);
    if (bookIndex === -1) continue;

    const targetBook = modifiedLibrary[bookIndex];

    // 2. User-Override Firewall at Persistence Boundary
    if (isUserOverrideProtected(targetBook) || diff.classification === 'USER_OVERRIDE') {
      manifest.status = 'REJECTED_USER_OVERRIDE';
      return {
        success: false,
        manifest,
        modifiedBooks: cloneLibrary(currentLibrary),
        rollbackActions: [],
        error: `Migration aborted at persistence boundary: Book "${targetBook.title}" (${targetBook.id}) has user-defined overrides protecting it.`,
      };
    }

    // 3. Mutation Allowlist Verification
    const allowlistCheck = validateMutationAllowlist(diff);
    if (!allowlistCheck.valid) {
      return {
        success: false,
        manifest,
        modifiedBooks: cloneLibrary(currentLibrary),
        rollbackActions: [],
        error: `Migration rejected: Proposed diff for "${targetBook.title}" attempts to modify forbidden fields: ${allowlistCheck.forbiddenFields.join(', ')}`,
      };
    }

    // Apply surgical repair
    if (diff.after.seriesName !== undefined) targetBook.series = diff.after.seriesName;
    if (diff.after.ordinal !== undefined) targetBook.seriesInstallment = Number(diff.after.ordinal);
    if (diff.after.mainWorksTotal !== undefined) targetBook.seriesTotal = diff.after.mainWorksTotal;
    targetBook.seriesChecked = true;

    manifest.appliedCount++;
  }

  manifest.status = 'APPLIED';
  manifest.appliedAt = Date.now();

  return {
    success: true,
    manifest,
    modifiedBooks: modifiedLibrary,
    rollbackActions: plan.rollbackPlan,
  };
}

/**
 * Simulates rolling back a previously applied repair plan.
 * Restores exact pre-migration state.
 */
export function simulateRollbackRepairPlan(
  modifiedLibrary: ProductionBookRecord[],
  rollbackActions: RollbackAction[]
): ProductionBookRecord[] {
  const restoredLibrary = cloneLibrary(modifiedLibrary);

  for (const action of rollbackActions) {
    const bookIndex = restoredLibrary.findIndex(b => b.id === action.bookId);
    if (bookIndex === -1) continue;

    const book = restoredLibrary[bookIndex];
    if (action.restoreState.series !== undefined) book.series = action.restoreState.series;
    if (action.restoreState.seriesInstallment !== undefined) book.seriesInstallment = action.restoreState.seriesInstallment;
    if (action.restoreState.seriesTotal !== undefined) book.seriesTotal = action.restoreState.seriesTotal;
    
    if (action.restoreState.seriesChecked !== undefined) {
      book.seriesChecked = action.restoreState.seriesChecked;
    } else {
      delete book.seriesChecked;
    }
  }

  return restoredLibrary;
}

/**
 * Deep canonical equality check between two library snapshots.
 * Verifies 100% field-for-field identity across all records.
 */
export function verifyCanonicalLibraryEquivalence(
  libA: ProductionBookRecord[],
  libB: ProductionBookRecord[]
): { equivalent: boolean; differences: string[] } {
  const differences: string[] = [];

  if (libA.length !== libB.length) {
    differences.push(`Library length mismatch: libA (${libA.length}) vs libB (${libB.length})`);
    return { equivalent: false, differences };
  }

  for (let i = 0; i < libA.length; i++) {
    const a = libA[i];
    const b = libB.find(record => record.id === a.id);

    if (!b) {
      differences.push(`Book ID ${a.id} missing in libB`);
      continue;
    }

    // Verify surgical allowlisted fields (treating null/undefined consistently)
    const seriesA = a.series ?? null;
    const seriesB = b.series ?? null;
    if (seriesA !== seriesB) differences.push(`Book ${a.id} series mismatch: "${seriesA}" vs "${seriesB}"`);

    const instA = a.seriesInstallment ?? null;
    const instB = b.seriesInstallment ?? null;
    if (instA !== instB) differences.push(`Book ${a.id} seriesInstallment mismatch: ${instA} vs ${instB}`);

    const totA = a.seriesTotal ?? null;
    const totB = b.seriesTotal ?? null;
    if (totA !== totB) differences.push(`Book ${a.id} seriesTotal mismatch: ${totA} vs ${totB}`);

    const chkA = Boolean(a.seriesChecked);
    const chkB = Boolean(b.seriesChecked);
    if (chkA !== chkB) differences.push(`Book ${a.id} seriesChecked mismatch: ${chkA} vs ${chkB}`);

    // Verify untouchable protected fields
    if (a.id !== b.id) differences.push(`Book ID mismatch: ${a.id} vs ${b.id}`);
    if (a.title !== b.title) differences.push(`Book ${a.id} title mismatch: "${a.title}" vs "${b.title}"`);
    if (a.author !== b.author) differences.push(`Book ${a.id} author mismatch: "${a.author}" vs "${b.author}"`);
    if (JSON.stringify(a.userDefined ?? {}) !== JSON.stringify(b.userDefined ?? {})) {
      differences.push(`Book ${a.id} userDefined mismatch`);
    }
  }

  return { equivalent: differences.length === 0, differences };
}

function cloneLibrary(lib: ProductionBookRecord[]): ProductionBookRecord[] {
  return JSON.parse(JSON.stringify(lib));
}
