import { defineEventHandler, getQuery, createError } from 'h3';
import { searchKobo, scrapeKoboBook } from '../../utils/koboScraper';
import { searchGoogleBooks, type GBResult } from '../../utils/googleBooksApi';
import { searchInternetArchive, type IAResult } from '../../utils/internetArchiveApi';
import { searchGoodreads, scrapeGoodreadsBook, type GoodreadsBookDetails, type GoodreadsSearchResult } from '../../utils/goodreadsScraper';
import { searchOpenLibrary, type OLResult } from '../../utils/openLibraryApi';
import { buildMetadataResults, type MetadataSource } from '../../utils/metadataAggregator';

function firstValue<T>(...values: Array<T | null | undefined>) {
  return values.find((value) => value !== null && value !== undefined && value !== '') ?? null;
}

function fromGoodreads(searchResult: GoodreadsSearchResult, details: GoodreadsBookDetails | null): MetadataSource {
  return {
    id: searchResult.url,
    source: 'goodreads',
    title: firstValue(details?.title, searchResult.title),
    author: firstValue(details?.author, searchResult.author),
    cover: firstValue(details?.cover, searchResult.cover),
    blurb: details?.blurb ?? null,
    series: firstValue(details?.series, searchResult.series),
    seriesInstallment: firstValue(details?.seriesInstallment, searchResult.seriesInstallment),
    genre: details?.genre ?? null,
    publishYear: details?.publishYear ?? null,
    webReview: firstValue(details?.webReview, searchResult.webReview),
  };
}

function fromGoogleBooks(result: GBResult): MetadataSource {
  return {
    id: `gb:${result.title}:${result.author || ''}`,
    source: 'googleBooks',
    title: result.title,
    author: result.author,
    cover: result.cover,
    blurb: result.blurb,
    series: result.series,
    seriesInstallment: result.seriesInstallment,
    genre: result.genre,
    publishYear: result.publishYear,
    publisher: result.publisher,
  };
}

function fromOpenLibrary(result: OLResult): MetadataSource {
  return {
    id: result.id,
    source: 'openLibrary',
    title: result.title,
    author: result.author,
    cover: result.cover,
    blurb: result.blurb,
    series: result.series,
    seriesInstallment: result.seriesInstallment,
    genre: result.genre,
    publishYear: result.publishYear,
    publisher: result.publisher,
  };
}

function fromInternetArchive(result: IAResult): MetadataSource {
  return {
    id: result.id,
    source: 'internetArchive',
    title: result.title,
    author: result.author,
    cover: result.cover,
    blurb: result.blurb,
    series: result.series,
    seriesInstallment: result.seriesInstallment,
    genre: result.genre,
    publishYear: result.publishYear,
    publisher: result.publisher,
  };
}

function fromKobo(result: NonNullable<Awaited<ReturnType<typeof scrapeKoboBook>>>): MetadataSource {
  return {
    id: result.url,
    source: 'kobo',
    title: result.title,
    author: result.author,
    cover: result.cover,
    blurb: result.blurb,
    series: result.series,
    seriesInstallment: result.seriesInstallment,
    genre: result.genre,
    publishYear: result.publishYear,
    publisher: (result as unknown as { publisher?: string | null }).publisher ?? null,
  };
}

async function withTimeout<T>(label: string, task: Promise<T>, fallback: T, timeoutMs = 7000): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } catch (error) {
    console.warn(`${label} metadata lookup failed:`, error);
    return fallback;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function getGoodreadsSources(title: string, author?: string) {
  const goodreadsResults = await withTimeout(
    'Goodreads search',
    searchGoodreads(title, author),
    [] as GoodreadsSearchResult[],
    15000,
  );

  const details = await withTimeout(
    'Goodreads details',
    Promise.allSettled(goodreadsResults.slice(0, 4).map(async (item) => ({
      search: item,
      details: await scrapeGoodreadsBook(item.url, item),
    }))),
    [] as PromiseSettledResult<{ search: GoodreadsSearchResult; details: GoodreadsBookDetails | null }>[],
    15000,
  );

  return details
    .filter((entry): entry is PromiseFulfilledResult<{ search: GoodreadsSearchResult; details: GoodreadsBookDetails | null }> => entry.status === 'fulfilled')
    .map((entry) => fromGoodreads(entry.value.search, entry.value.details));
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const title = query.title?.toString().trim();
  const author = query.author?.toString().trim();

  if (!title) {
    throw createError({ statusCode: 400, statusMessage: 'Title is required for metadata search' });
  }

  const internetArchiveSourcesPromise = withTimeout(
    'Internet Archive',
    searchInternetArchive(title, author),
    [] as IAResult[],
    9000,
  ).then((results) => results.map(fromInternetArchive));

  const openLibrarySourcesPromise = withTimeout(
    'Open Library',
    searchOpenLibrary(title, author),
    [] as OLResult[],
    9000,
  ).then((results) => results.map(fromOpenLibrary));

  const googleBooksSourcesPromise = withTimeout(
    'Google Books',
    searchGoogleBooks(title, author),
    [] as GBResult[],
    9000,
  ).then((results) => results.map(fromGoogleBooks));

  const koboSourcesPromise = (async () => {
    const koboUrls = await withTimeout('Kobo search', searchKobo(title, author), [] as string[], 7000);
    const koboDetails = await withTimeout(
      'Kobo details',
      Promise.allSettled(koboUrls.slice(0, 4).map((url) => scrapeKoboBook(url))),
      [] as PromiseSettledResult<NonNullable<Awaited<ReturnType<typeof scrapeKoboBook>>>>[],
      7000,
    );
    return koboDetails
      .filter((entry): entry is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof scrapeKoboBook>>>> => entry.status === 'fulfilled' && entry.value !== null)
      .map((entry) => fromKobo(entry.value));
  })();

  const [
    internetArchiveSources,
    openLibrarySources,
    googleBooksSources,
    koboSources,
    goodreadsSources,
  ] = await Promise.all([
    internetArchiveSourcesPromise,
    openLibrarySourcesPromise,
    googleBooksSourcesPromise,
    koboSourcesPromise,
    getGoodreadsSources(title, author),
  ]);

  const results = buildMetadataResults(title, author, {
    goodreadsSources,
    googleBooksSources,
    internetArchiveSources,
    openLibrarySources,
    koboSources,
  });

  return { results };
});
