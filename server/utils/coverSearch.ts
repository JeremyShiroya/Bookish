import { searchGoodreads, scrapeGoodreadsBook, normalizeGoodreadsImage } from './goodreadsScraper';
import { searchGoogleBooks } from './googleBooksApi';
import { searchOpenLibrary } from './openLibraryApi';
import { searchKobo, scrapeKoboBook } from './koboScraper';
import { addUniqueImage, isUsefulCoverUrl, rankCoverResult, searchGoogleImages } from './imageSearch';
import { resolvePublisherDomain } from './publisherSites';

// Core cover search shared by the /api/books/search-covers endpoint and the
// on-device search in native builds (plain fetch + cheerio, no Node APIs).

export type CoverImage = {
  url: string;
  source: string;          // machine-readable: goodreads | googleBooks | openLibrary | kobo | googleImages | publisher
  label: string;           // human-readable e.g. "Goodreads", "Web image search · amazon.com"
};

const SOURCE_LABELS: Record<string, string> = {
  goodreads: 'Goodreads',
  googleBooks: 'Google Books',
  openLibrary: 'Open Library',
  internetArchive: 'Internet Archive',
  kobo: 'Kobo',
  googleImages: 'Web image search',
  publisher: "Publisher's site",
};

function hostnameOf(url?: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Adds a candidate cover URL to the running list, tagged with its source.
 * Uses the existing addUniqueImage helper for URL-level deduping (so behaviour
 * matches what the picker has historically seen), and records the source for the
 * first occurrence in a parallel map keyed by the normalised URL.
 */
function addCover(
  urls: string[],
  seen: Set<string>,
  sourceByUrl: Map<string, { source: string; label: string }>,
  url: string | null | undefined,
  source: string,
  contextUrl?: string | null,
) {
  const beforeLen = urls.length;
  addUniqueImage(urls, seen, normalizeGoodreadsImage(url) || url, isUsefulCoverUrl);
  if (urls.length === beforeLen) return; // duplicate / rejected
  const finalUrl = urls[urls.length - 1];
  if (sourceByUrl.has(finalUrl)) return; // first source wins
  const baseLabel = SOURCE_LABELS[source] || source;
  const host = hostnameOf(contextUrl);
  const label = host && (source === 'googleImages' || source === 'publisher')
    ? `${baseLabel} · ${host}`
    : baseLabel;
  sourceByUrl.set(finalUrl, { source, label });
}

function quoteTerm(value?: string | null) {
  const cleaned = String(value || '').replace(/"/g, '').trim();
  return cleaned ? `"${cleaned}"` : '';
}

function buildCoverQueries(title: string, author?: string) {
  const exact = [quoteTerm(title), quoteTerm(author)].filter(Boolean).join(' ');
  const loose = [title, author].filter(Boolean).join(' ');
  return [
    `${exact} book cover`,
    `${exact} cover art edition`,
    `${loose} paperback hardcover cover`,
    `site:goodreads.com/book/show ${exact} cover`,
    `site:amazon.com ${exact} book cover`,
    `site:penguinrandomhouse.com ${exact} book cover`,
  ].filter((query, index, queries) => query.trim() && queries.indexOf(query) === index);
}

function buildPublisherQueries(title: string, author: string | undefined, publisher: string) {
  const exact = [quoteTerm(title), quoteTerm(author)].filter(Boolean).join(' ');
  const domain = resolvePublisherDomain(publisher);
  const queries: string[] = [];
  if (domain) {
    queries.push(`site:${domain} ${exact} cover`);
    queries.push(`site:${domain} ${exact}`);
  }
  queries.push(`${quoteTerm(publisher)} ${exact} book cover`);
  return queries.filter((query, index, list) => query.trim() && list.indexOf(query) === index);
}

async function searchGoogleCoverImages(title: string, author?: string) {
  const queries = buildCoverQueries(title, author).slice(0, author ? 6 : 4);
  const results = await Promise.allSettled(
    queries.map((query) => searchGoogleImages(query, { num: 10 })),
  );
  return results
    .flatMap((result) => result.status === 'fulfilled' ? result.value : [])
    .sort((a, b) => rankCoverResult(b, title, author) - rankCoverResult(a, title, author));
}

async function searchPublisherCoverImages(title: string, author: string | undefined, publisher: string) {
  const queries = buildPublisherQueries(title, author, publisher);
  if (!queries.length) return [];
  const results = await Promise.allSettled(
    queries.map((query) => searchGoogleImages(query, { num: 10 })),
  );
  return results
    .flatMap((result) => result.status === 'fulfilled' ? result.value : [])
    .sort((a, b) => rankCoverResult(b, title, author) - rankCoverResult(a, title, author));
}

export async function searchBookCovers(title: string, author?: string, publisher?: string) {
  // The original four working sources — these stay exactly as they were.
  // Publisher-website results are a *separate* augmenting search that runs in
  // parallel and gets appended at the end (when a publisher is provided).
  const [
    goodreadsResult,
    gbResult,
    olResult,
    koboResult,
    googleImageResult,
    publisherImageResult,
  ] = await Promise.allSettled([
    searchGoodreads(title, author),
    searchGoogleBooks(title, author),
    searchOpenLibrary(title, author),
    searchKobo(title, author),
    searchGoogleCoverImages(title, author),
    publisher
      ? searchPublisherCoverImages(title, author, publisher)
      : Promise.resolve([]),
  ]);

  const goodreads = goodreadsResult.status === 'fulfilled' ? goodreadsResult.value : [];
  const google = gbResult.status === 'fulfilled' ? gbResult.value : [];
  const openLibrary = olResult.status === 'fulfilled' ? olResult.value : [];
  const koboUrls = koboResult.status === 'fulfilled' ? koboResult.value : [];
  const googleImages = googleImageResult.status === 'fulfilled' ? googleImageResult.value : [];
  const publisherImages = publisherImageResult.status === 'fulfilled' ? publisherImageResult.value : [];

  const [goodreadsDetails, koboDetails] = await Promise.allSettled([
    Promise.allSettled(goodreads.slice(0, 8).map((item) => scrapeGoodreadsBook(item.url, item))),
    Promise.allSettled(koboUrls.slice(0, 5).map((url) => scrapeKoboBook(url))),
  ]);

  const urls: string[] = [];
  const seen = new Set<string>();
  const sourceByUrl = new Map<string, { source: string; label: string }>();

  goodreads.forEach((item) => addCover(urls, seen, sourceByUrl, item.cover, 'goodreads'));
  if (goodreadsDetails.status === 'fulfilled') {
    goodreadsDetails.value.forEach((entry) => {
      if (entry.status === 'fulfilled') addCover(urls, seen, sourceByUrl, entry.value?.cover, 'goodreads');
    });
  }

  if (koboDetails.status === 'fulfilled') {
    koboDetails.value.forEach((entry) => {
      if (entry.status === 'fulfilled') addCover(urls, seen, sourceByUrl, entry.value?.cover, 'kobo');
    });
  }

  googleImages.forEach((item) => {
    addCover(urls, seen, sourceByUrl, item.url, 'googleImages', item.context);
    addCover(urls, seen, sourceByUrl, item.thumbnail, 'googleImages', item.context);
  });

  google.forEach((item) => addCover(urls, seen, sourceByUrl, item.cover, 'googleBooks'));
  openLibrary.forEach((item) => addCover(urls, seen, sourceByUrl, item.cover, 'openLibrary'));

  // Append publisher-site hi-res covers at the end so they augment rather than
  // displace the established sources.
  publisherImages.forEach((item) => {
    addCover(urls, seen, sourceByUrl, item.url, 'publisher', item.context);
    addCover(urls, seen, sourceByUrl, item.thumbnail, 'publisher', item.context);
  });

  const images: CoverImage[] = urls.slice(0, 24).map((url) => {
    const info = sourceByUrl.get(url) || { source: 'unknown', label: 'Unknown source' };
    return { url, source: info.source, label: info.label };
  });

  return { images };
}
