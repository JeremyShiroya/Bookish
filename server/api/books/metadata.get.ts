import { defineEventHandler, getQuery, createError } from 'h3';
import { searchKobo, scrapeKoboBook } from '../../utils/koboScraper';
import { searchGoogleBooks, type GBResult } from '../../utils/googleBooksApi';
import { searchInternetArchive, type IAResult } from '../../utils/internetArchiveApi';
import { searchGoodreads, scrapeGoodreadsBook, type GoodreadsBookDetails, type GoodreadsSearchResult } from '../../utils/goodreadsScraper';
import { searchOpenLibrary, type OLResult } from '../../utils/openLibraryApi';
import { buildMetadataResults, type MetadataSource } from '../../utils/metadataAggregator';
import { searchKnownPublisherSites, searchPublisherMetadata, type PublisherMetadataResult } from '../../utils/publisherMetadata';
import { verifyBookMetadataResults } from '../../utils/aiMetadataVerifier';

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
  onProgress?: ProgressReporter,
) {
  onProgress?.({ id: 'core', status: 'active', detail: 'Searching Goodreads, Google Books, Kobo, Open Library, and Internet Archive' });
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

  const coreCount = internetArchiveSources.length
    + openLibrarySources.length
    + googleBooksSources.length
    + koboSources.length
    + goodreadsSources.length;
  onProgress?.({
    id: 'core',
    status: coreCount ? 'success' : 'error',
    detail: coreCount ? `Found ${coreCount} source result${coreCount === 1 ? '' : 's'}` : 'No core metadata providers returned results',
  });

  onProgress?.({ id: 'publisherName', status: 'active', detail: 'Reading publisher fields from returned metadata' });
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
    ...googleBooksSources,
    ...openLibrarySources,
    ...internetArchiveSources,
    ...koboSources,
    ...goodreadsSources,
  ]);
  onProgress?.({
    id: 'publisherName',
    status: publisherCandidates.length ? 'success' : 'error',
    detail: publisherCandidates.length
      ? `Trying ${publisherCandidates.join(', ')}`
      : 'No publisher name was found, so no publisher site can be searched',
  });

  let publisherSources: MetadataSource[] = [];
  if (publisherCandidates.length) {
    onProgress?.({ id: 'publisherSearch', status: 'active', detail: 'Finding official publisher book pages' });
    publisherSources = await withTimeout(
      'Publisher site',
      searchPublisherMetadata(title, author, publisherCandidates, {
        onProgress: (event) => {
          onProgress?.({
            id: event.stage,
            status: event.status,
            detail: event.message,
          });
        },
      }),
      [] as PublisherMetadataResult[],
      14000,
    ).then((results) => results.map(fromPublisher));

    if (!publisherSources.length) {
      onProgress?.({
        id: 'publisherSearch',
        status: 'active',
        detail: 'Publisher-name lookup found no book page; researching major publisher sites by title and author',
      });
      publisherSources = await withTimeout(
        'Publisher site research',
        searchKnownPublisherSites(title, author, {
          onProgress: (event) => {
            onProgress?.({
              id: event.stage,
              status: event.status,
              detail: event.message,
            });
          },
        }),
        [] as PublisherMetadataResult[],
        18000,
      ).then((results) => results.map(fromPublisher));
    }

    onProgress?.({
      id: 'publisherSearch',
      status: publisherSources.length ? 'success' : 'error',
      detail: publisherSources.length
        ? 'Found publisher-site metadata'
        : 'No matching publisher book page was found',
    });
    onProgress?.({
      id: 'publisherScrape',
      status: publisherSources.length ? 'success' : 'error',
      detail: publisherSources.length
        ? `Scraped ${publisherSources.length} publisher result${publisherSources.length === 1 ? '' : 's'}`
        : 'Publisher pages could not be scraped or did not match this book',
    });
  } else {
    onProgress?.({
      id: 'publisherName',
      status: 'skipped',
      detail: 'No publisher field was found; researching major publisher sites by title and author',
    });
    onProgress?.({ id: 'publisherSearch', status: 'active', detail: 'Searching major publisher websites directly' });
    publisherSources = await withTimeout(
      'Publisher site research',
      searchKnownPublisherSites(title, author, {
        onProgress: (event) => {
          onProgress?.({
            id: event.stage,
            status: event.status,
            detail: event.message,
          });
        },
      }),
      [] as PublisherMetadataResult[],
      18000,
    ).then((results) => results.map(fromPublisher));

    onProgress?.({
      id: 'publisherSearch',
      status: publisherSources.length ? 'success' : 'error',
      detail: publisherSources.length
        ? 'Found publisher-site metadata by researching title and author'
        : 'No matching publisher book page was found during direct site research',
    });
    onProgress?.({
      id: 'publisherScrape',
      status: publisherSources.length ? 'success' : 'error',
      detail: publisherSources.length
        ? `Scraped ${publisherSources.length} publisher result${publisherSources.length === 1 ? '' : 's'}`
        : 'Publisher pages could not be scraped or did not match this book',
    });
  }

  onProgress?.({ id: 'merge', status: 'active', detail: 'Combining provider and publisher metadata' });
  const results = buildMetadataResults(title, author, {
    goodreadsSources,
    googleBooksSources,
    internetArchiveSources,
    openLibrarySources,
    koboSources,
    publisherSources,
  });

  onProgress?.({
    id: 'merge',
    status: results.length ? 'success' : 'error',
    detail: results.length ? `Prepared ${results.length} metadata option${results.length === 1 ? '' : 's'}` : 'No metadata options could be prepared',
  });

  const verifiedResults = await verifyBookMetadataResults(title, author, results);

  return verifiedResults;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const title = query.title?.toString().trim();
  const author = query.author?.toString().trim();
  const requestedPublisher = query.publisher?.toString().trim();

  if (!title) {
    throw createError({ statusCode: 400, statusMessage: 'Title is required for metadata search' });
  }

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
      const results = await getMetadataResults(title, author, requestedPublisher, (progress) => {
        send({ type: 'step', ...progress });
      });
      send({ type: 'result', results });
    } catch (error) {
      console.error('Streaming metadata lookup failed:', error);
      send({ type: 'error', message: 'Failed to fetch metadata from the web.' });
    } finally {
      res.end();
    }
    return;
  }

  const results = await getMetadataResults(title, author, requestedPublisher);
  return { results };
});
