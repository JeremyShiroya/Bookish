import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSeriesTotalResults } from './useBookMetadataSearch';

describe('fetchSeriesTotalResults', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the lightweight series-total endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      results: [{ series: 'Grant County', seriesTotal: '6' }],
    }), { status: 200 }));

    const results = await fetchSeriesTotalResults('Blindsighted', 'Karin Slaughter');

    expect(fetchMock).toHaveBeenCalledWith('/api/books/series-total?title=Blindsighted&author=Karin+Slaughter');
    expect(results).toEqual([{ series: 'Grant County', seriesTotal: '6' }]);
  });
});
