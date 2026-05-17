import { defineEventHandler, getQuery, createError } from 'h3';
import { searchKobo, scrapeKoboBook } from '../../utils/koboScraper';
import { searchGoogleBooks, type GBResult } from '../../utils/googleBooksApi';
import { getGoodreadsReview } from '../../utils/goodreadsScraper';

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findGbMatch(koboTitle: string, gb: GBResult[]): GBResult | null {
  if (!gb.length) return null;
  const n = norm(koboTitle);
  return (
    gb.find(r => norm(r.title).includes(n) || n.includes(norm(r.title)))
    ?? gb[0]
  );
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const title = query.title?.toString();
  const author = query.author?.toString();

  if (!title) {
    throw createError({ statusCode: 400, statusMessage: 'Title is required for metadata search' });
  }

  // 1. Kick off all three source searches in parallel
  const [koboUrlsResult, gbResult, reviewResult] = await Promise.allSettled([
    searchKobo(title, author),
    searchGoogleBooks(title, author),
    getGoodreadsReview(title, author),
  ]);

  const koboUrls = koboUrlsResult.status === 'fulfilled' ? koboUrlsResult.value : [];
  const gbResults = gbResult.status === 'fulfilled' ? gbResult.value : [];
  const webReview = reviewResult.status === 'fulfilled' ? reviewResult.value : null;

  // 2. Scrape top Kobo pages in parallel
  const scraped = koboUrls.length
    ? await Promise.allSettled(koboUrls.slice(0, 3).map(url => scrapeKoboBook(url)))
    : [];

  const enrichedResults = scraped
    .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof scrapeKoboBook>>>> =>
      r.status === 'fulfilled' && r.value !== null && r.value.title !== ''
    )
    .map(r => {
      const kobo = r.value;
      const gb = findGbMatch(kobo.title, gbResults);
      return {
        googleId: kobo.url,
        title: kobo.title,
        author: kobo.author,
        cover: kobo.cover,
        blurb: kobo.blurb ?? gb?.blurb ?? null,
        series: kobo.series ?? gb?.series ?? null,
        seriesInstallment: kobo.seriesInstallment ?? gb?.seriesInstallment ?? null,
        genre: kobo.genre ?? gb?.genre ?? null,
        publishYear: kobo.publishYear ?? gb?.publishYear ?? null,
        webReview,
      };
    });

  if (enrichedResults.length > 0) {
    return { results: enrichedResults };
  }

  // 3. Kobo blocked entirely — fall back to Google Books + Goodreads review
  if (gbResults.length > 0) {
    return {
      results: gbResults.slice(0, 5).map(gb => ({
        googleId: `gb:${gb.title}`,
        title: gb.title,
        author: gb.author ?? '',
        cover: gb.cover,
        blurb: gb.blurb,
        series: gb.series,
        seriesInstallment: gb.seriesInstallment,
        genre: gb.genre,
        publishYear: gb.publishYear,
        webReview,
      })),
    };
  }

  return { results: [] };
});
