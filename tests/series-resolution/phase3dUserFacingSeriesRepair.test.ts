// Phase 3D Deliverable: Realistic Mixed-Library User-Facing Series Repair Integration Test Suite

import { describe, it, expect } from 'vitest';
import { backfillLibraryMetadata } from '../../composables/useMetadataBackfill';
import { ProductionBookRecord } from '../../server/utils/productionSnapshotEngine';

describe('Phase 3D — User-Facing Series Repair Integration (Realistic Mixed Library)', () => {

  // Realistic Mixed Library Roster (13 Books)
  const mixedLibraryCorpus: ProductionBookRecord[] = [
    // 1-3. Already correctly assigned Mistborn trilogy
    { id: 'b_01', title: 'The Final Empire', author: 'Brandon Sanderson', series: 'Mistborn', seriesInstallment: 1, seriesTotal: 3, seriesChecked: true },
    { id: 'b_02', title: 'The Well of Ascension', author: 'Brandon Sanderson', series: 'Mistborn', seriesInstallment: 2, seriesTotal: 3, seriesChecked: true },
    { id: 'b_03', title: 'The Hero of Ages', author: 'Brandon Sanderson', series: 'Mistborn', seriesInstallment: 3, seriesTotal: 3, seriesChecked: true },

    // 4. Standalone that belongs to a series (Dune marked standalone)
    { id: 'b_04', title: 'Dune', author: 'Frank Herbert', series: null, seriesInstallment: null, seriesTotal: null, seriesChecked: true },

    // 5. 1/1 -> 1/2+ (Dune Messiah marked 1/1)
    { id: 'b_05', title: 'Dune Messiah', author: 'Frank Herbert', series: 'Dune', seriesInstallment: 2, seriesTotal: 1, seriesChecked: true },

    // 6. 1/1 -> 1/30+ (The Color of Magic marked 1/1)
    { id: 'b_06', title: 'The Color of Magic', author: 'Terry Pratchett', series: 'Discworld', seriesInstallment: 1, seriesTotal: 1, seriesChecked: true },

    // 7. Incorrect series name (A Game of Thrones wrongly named "Song of Ice")
    { id: 'b_07', title: 'A Game of Thrones', author: 'George R.R. Martin', series: 'Song of Ice', seriesInstallment: 1, seriesTotal: 1, seriesChecked: true },

    // 8. Incorrect installment (The Light Fantastic marked installment 1 instead of 2)
    { id: 'b_08', title: 'The Light Fantastic', author: 'Terry Pratchett', series: 'Discworld', seriesInstallment: 1, seriesTotal: 41, seriesChecked: true },

    // 9. Genuine standalone (To Kill a Mockingbird)
    { id: 'b_09', title: 'To Kill a Mockingbird', author: 'Harper Lee', series: null, seriesInstallment: null, seriesTotal: null, seriesChecked: true },

    // 10. User-protected book (Custom user series override)
    { id: 'b_10', title: 'Custom Special Edition', author: 'Custom Author', series: 'Custom Vault', seriesInstallment: 1, seriesTotal: 1, seriesChecked: true, userDefined: { series: true } },

    // 11. Low-confidence book (Weak provider result)
    { id: 'b_11', title: 'Obscure Indie Novella', author: 'Unknown Writer', series: 'Draft Series', seriesInstallment: 1, seriesTotal: 1, seriesChecked: true },

    // 12. Book with missing cover/blurb metadata + wrong series total
    { id: 'b_12', title: 'Children of Dune', author: 'Frank Herbert', cover: 'data:image/svg+xml,placeholder', blurb: '', series: 'Dune', seriesInstallment: 3, seriesTotal: 1, seriesChecked: false },

    // 13. Additional book in Mistborn series for 10+ roster baseline
    { id: 'b_13', title: 'The Alloy of Law', author: 'Brandon Sanderson', series: 'Mistborn Era 2', seriesInstallment: 1, seriesTotal: 4, seriesChecked: true }
  ];

  // Mock Metadata Provider API returning realistic multi-source search results
  const mockSearchMetadata = async (title: string, author?: string) => {
    const titleNorm = title.toLowerCase();

    if (titleNorm.includes('dune messiah')) {
      return [
        { title: 'Dune Messiah', author: 'Frank Herbert', series: 'Dune', seriesInstallment: 2, seriesTotal: 6, primarySource: 'goodreads', confidence: 0.95 },
        { title: 'Dune Messiah', author: 'Frank Herbert', series: 'Dune', seriesInstallment: 2, seriesTotal: 6, primarySource: 'hardcover', confidence: 0.95 },
      ];
    }
    if (titleNorm.includes('children of dune')) {
      return [
        { title: 'Children of Dune', author: 'Frank Herbert', cover: 'https://images.example.com/children-dune.jpg', blurb: 'Book 3 of Dune', series: 'Dune', seriesInstallment: 3, seriesTotal: 6, primarySource: 'goodreads', confidence: 0.95 },
      ];
    }
    if (titleNorm.includes('dune')) {
      return [
        { title: 'Dune', author: 'Frank Herbert', series: 'Dune', seriesInstallment: 1, seriesTotal: 6, primarySource: 'goodreads', confidence: 0.95 },
        { title: 'Dune', author: 'Frank Herbert', series: 'Dune', seriesInstallment: 1, seriesTotal: 6, primarySource: 'kobo', confidence: 0.95 },
      ];
    }
    if (titleNorm.includes('color of magic')) {
      return [
        { title: 'The Color of Magic', author: 'Terry Pratchett', series: 'Discworld', seriesInstallment: 1, seriesTotal: 41, primarySource: 'goodreads', confidence: 0.95 },
        { title: 'The Color of Magic', author: 'Terry Pratchett', series: 'Discworld', seriesInstallment: 1, seriesTotal: 41, primarySource: 'wikidata', confidence: 0.95 },
      ];
    }
    if (titleNorm.includes('light fantastic')) {
      return [
        { title: 'The Light Fantastic', author: 'Terry Pratchett', series: 'Discworld', seriesInstallment: 2, seriesTotal: 41, primarySource: 'goodreads', confidence: 0.95 },
      ];
    }
    if (titleNorm.includes('game of thrones')) {
      return [
        { title: 'A Game of Thrones', author: 'George R.R. Martin', series: 'A Song of Ice and Fire', seriesInstallment: 1, seriesTotal: 7, primarySource: 'hardcover', confidence: 0.95 },
        { title: 'A Game of Thrones', author: 'George R.R. Martin', series: 'A Song of Ice and Fire', seriesInstallment: 1, seriesTotal: 7, primarySource: 'goodreads', confidence: 0.95 },
      ];
    }
    if (titleNorm.includes('final empire') || titleNorm.includes('well of ascension') || titleNorm.includes('hero of ages')) {
      return [
        { title: title, author: 'Brandon Sanderson', series: 'Mistborn', seriesInstallment: titleNorm.includes('final') ? 1 : titleNorm.includes('well') ? 2 : 3, seriesTotal: 3, primarySource: 'goodreads', confidence: 0.95 }
      ];
    }
    if (titleNorm.includes('mockingbird')) {
      return [
        { title: 'To Kill a Mockingbird', author: 'Harper Lee', series: null, seriesInstallment: null, seriesTotal: null, primarySource: 'goodreads', confidence: 0.95 }
      ];
    }
    if (titleNorm.includes('obscure indie')) {
      // Single weak source returning low confidence
      return [
        { title: 'Obscure Indie Novella', author: 'Unknown Writer', series: 'Possible Series', seriesInstallment: 5, seriesTotal: 99, primarySource: 'unverified', confidence: 0.40 }
      ];
    }
    if (titleNorm.includes('custom special')) {
      return [
        { title: 'Custom Special Edition', author: 'Custom Author', series: 'Overwritten Series', seriesInstallment: 9, seriesTotal: 9, primarySource: 'goodreads', confidence: 0.95 }
      ];
    }
    return [];
  };

  it('1. Executes full-library series reconciliation pass & repairs bad records', async () => {
    const updatedBooksMap = new Map<string, ProductionBookRecord>();
    const updateBookFn = async (updatedRecord: ProductionBookRecord) => {
      updatedBooksMap.set(updatedRecord.id, updatedRecord);
    };

    const result = await backfillLibraryMetadata({
      books: mixedLibraryCorpus,
      updateBook: updateBookFn,
      searchFn: mockSearchMetadata,
    });

    // Check overall summary stats
    expect(result.total).toBe(13);
    expect(result.repairedCount).toBeGreaterThanOrEqual(5);
    expect(result.protectedCount).toBe(1); // b_10 protected
    expect(result.lowConfidenceCount).toBe(1); // b_11 low confidence

    // Verify per-book diagnostic logging output
    expect(result.diagnostics).toHaveLength(13);
    const diagB04 = result.diagnostics.find(d => d.bookId === 'b_04');
    expect(diagB04?.decision).toBe('REPAIRED');
    expect(diagB04?.proposedState).toEqual({ series: 'Dune', seriesInstallment: 1, seriesTotal: 6, seriesChecked: true });

    // Assert specific book corrections:
    // b_04: Standalone Dune -> Dune #1 / 6
    const b04 = updatedBooksMap.get('b_04');
    expect(b04?.series).toBe('Dune');
    expect(b04?.seriesInstallment).toBe(1);
    expect(b04?.seriesTotal).toBe(6);

    // b_05: Dune Messiah 1/1 -> Dune #2 / 6
    const b05 = updatedBooksMap.get('b_05');
    expect(b05?.series).toBe('Dune');
    expect(b05?.seriesInstallment).toBe(2);
    expect(b05?.seriesTotal).toBe(6);

    // b_06: The Color of Magic 1/1 -> Discworld #1 / 41
    const b06 = updatedBooksMap.get('b_06');
    expect(b06?.series).toBe('Discworld');
    expect(b06?.seriesInstallment).toBe(1);
    expect(b06?.seriesTotal).toBe(41);

    // b_07: A Game of Thrones "Song of Ice" -> A Song of Ice and Fire #1 / 7
    const b07 = updatedBooksMap.get('b_07');
    expect(b07?.series).toBe('A Song of Ice and Fire');
    expect(b07?.seriesInstallment).toBe(1);
    expect(b07?.seriesTotal).toBe(7);

    // b_08: The Light Fantastic installment 1 -> 2
    const b08 = updatedBooksMap.get('b_08');
    expect(b08?.seriesInstallment).toBe(2);

    // b_10: User-protected book remains UNCHANGED (0 mutations)
    const b10 = updatedBooksMap.get('b_10');
    expect(b10).toBeUndefined(); // Never passed to updateBook because it was protected!
    const diagB10 = result.diagnostics.find(d => d.bookId === 'b_10');
    expect(diagB10?.decision).toBe('PROTECTED');

    // b_11: Low-confidence book remains UNCHANGED
    const diagB11 = result.diagnostics.find(d => d.bookId === 'b_11');
    expect(diagB11?.decision).toBe('LOW_CONFIDENCE');

    // b_12: Cover backfilled in Pass 1 + seriesTotal repaired to 6 in Pass 2
    const b12 = updatedBooksMap.get('b_12');
    expect(b12?.cover).toBe('https://images.example.com/children-dune.jpg');
    expect(b12?.seriesTotal).toBe(6);
  });

  it('2. Verifies Idempotency: Repeated repair pass on repaired library produces ZERO re-mutations', async () => {
    // 1st Run: Build repaired library state
    const repairedLibrary: ProductionBookRecord[] = [];
    const updateFn = async (rec: ProductionBookRecord) => {
      const idx = repairedLibrary.findIndex(b => b.id === rec.id);
      if (idx !== -1) repairedLibrary[idx] = rec;
      else repairedLibrary.push(rec);
    };

    // Populate initial library clone
    mixedLibraryCorpus.forEach(b => repairedLibrary.push({ ...b }));

    await backfillLibraryMetadata({
      books: repairedLibrary,
      updateBook: updateFn,
      searchFn: mockSearchMetadata,
    });

    // Capture state after 1st run
    const postFirstRunState = JSON.parse(JSON.stringify(repairedLibrary));

    // 2nd Run: Run repair pass again on already-repaired library
    const secondRunUpdates: ProductionBookRecord[] = [];
    const secondUpdateFn = async (rec: ProductionBookRecord) => {
      secondRunUpdates.push(rec);
    };

    const secondResult = await backfillLibraryMetadata({
      books: repairedLibrary,
      updateBook: secondUpdateFn,
      searchFn: mockSearchMetadata,
    });

    // Assert Idempotency
    expect(secondResult.repairedCount).toBe(0); // ZERO REPAIRS ON 2ND PASS!
    expect(secondResult.unchangedCount).toBe(11); // All valid books remain unchanged
    expect(secondRunUpdates).toHaveLength(0); // 0 database writes on second pass!

    // Verify canonical library equivalence between 1st and 2nd run
    expect(repairedLibrary).toEqual(postFirstRunState);
  });
});
