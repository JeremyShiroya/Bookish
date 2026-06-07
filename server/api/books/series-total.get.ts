import { createError, defineEventHandler, getQuery } from 'h3';
import {
  scrapeGoodreadsBook,
  searchGoodreads,
} from '../../utils/goodreadsScraper';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const title = query.title?.toString().trim();
  const author = query.author?.toString().trim();

  if (!title) {
    throw createError({ statusCode: 400, statusMessage: 'Title is required for series lookup' });
  }

  const searchResults = await searchGoodreads(title, author);
  const details = await Promise.allSettled(
    searchResults.slice(0, 3).map((result) => scrapeGoodreadsBook(result.url, result)),
  );

  const results = details
    .filter((entry): entry is PromiseFulfilledResult<Awaited<ReturnType<typeof scrapeGoodreadsBook>>> => (
      entry.status === 'fulfilled' && entry.value !== null
    ))
    .map((entry) => entry.value)
    .filter((result) => result.series && Number(result.seriesTotal) > 0)
    .map((result) => ({
      title: result.title,
      author: result.author,
      series: result.series,
      seriesInstallment: result.seriesInstallment,
      seriesTotal: result.seriesTotal,
    }));

  return { results };
});
