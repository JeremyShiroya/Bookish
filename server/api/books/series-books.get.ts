import { createError, defineEventHandler, getQuery } from 'h3';
import { fetchGoodreadsSeriesBooks } from '../../utils/goodreadsScraper';

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

  return fetchGoodreadsSeriesBooks(title, author, series);
});
