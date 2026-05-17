import { defineEventHandler, getQuery, createError } from 'h3';
import { searchGoogleBooks, type GBResult } from '../../utils/googleBooksApi';
import { searchOpenLibrary, findOlMatch, type OLResult } from '../../utils/openLibraryApi';
import { getGoodreadsReview } from '../../utils/goodreadsScraper';

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findGbMatch(targetTitle: string, gbResults: GBResult[]): GBResult | null {
  if (!gbResults.length) return null;
  const n = norm(targetTitle);
  return gbResults.find(r => norm(r.title).includes(n) || n.includes(norm(r.title))) ?? gbResults[0];
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const title = query.title?.toString();
  const author = query.author?.toString();

  if (!title) {
    throw createError({ statusCode: 400, statusMessage: 'Title is required for metadata search' });
  }

  // Run all three sources in parallel
  const [olResult, gbResult, reviewResult] = await Promise.allSettled([
    searchOpenLibrary(title, author),
    searchGoogleBooks(title, author),
    getGoodreadsReview(title, author),
  ]);

  const olResults = olResult.status === 'fulfilled' ? olResult.value : [];
  const gbResults = gbResult.status === 'fulfilled' ? gbResult.value : [];
  const webReview = reviewResult.status === 'fulfilled' ? reviewResult.value : null;

  // Primary path: OpenLibrary results with Google Books covers where available
  if (olResults.length > 0) {
    return {
      results: olResults.map((ol: OLResult) => {
        const gb = findGbMatch(ol.title, gbResults);
        return {
          googleId: ol.id,
          title: ol.title,
          author: ol.author,
          cover: gb?.cover ?? ol.cover,               // GB covers are higher res
          blurb: ol.blurb ?? gb?.blurb ?? null,
          series: ol.series ?? gb?.series ?? null,
          seriesInstallment: ol.seriesInstallment ?? gb?.seriesInstallment ?? null,
          genre: ol.genre ?? gb?.genre ?? null,
          publishYear: ol.publishYear ?? gb?.publishYear ?? null,
          webReview,
        };
      }),
    };
  }

  // Fallback: Google Books standalone
  if (gbResults.length > 0) {
    return {
      results: gbResults.map((gb: GBResult) => ({
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
