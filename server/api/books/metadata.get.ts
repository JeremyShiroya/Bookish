import { defineEventHandler, getQuery, createError } from 'h3';
import { searchKobo, scrapeKoboBook } from '../../utils/koboScraper';
import { searchGoogleBooks, type GBResult } from '../../utils/googleBooksApi';
import { searchGoodreads, scrapeGoodreadsBook, type GoodreadsBookDetails, type GoodreadsSearchResult } from '../../utils/goodreadsScraper';
import { searchOpenLibrary, type OLResult } from '../../utils/openLibraryApi';

type MetadataSource = {
  id: string;
  title: string | null;
  author: string | null;
  cover: string | null;
  blurb: string | null;
  series: string | null;
  seriesInstallment: string | null;
  genre: string | null;
  publishYear: number | null;
  webReview?: string | null;
};

function norm(value?: string | null) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function scoreMatch(targetTitle?: string | null, targetAuthor?: string | null, candidateTitle?: string | null, candidateAuthor?: string | null) {
  const tt = norm(targetTitle);
  const ct = norm(candidateTitle);
  const ta = norm(targetAuthor);
  const ca = norm(candidateAuthor);
  let score = 0;
  if (tt && ct) {
    if (tt === ct) score += 8;
    else if (tt.includes(ct) || ct.includes(tt)) score += 5;
  }
  if (ta && ca) {
    if (ta === ca) score += 5;
    else if (ta.includes(ca) || ca.includes(ta)) score += 3;
  }
  return score;
}

function findBestMatch<T extends { title?: string | null; author?: string | null }>(
  targetTitle: string | null | undefined,
  targetAuthor: string | null | undefined,
  candidates: T[],
) {
  if (!candidates.length) return null;
  const ranked = [...candidates].sort(
    (a, b) => scoreMatch(targetTitle, targetAuthor, b.title, b.author) - scoreMatch(targetTitle, targetAuthor, a.title, a.author),
  );
  return ranked[0] || null;
}

function firstValue<T>(...values: Array<T | null | undefined>) {
  return values.find((value) => value !== null && value !== undefined && value !== '') ?? null;
}

function fromGoodreads(searchResult: GoodreadsSearchResult, details: GoodreadsBookDetails | null): MetadataSource {
  return {
    id: searchResult.url,
    title: firstValue(details?.title, searchResult.title),
    author: firstValue(details?.author, searchResult.author),
    cover: firstValue(details?.cover, searchResult.cover),
    blurb: details?.blurb ?? null,
    series: firstValue(details?.series, searchResult.series),
    seriesInstallment: firstValue(details?.seriesInstallment, searchResult.seriesInstallment),
    genre: details?.genre ?? null,
    publishYear: details?.publishYear ?? null,
    webReview: details?.webReview ?? null,
  };
}

function fromGoogleBooks(result: GBResult): MetadataSource {
  return {
    id: `gb:${result.title}`,
    title: result.title,
    author: result.author,
    cover: result.cover,
    blurb: result.blurb,
    series: result.series,
    seriesInstallment: result.seriesInstallment,
    genre: result.genre,
    publishYear: result.publishYear,
  };
}

function fromOpenLibrary(result: OLResult): MetadataSource {
  return {
    id: result.id,
    title: result.title,
    author: result.author,
    cover: result.cover,
    blurb: result.blurb,
    series: result.series,
    seriesInstallment: result.seriesInstallment,
    genre: result.genre,
    publishYear: result.publishYear,
  };
}

function fromKobo(result: NonNullable<Awaited<ReturnType<typeof scrapeKoboBook>>>): MetadataSource {
  return {
    id: result.url,
    title: result.title,
    author: result.author,
    cover: result.cover,
    blurb: result.blurb,
    series: result.series,
    seriesInstallment: result.seriesInstallment,
    genre: result.genre,
    publishYear: result.publishYear,
  };
}

function mergeMetadata(primary: MetadataSource, fallbacks: Array<MetadataSource | null>) {
  return {
    googleId: primary.id,
    title: firstValue(primary.title, ...fallbacks.map((item) => item?.title)),
    author: firstValue(primary.author, ...fallbacks.map((item) => item?.author)),
    cover: firstValue(primary.cover, ...fallbacks.map((item) => item?.cover)),
    blurb: firstValue(primary.blurb, ...fallbacks.map((item) => item?.blurb)),
    series: firstValue(primary.series, ...fallbacks.map((item) => item?.series)),
    seriesInstallment: firstValue(primary.seriesInstallment, ...fallbacks.map((item) => item?.seriesInstallment)),
    genre: firstValue(primary.genre, ...fallbacks.map((item) => item?.genre)),
    publishYear: firstValue(primary.publishYear, ...fallbacks.map((item) => item?.publishYear)),
    webReview: firstValue(primary.webReview, ...fallbacks.map((item) => item?.webReview)),
  };
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const title = query.title?.toString();
  const author = query.author?.toString();

  if (!title) {
    throw createError({ statusCode: 400, statusMessage: 'Title is required for metadata search' });
  }

  const [goodreadsSearchResult, gbResult, olResult, koboUrlsResult] = await Promise.allSettled([
    searchGoodreads(title, author),
    searchGoogleBooks(title, author),
    searchOpenLibrary(title, author),
    searchKobo(title, author),
  ]);

  const goodreadsResults = goodreadsSearchResult.status === 'fulfilled' ? goodreadsSearchResult.value : [];
  const gbResults = gbResult.status === 'fulfilled' ? gbResult.value : [];
  const olResults = olResult.status === 'fulfilled' ? olResult.value : [];
  const koboUrls = koboUrlsResult.status === 'fulfilled' ? koboUrlsResult.value : [];

  const [goodreadsDetailsResult, koboDetailsResult] = await Promise.allSettled([
    Promise.allSettled(goodreadsResults.slice(0, 5).map(async (item) => ({
      search: item,
      details: await scrapeGoodreadsBook(item.url, item),
    }))),
    Promise.allSettled(koboUrls.slice(0, 5).map((url) => scrapeKoboBook(url))),
  ]);

  const goodreadsSources =
    goodreadsDetailsResult.status === 'fulfilled'
      ? goodreadsDetailsResult.value
          .filter((entry): entry is PromiseFulfilledResult<{ search: GoodreadsSearchResult; details: GoodreadsBookDetails | null }> => entry.status === 'fulfilled')
          .map((entry) => fromGoodreads(entry.value.search, entry.value.details))
      : [];

  const gbSources = gbResults.map(fromGoogleBooks);
  const olSources = olResults.map(fromOpenLibrary);
  const koboSources =
    koboDetailsResult.status === 'fulfilled'
      ? koboDetailsResult.value
          .filter((entry): entry is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof scrapeKoboBook>>>> => entry.status === 'fulfilled' && entry.value !== null)
          .map((entry) => fromKobo(entry.value))
      : [];

  const preferredSources = goodreadsSources.length
    ? goodreadsSources
    : [...gbSources, ...olSources, ...koboSources];

  const seen = new Set<string>();
  const results = preferredSources
    .map((source) => {
      const gb = findBestMatch(source.title, source.author, gbSources);
      const ol = findBestMatch(source.title, source.author, olSources);
      const kobo = findBestMatch(source.title, source.author, koboSources);
      return mergeMetadata(source, [gb, ol, kobo]);
    })
    .filter((item) => {
      const key = `${norm(item.title)}:${norm(item.author)}`;
      if (!key.replace(':', '') || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);

  return { results };
});
