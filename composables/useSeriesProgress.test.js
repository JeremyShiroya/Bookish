import { describe, expect, it, vi } from 'vitest';
import {
  backfillSeriesTotals,
  ensureSeriesTotal,
  formatSeriesCollectionProgress,
  propagateSeriesTotal,
} from './useSeriesProgress';

describe('formatSeriesCollectionProgress', () => {
  it('shows owned books against a known series total', () => {
    expect(formatSeriesCollectionProgress(4, 6)).toBe('4/6 books collected');
  });

  it('shows complete series when the owned count reaches the total', () => {
    expect(formatSeriesCollectionProgress(6, 6)).toBe('Complete series');
    expect(formatSeriesCollectionProgress(7, 6)).toBe('Complete series');
  });

  it('falls back to the local plural count when the total is unknown', () => {
    expect(formatSeriesCollectionProgress(4, null)).toBe('4 Books');
    expect(formatSeriesCollectionProgress(4, 0)).toBe('4 Books');
  });

  it('uses the singular local count when the total is unknown', () => {
    expect(formatSeriesCollectionProgress(1, null)).toBe('1 Book');
  });
});

describe('ensureSeriesTotal', () => {
  it('searches metadata for an old series and persists the discovered total', async () => {
    const books = [
      { id: '1', title: 'Blindsighted', author: 'Karin Slaughter', series: 'Grant County', seriesInstallment: '1' },
      { id: '2', title: 'Kisscut', author: 'Karin Slaughter', series: 'Grant County', seriesInstallment: '2' },
    ];
    const fetchMetadataResults = vi.fn().mockResolvedValue([
      { title: 'Blindsighted', series: 'Grant County', seriesInstallment: '1', seriesTotal: '6' },
    ]);
    const updateBook = vi.fn().mockResolvedValue(undefined);

    const total = await ensureSeriesTotal({
      seriesName: 'Grant County',
      books,
      fetchMetadataResults,
      updateBook,
    });

    expect(total).toBe(6);
    expect(fetchMetadataResults).toHaveBeenCalledWith('Blindsighted', 'Karin Slaughter', undefined);
    expect(updateBook).toHaveBeenCalledTimes(2);
    expect(updateBook).toHaveBeenCalledWith({ ...books[0], seriesTotal: 6 });
    expect(updateBook).toHaveBeenCalledWith({ ...books[1], seriesTotal: 6 });
  });

  it('refreshes and corrects a stale stored total', async () => {
    const books = [
      { id: '1', title: 'Blindsighted', author: 'Karin Slaughter', series: 'Grant County', seriesTotal: 12 },
    ];
    const fetchMetadataResults = vi.fn().mockResolvedValue([
      { title: 'Blindsighted', series: 'Grant County', seriesTotal: '6' },
    ]);
    const updateBook = vi.fn().mockResolvedValue(undefined);

    const total = await ensureSeriesTotal({
      seriesName: 'Grant County',
      books,
      fetchMetadataResults,
      updateBook,
    });

    expect(total).toBe(6);
    expect(fetchMetadataResults).toHaveBeenCalledTimes(1);
    expect(updateBook).toHaveBeenCalledWith({ ...books[0], seriesTotal: 6 });
  });
});

describe('propagateSeriesTotal', () => {
  it('stores a known total on every matching local series book', async () => {
    const books = [
      { id: '1', series: 'Grant County' },
      { id: '2', series: 'grant-county' },
      { id: '3', series: 'Will Trent' },
    ];
    const updateBook = vi.fn().mockResolvedValue(undefined);

    const updated = await propagateSeriesTotal({
      seriesName: 'Grant County',
      seriesTotal: 6,
      books,
      updateBook,
    });

    expect(updated).toBe(2);
    expect(updateBook).toHaveBeenCalledTimes(2);
    expect(updateBook).toHaveBeenCalledWith({ ...books[0], seriesTotal: 6 });
    expect(updateBook).toHaveBeenCalledWith({ ...books[1], seriesTotal: 6 });
  });
});

describe('backfillSeriesTotals', () => {
  it('processes unique series sequentially and reports progress', async () => {
    const grantBooks = [
      { id: '1', title: 'Blindsighted', author: 'Karin Slaughter', series: 'Grant County' },
      { id: '2', title: 'Kisscut', author: 'Karin Slaughter', series: 'Grant County' },
    ];
    const duneBooks = [
      { id: '3', title: 'Dune', author: 'Frank Herbert', series: 'Dune' },
    ];
    const activeCalls = [];
    let inFlight = 0;
    const fetchMetadataResults = vi.fn().mockImplementation(async (title) => {
      inFlight += 1;
      activeCalls.push(inFlight);
      await Promise.resolve();
      inFlight -= 1;
      if (title === 'Blindsighted') return [{ series: 'Grant County', seriesTotal: '6' }];
      return [];
    });
    const updateBook = vi.fn().mockResolvedValue(undefined);
    const onProgress = vi.fn();

    const summary = await backfillSeriesTotals({
      seriesList: [
        { name: 'Grant County', books: grantBooks },
        { name: 'grant-county', books: grantBooks },
        { name: 'Dune', books: duneBooks },
      ],
      fetchMetadataResults,
      updateBook,
      onProgress,
    });

    expect(activeCalls.every((count) => count === 1)).toBe(true);
    expect(fetchMetadataResults).toHaveBeenCalledTimes(2);
    expect(summary).toEqual({ total: 2, updated: 1, unresolved: 1 });
    expect(onProgress).toHaveBeenLastCalledWith({
      current: 2,
      total: 2,
      seriesName: 'Dune',
      updated: 1,
      unresolved: 1,
    });
  });
});
