import { createError, defineEventHandler, getQuery } from 'h3';
import { fetchGoodreadsSeriesBooks } from '../../utils/goodreadsScraper';
import { fetchHardcoverSeriesRoster } from '../../utils/hardcoverApi';
import { seriesCacheKey, withSeriesCache } from '../../utils/seriesCache';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const title = query.title?.toString().trim();
  const author = query.author?.toString().trim() || undefined;
  const series = query.series?.toString().trim() || undefined;

  if (!title) {
    throw createError({ statusCode: 400, statusMessage: 'A seed book title is required for series lookup' });
  }

  const { value } = await withSeriesCache(
    seriesCacheKey('roster', series || title, series ? undefined : author),
    (result: { books?: unknown[] }) => !result?.books?.length,
    async () => {
      const hardcoverRoster = await fetchHardcoverSeriesRoster(series || title, title);
      if (hardcoverRoster.books?.length) {
        return hardcoverRoster;
      }
      return fetchGoodreadsSeriesBooks(title, author, series);
    },
  );

  return value;
});
