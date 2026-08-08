import { defineEventHandler, getQuery, createError } from 'h3';
import { searchKobo, scrapeKoboBook } from '../../utils/koboScraper';
import { searchGoogleBooks, type GBResult } from '../../utils/googleBooksApi';
import { searchInternetArchive, type IAResult } from '../../utils/internetArchiveApi';
import { searchGoodreads, scrapeGoodreadsBook, type GoodreadsBookDetails, type GoodreadsSearchResult } from '../../utils/goodreadsScraper';
import { searchOpenLibrary, type OLResult } from '../../utils/openLibraryApi';
import { searchHardcover } from '../../utils/hardcoverApi';
import { searchWikidata } from '../../utils/wikidataApi';
import { searchOpenAlex } from '../../utils/openAlexApi';
import { searchLibraryOfCongress } from '../../utils/libraryOfCongressApi';
import { buildMetadataResults, evaluateResultsConfidence, type MetadataSource } from '../../utils/metadataAggregator';
import { searchKnownPublisherSites, searchPublisherMetadata, type PublisherMetadataResult } from '../../utils/publisherMetadata';
import { verifyBookMetadataResults } from '../../utils/aiMetadataVerifier';
import { metadataCacheKey, withMetadataCache } from '../../utils/canonicalMetadataCache';

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
    seriesTotal: firstValue(details?.seriesTotal, searchResult.seriesTotal),
    genre: details?.genre ?? null,
    publishYear: details?.publishYear ?? null,
    publisher: (details as unknown as { publisher?: string | null })?.publisher ?? null,
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
    seriesTotal: result.seriesTotal,
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
    seriesTotal: result.seriesTotal,
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
    seriesTotal: result.seriesTotal,
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
    seriesTotal: result.seriesTotal,
    genre: result.genre,
    publishYear: result.publishYear,
    publisher: (result as unknown as { publisher?: string | null }).publisher ?? null,
  };
}

function fromPublisher(result: PublisherMetadataResult): MetadataSource {
  return {
    id: result.id,
    source: 'publisher',
    title: result.title,
    author: result.author,
    cover: result.cover,
    blurb: result.blurb,
    series: null,
    seriesInstallment: null,
    seriesTotal: null,
    genre: null,
    publishYear: null,
    publisher: result.publisher,
    searchedPublisher: result.searchedPublisher,
    publisherSite: result.publisherSite,
  };
}

function uniquePublishers(sources: MetadataSource[]) {
  const seen = new Set<string>();
  const publishers: string[] = [];

  for (const source of sources) {
    const publisher = source.publisher?.trim();
    if (!publisher) continue;
    const key = publisher.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    publishers.push(publisher);
  }

  return publishers.slice(0, 4);
}

type MetadataProgress = {
  id: 'core' | 'publisherName' | 'publisherSearch' | 'publisherScrape' | 'merge';
  status: 'active' | 'success' | 'error' | 'skipped';
  detail?: string;
};

type ProgressReporter = (event: MetadataProgress) => void;

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

