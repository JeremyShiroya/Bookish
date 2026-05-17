import { defineEventHandler, getQuery, createError } from 'h3';
import { searchGoogleBooks, type GBResult } from '../../utils/googleBooksApi';
import { searchOpenLibrary, findOlMatch } from '../../utils/openLibraryApi';
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
  const [gbResult, olResult, reviewResult] = await Promise.allSettled([
    searchGoogleBooks(title, author),
    searchOpenLibrary(title, author),
    getGoodreadsReview(title, author),
  ]);

  const gbResults = gbResult.status === 'fulfilled' ? gbResult.value : [];
  const olResults = olResult.status === 'fulfilled' ? olResult.value : [];
  const webReview = reviewResult.status === 'fulfilled' ? reviewResult.value : null;

  // Primary path: Google Books results enriched with OpenLibrary gap-fills
  if (gbResults.length > 0) {
    return {
      results: gbResults.map(gb => {
        const ol = findOlMatch(gb.title, olResults);
        return {
          googleId: `gb:${gb.title}`,
          title: gb.title,
          author: gb.author ?? '',
          cover: gb.cover ?? ol?.cover ?? null,
          blurb: gb.blurb ?? ol?.blurb ?? null,
          series: gb.series ?? ol?.series ?? null,
          seriesInstallment: gb.seriesInstallment ?? ol?.seriesInstallment ?? null,
          genre: gb.genre ?? ol?.genre ?? null,
          publishYear: gb.publishYear ?? ol?.publishYear ?? null,
          webReview,
        };
      }),
    };
  }

  // Fallback: OpenLibrary standalone
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
        webReview,
      })),
    };
  }

  return { results: [] };
});
