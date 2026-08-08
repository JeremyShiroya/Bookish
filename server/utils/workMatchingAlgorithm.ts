// Phase 0 Deliverable 4: Canonical Work Matching Algorithm for Pages Intelligence Engine v3.0

import { CanonicalWork, EvidenceItem } from './seriesDomainTypes';

function normalizeTitle(title: string): string {
  return String(title || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '') // Strip parentheticals
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAuthor(author: string): string {
  return String(author || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchCanonicalWork(
  edition: {
    title: string;
    author?: string;
    isbn13?: string;
    isbn10?: string;
    hardcoverId?: string;
    goodreadsId?: string;
    openLibraryKey?: string;
  },
  existingWorks: CanonicalWork[] = []
): { matchedWork: CanonicalWork | null; confidence: number; isNewWorkNeeded: boolean } {
  // 1. ISBN Exact Match (Top Priority)
  if (edition.isbn13 || edition.isbn10) {
    const isbnMatch = existingWorks.find((w) =>
      w.editions.some(
        (e) => (edition.isbn13 && e.isbn13 === edition.isbn13) || (edition.isbn10 && e.isbn10 === edition.isbn10)
      )
    );
    if (isbnMatch) {
      return { matchedWork: isbnMatch, confidence: 1.0, isNewWorkNeeded: false };
    }
  }

  // 2. External Provider Key Match
  if (edition.hardcoverId || edition.goodreadsId || edition.openLibraryKey) {
    const keyMatch = existingWorks.find((w) =>
      w.editions.some(
        (e) =>
          (edition.hardcoverId && e.hardcoverId === edition.hardcoverId) ||
          (edition.goodreadsId && e.goodreadsId === edition.goodreadsId) ||
          (edition.openLibraryKey && e.openLibraryKey === edition.openLibraryKey)
      )
    );
    if (keyMatch) {
      return { matchedWork: keyMatch, confidence: 0.98, isNewWorkNeeded: false };
    }
  }

  // 3. Title + Author Similarity Match
  const targetTitle = normalizeTitle(edition.title);
  const targetAuthor = normalizeAuthor(edition.author || '');

  if (!targetTitle) {
    return { matchedWork: null, confidence: 0, isNewWorkNeeded: false };
  }

  for (const work of existingWorks) {
    const workTitle = normalizeTitle(work.canonicalTitle);
    const workAuthor = normalizeAuthor(work.primaryAuthor);

    const titleMatch = targetTitle === workTitle || targetTitle.includes(workTitle) || workTitle.includes(targetTitle);
    const authorMatch = !targetAuthor || !workAuthor || targetAuthor === workAuthor || targetAuthor.includes(workAuthor);

    if (titleMatch && authorMatch) {
      const score = targetTitle === workTitle && targetAuthor === workAuthor ? 0.95 : 0.85;
      return { matchedWork: work, confidence: score, isNewWorkNeeded: false };
    }
  }

  // 4. No Match Found -> Needs New Canonical Work Entity
  return { matchedWork: null, confidence: 0, isNewWorkNeeded: true };
}