async function getMetadataResults(
  title: string,
  author: string | undefined,
  requestedPublisher: string | undefined,
  isbn: string | undefined,
  onProgress?: ProgressReporter,
) {
  // Tier 1: Fast & Free APIs (Google Books, Open Library, Hardcover)
  onProgress?.({ id: 'core', status: 'active', detail: 'Searching Tier 1 providers (Hardcover, Google Books, Open Library)' });

  const hardcoverSourcesPromise = withTimeout('Hardcover', searchHardcover(title, author), [] as MetadataSource[], 5000);
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

  const [hardcoverSources, openLibrarySources, googleBooksSources] = await Promise.all([
    hardcoverSourcesPromise,
    openLibrarySourcesPromise,
    googleBooksSourcesPromise,
  ]);

  let intermediateResults = buildMetadataResults(title, author, {
    hardcoverSources,
    googleBooksSources,
    openLibrarySources,
  });
  let confidence = evaluateResultsConfidence(intermediateResults);

  let wikidataSources: MetadataSource[] = [];
  let openAlexSources: MetadataSource[] = [];
  let libraryOfCongressSources: MetadataSource[] = [];
  let internetArchiveSources: MetadataSource[] = [];

  // Tier 2: Bibliographic Authorities (if Tier 1 confidence is below 85 or results incomplete)
  if (confidence < 85 || !intermediateResults.length) {
    onProgress?.({ id: 'core', status: 'active', detail: 'Consulting Tier 2 bibliographic authorities (Wikidata, LOC, OpenAlex, IA)' });
    const wikidataPromise = withTimeout('Wikidata', searchWikidata(title, author), [] as MetadataSource[], 5000);
    const openAlexPromise = withTimeout('OpenAlex', searchOpenAlex(title, author), [] as MetadataSource[], 5000);
    const locPromise = withTimeout('Library of Congress', searchLibraryOfCongress(title, author), [] as MetadataSource[], 5000);
    const iaPromise = withTimeout('Internet Archive', searchInternetArchive(title, author), [] as IAResult[], 9000).then((results) => results.map(fromInternetArchive));

    [wikidataSources, openAlexSources, libraryOfCongressSources, internetArchiveSources] = await Promise.all([
      wikidataPromise,
      openAlexPromise,
      locPromise,
      iaPromise,
    ]);

    intermediateResults = buildMetadataResults(title, author, {
      hardcoverSources,
      googleBooksSources,
      openLibrarySources,
      wikidataSources,
      openAlexSources,
      libraryOfCongressSources,
      internetArchiveSources,
    });
    confidence = evaluateResultsConfidence(intermediateResults);
  }

  let koboSources: MetadataSource[] = [];
  let goodreadsSources: MetadataSource[] = [];
  let publisherSources: MetadataSource[] = [];

  // Tier 3: Heavy Scrapers & Publisher Research (if confidence below 80 or requested)
  if (confidence < 80 || requestedPublisher || !intermediateResults.length) {
    onProgress?.({ id: 'core', status: 'active', detail: 'Escalating to Tier 3 scrapers (Goodreads, Kobo, Publisher sites)' });
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

    [koboSources, goodreadsSources] = await Promise.all([
      koboSourcesPromise,
      getGoodreadsSources(title, author),
    ]);
  }

  const publisherCandidates = uniquePublishers([
    ...(requestedPublisher ? [{
      id: `requested-publisher:${requestedPublisher}`,
      source: 'publisher' as const,
      title,
      author: author || null,
      cover: null,
      blurb: null,
      series: null,
      seriesInstallment: null,
      seriesTotal: null,
      genre: null,
      publishYear: null,
      publisher: requestedPublisher,
    }] : []),
    ...hardcoverSources,
    ...googleBooksSources,
    ...openLibrarySources,
    ...wikidataSources,
    ...goodreadsSources,
  ]);

  if (publisherCandidates.length && confidence < 80) {
    onProgress?.({ id: 'publisherSearch', status: 'active', detail: 'Finding official publisher book pages' });
    publisherSources = await withTimeout(
      'Publisher site',
      searchPublisherMetadata(title, author, publisherCandidates),
      [] as PublisherMetadataResult[],
      12000,
    ).then((results) => results.map(fromPublisher));
  }

  onProgress?.({ id: 'merge', status: 'active', detail: 'Combining and verifying metadata options' });
  const finalResults = buildMetadataResults(title, author, {
    goodreadsSources,
    googleBooksSources,
    internetArchiveSources,
    openLibrarySources,
    koboSources,
    publisherSources,
    hardcoverSources,
    wikidataSources,
    openAlexSources,
    libraryOfCongressSources,
  });

  const verifiedResults = await verifyBookMetadataResults(title, author, finalResults);
  return verifiedResults;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const title = query.title?.toString().trim();
  const author = query.author?.toString().trim();
  const requestedPublisher = query.publisher?.toString().trim();
  const isbn = query.isbn?.toString().trim();

  if (!title && !isbn) {
    throw createError({ statusCode: 400, statusMessage: 'Title or ISBN is required for metadata search' });
  }

  const searchTitle = title || isbn || '';
  const cacheKey = metadataCacheKey(searchTitle, author, isbn);

  if (query.stream?.toString() === '1') {
    const res = event.node.res;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');

    const send = (payload: unknown) => {
      res.write(`${JSON.stringify(payload)}\n`);
    };

    try {
      const { value: results } = await withMetadataCache(
        cacheKey,
        (res) => !res || !res.length,
        () => getMetadataResults(searchTitle, author, requestedPublisher, isbn, (progress) => {
          send({ type: 'step', ...progress });
        }),
      );
      send({ type: 'result', results });
    } catch (error) {
      console.error('Streaming metadata lookup failed:', error);
      const reason = error instanceof Error ? error.message : String(error);
      send({
        type: 'error',
        message: reason ? `Metadata lookup failed: ${reason}` : 'Failed to fetch metadata from the web.',
      });
    } finally {
      res.end();
    }
    return;
  }

  const { value: results } = await withMetadataCache(
    cacheKey,
    (res) => !res || !res.length,
    () => getMetadataResults(searchTitle, author, requestedPublisher, isbn),
  );
  return { results };
});
