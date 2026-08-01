import { createError, defineEventHandler, getQuery } from 'h3';
import { fetchGoodreadsSeriesBooks } from '../../utils/goodreadsScraper';
import { seriesCacheKey, withSeriesCache } from '../../utils/seriesCache';

// Roster of every installment in a series, resolved from a book the user owns.
// Powers the series-suggestions cards (Settings → Preferences): the missing
// installments render with the real title and cover from the Goodreads series
// page, so the user knows exactly which book to look for.
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const title = query.title?.toString().trim();
  const author = query.author?.toString().trim() || undefined;
  const series = query.series?.toString().trim() || undefined;

  if (!title) {
    throw createError({ statusCode: 400, statusMessage: 'A seed book title is required for series lookup' });
  }

  // Keyed on the SERIES where one is known, not the seed book: two readers
  // owning different books of the same series are asking the same question, and
  // the answer they get back is identical. Only when the series is unknown does
  // the seed title become the key.
  //
  // Caching here does more than save time — Goodreads rate-limits per network
  // and starts returning 202 anti-bot stubs when scraped too often, so every
  // hit served from cache is one fewer chance of walling the whole deployment.
  const { value } = await withSeriesCache(
    seriesCacheKey('roster', series || title, series ? undefined : author),
    (result: { books?: unknown[] }) => !result?.books?.length,
    () => fetchGoodreadsSeriesBooks(title, author, series),
  );

  return value;
});
