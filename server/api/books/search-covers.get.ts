import { defineEventHandler, getQuery, createError } from 'h3';
import { searchGoodreads, scrapeGoodreadsBook, normalizeGoodreadsImage } from '../../utils/goodreadsScraper';
import { searchGoogleBooks } from '../../utils/googleBooksApi';
import { searchOpenLibrary } from '../../utils/openLibraryApi';
import { searchKobo, scrapeKoboBook } from '../../utils/koboScraper';
import { addUniqueImage, isUsefulCoverUrl, rankCoverResult, searchGoogleImages } from '../../utils/imageSearch';

function addCover(target: string[], seen: Set<string>, url?: string | null) {
  addUniqueImage(target, seen, normalizeGoodreadsImage(url) || url, isUsefulCoverUrl);
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

async function searchGoogleCoverImages(title: string, author?: string) {
  const queries = buildCoverQueries(title, author).slice(0, author ? 6 : 4);
  const results = await Promise.allSettled(
    queries.map((query) => searchGoogleImages(query, { num: 10 })),
  );
  return results
    .flatMap((result) => result.status === 'fulfilled' ? result.value : [])
    .sort((a, b) => rankCoverResult(b, title, author) - rankCoverResult(a, title, author));
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const title = query.title?.toString();
  const author = query.author?.toString();

  if (!title) {
    throw createError({ statusCode: 400, statusMessage: 'Title is required for cover search' });
  }

  const [goodreadsResult, gbResult, olResult, koboResult, googleImageResult] = await Promise.allSettled([
    searchGoodreads(title, author),
    searchGoogleBooks(title, author),
    searchOpenLibrary(title, author),
    searchKobo(title, author),
    searchGoogleCoverImages(title, author),
  ]);

  const goodreads = goodreadsResult.status === 'fulfilled' ? goodreadsResult.value : [];
  const google = gbResult.status === 'fulfilled' ? gbResult.value : [];
  const openLibrary = olResult.status === 'fulfilled' ? olResult.value : [];
  const koboUrls = koboResult.status === 'fulfilled' ? koboResult.value : [];
  const googleImages = googleImageResult.status === 'fulfilled' ? googleImageResult.value : [];

  const [goodreadsDetails, koboDetails] = await Promise.allSettled([
    Promise.allSettled(goodreads.slice(0, 8).map((item) => scrapeGoodreadsBook(item.url, item))),
    Promise.allSettled(koboUrls.slice(0, 5).map((url) => scrapeKoboBook(url))),
  ]);

  const images: string[] = [];
  const seen = new Set<string>();

  goodreads.forEach((item) => addCover(images, seen, item.cover));
  if (goodreadsDetails.status === 'fulfilled') {
    goodreadsDetails.value.forEach((entry) => {
      if (entry.status === 'fulfilled') addCover(images, seen, entry.value?.cover);
    });
  }

  if (koboDetails.status === 'fulfilled') {
    koboDetails.value.forEach((entry) => {
      if (entry.status === 'fulfilled') addCover(images, seen, entry.value?.cover);
    });
  }

  googleImages.forEach((item) => {
    addCover(images, seen, item.url);
    addCover(images, seen, item.thumbnail);
  });

  google.forEach((item) => addCover(images, seen, item.cover));
  openLibrary.forEach((item) => addCover(images, seen, item.cover));

  return { images: images.slice(0, 24) };
});
