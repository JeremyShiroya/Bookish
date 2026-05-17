import { defineEventHandler, getQuery, createError } from 'h3';
import { searchGoodreads, scrapeGoodreadsBook } from '../../utils/goodreadsScraper';
import { searchOpenLibrary } from '../../utils/openLibraryApi';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const title = query.title?.toString();
  const author = query.author?.toString();

  if (!title) {
    throw createError({ statusCode: 400, statusMessage: 'Title is required for metadata search' });
  }

  // 1. Goodreads — best covers (OG image) + rich metadata
  try {
    const grResults = await searchGoodreads(title, author);

    if (grResults.length > 0) {
      const settled = await Promise.allSettled(
        grResults.slice(0, 3).map(async (book) => {
          const details = await scrapeGoodreadsBook(book.url);
          if (!details) return null;
          return {
            googleId: book.url,
            title: book.title,
            author: book.author,
            cover: details.cover || book.cover || null,
            blurb: details.blurb || null,
            series: details.series || null,
            seriesInstallment: details.seriesInstallment || null,
            genre: details.genre || null,
            publishYear: details.publishYear || null,
            webReview: details.webReview || null,
          };
        })
      );

      const results = settled
        .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof scrapeGoodreadsBook>> & object>> =>
          r.status === 'fulfilled' && r.value !== null
        )
        .map(r => r.value);

      if (results.length > 0) {
        return { results };
      }
    }
  } catch (err) {
    console.warn('Goodreads scraper failed, falling back to OpenLibrary', err);
  }

  // 2. OpenLibrary fallback
  const olResults = await searchOpenLibrary(title, author);
  if (olResults.length > 0) {
    return {
      results: olResults.map(ol => ({
        googleId: ol.id,
        title: ol.title,
        author: ol.author,
        cover: ol.cover,
        blurb: ol.blurb,
        series: ol.series,
        seriesInstallment: ol.seriesInstallment,
        genre: ol.genre,
        publishYear: ol.publishYear,
        webReview: null,
      })),
    };
  }

  return { results: [] };
});
