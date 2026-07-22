import { searchGoodreadsAuthorImages } from './goodreadsScraper';
import {
  addUniqueImage,
  isUsefulAuthorImageUrl,
  rankAuthorResult,
  searchBingImages,
  searchGoogleImages,
} from './imageSearch';

// Core author-photo search shared by the /api/authors/search-images endpoint
// and the on-device search in native builds (plain fetch, no Node APIs).

const imageHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

const jsonHeaders = {
  'User-Agent': 'Pages/1.0 (author image lookup; contact: local-app)',
  'Accept': 'application/json',
};

export type AuthorImageResult = {
  url: string;
  source: string;
  label: string;
};

async function fetchJson(url: string, headers: Record<string, string>) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  return response.json();
}

async function fetchText(url: string, headers: Record<string, string>) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  return response.text();
}

function addImage(
  target: string[],
  sources: Map<string, Omit<AuthorImageResult, 'url'>>,
  seen: Set<string>,
  url: string | null | undefined,
  source: string,
  label: string,
) {
  const before = target.length;
  addUniqueImage(target, seen, url, isUsefulAuthorImageUrl);
  if (target.length > before) {
    sources.set(target[target.length - 1], { source, label });
  }
}

function quoteTerm(value?: string | null) {
  const cleaned = String(value || '').replace(/"/g, '').trim();
  return cleaned ? `"${cleaned}"` : '';
}

function buildAuthorGoogleQueries(name: string) {
  const exact = quoteTerm(name);
  return [
    `${exact} author portrait -book -cover`,
    `${exact} writer photo headshot -book -cover`,
    `${exact} novelist interview photo`,
    `site:penguinrandomhouse.com ${exact} author photo`,
    `site:simonandschuster.com ${exact} author photo`,
    `site:harpercollins.com ${exact} author photo`,
    `site:macmillan.com ${exact} author photo`,
    `site:bloomsbury.com ${exact} author photo`,
    `site:wikipedia.org ${exact} author portrait`,
    `site:goodreads.com/author/show ${exact} author photo`,
  ];
}

async function searchGoogleAuthorImages(name: string) {
  const queries = buildAuthorGoogleQueries(name);
  const results = await Promise.allSettled(
    queries.map((query, index) => searchGoogleImages(query, {
      num: 10,
      imageType: index < 2 ? 'face' : 'photo',
    })),
  );
  return results
    .flatMap((result) => result.status === 'fulfilled' ? result.value : [])
    .sort((a, b) => rankAuthorResult(b, name) - rankAuthorResult(a, name));
}

async function imageInfoForFiles(fileTitles: string[]) {
  if (!fileTitles.length) return [];
  const titles = fileTitles
    .map((title) => title.startsWith('File:') ? title : `File:${title}`)
    .slice(0, 24)
    .join('|');
  const detailsRes: any = await fetchJson(
    `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1000&format=json&origin=*`,
    jsonHeaders,
  );
  return Object.values(detailsRes.query?.pages || {})
    .map((page: any) => page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url)
    .filter(Boolean);
}

async function findWikipediaSummaryImages(name: string) {
  const titles = [
    name,
    `${name} (writer)`,
    `${name} (author)`,
    `${name} (novelist)`,
  ];
  const images: string[] = [];
  const seenTitles = new Set<string>();

  for (const title of titles) {
    const key = title.toLowerCase();
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);

    try {
      const summary: any = await fetchJson(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/\s+/g, '_'))}`,
        jsonHeaders,
      );
      if (summary?.originalimage?.source) images.push(summary.originalimage.source);
      if (summary?.thumbnail?.source) images.push(summary.thumbnail.source);
    } catch {}
  }

  return images.filter(Boolean);
}

async function findWikidataAuthorImages(name: string) {
  try {
    const search: any = await fetchJson(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&format=json&origin=*`,
      jsonHeaders,
    );
    const ids = (search.search || []).slice(0, 5).map((item: any) => item.id).filter(Boolean);
    if (!ids.length) return [];

    const entityData: any = await fetchJson(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(ids.join('|'))}&props=claims&format=json&origin=*`,
      jsonHeaders,
    );
    const fileNames = ids
      .map((id: string) => entityData.entities?.[id]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value)
      .filter(Boolean);

    return imageInfoForFiles(fileNames);
  } catch {
    return [];
  }
}

async function findDuckDuckGoImages(name: string) {
  try {
    const q = `${name} author portrait`;
    const html = await fetchText(`https://duckduckgo.com/?q=${encodeURIComponent(q)}&iax=images&ia=images`, imageHeaders);
    const vqd = html.match(/vqd=['"]([^'"]+)['"]/)?.[1] || html.match(/vqd=([\d-]+)/)?.[1];
    if (!vqd) return [];
    const data: any = await fetchJson(
      `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(q)}&vqd=${encodeURIComponent(vqd)}&f=,,,&p=1`,
      imageHeaders,
    );
    return (data.results || []).map((item: any) => item.image || item.thumbnail).filter(Boolean);
  } catch {
    return [];
  }
}

async function findOpenLibraryAuthorImages(name: string) {
  try {
    const data: any = await fetchJson(
      `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(name)}&limit=8`,
      jsonHeaders,
    );
    const docs = data.docs || [];
    const images: string[] = [];
    for (const doc of docs) {
      const photos = Array.isArray(doc.photos) ? doc.photos : [];
      photos.slice(0, 3).forEach((photo: number | string) => {
        images.push(`https://covers.openlibrary.org/a/id/${photo}-L.jpg`);
      });
      if (photos.length && doc.key) {
        images.push(`https://covers.openlibrary.org/a/olid/${String(doc.key).replace('/authors/', '')}-L.jpg`);
      }
    }
    return images;
  } catch {
    return [];
  }
}

export async function searchAuthorImagesWeb(name: string) {
  const images: string[] = [];
  const imageSources = new Map<string, Omit<AuthorImageResult, 'url'>>();
  const seen = new Set<string>();

  try {
    const [wikiSummaryResult, wikidataResult, openLibraryImagesResult, goodreadsImagesResult, googleImagesResult, bingImagesResult] = await Promise.allSettled([
      findWikipediaSummaryImages(name),
      findWikidataAuthorImages(name),
      findOpenLibraryAuthorImages(name),
      searchGoodreadsAuthorImages(name),
      searchGoogleAuthorImages(name),
      searchBingImages(`"${name}" author portrait writer photo`, 20),
    ]);

    if (wikiSummaryResult.status === 'fulfilled') {
      wikiSummaryResult.value.forEach((url) => addImage(images, imageSources, seen, url, 'wikipedia', 'Wikipedia'));
    }

    if (wikidataResult.status === 'fulfilled') {
      wikidataResult.value.forEach((url) => addImage(images, imageSources, seen, url, 'wikidata', 'Wikidata'));
    }

    if (openLibraryImagesResult.status === 'fulfilled') {
      openLibraryImagesResult.value.forEach((url) => addImage(images, imageSources, seen, url, 'openLibrary', 'Open Library'));
    }

    if (goodreadsImagesResult.status === 'fulfilled') {
      goodreadsImagesResult.value.forEach((url) => addImage(images, imageSources, seen, url, 'goodreads', 'Goodreads'));
    }

    const googleImages = googleImagesResult.status === 'fulfilled' ? googleImagesResult.value : [];

    googleImages.forEach((item) => {
      addImage(images, imageSources, seen, item.url, 'google', 'Google Images');
      addImage(images, imageSources, seen, item.thumbnail, 'google', 'Google Images');
    });

    if (bingImagesResult.status === 'fulfilled') {
      bingImagesResult.value.forEach((url) => (
        addImage(images, imageSources, seen, url, 'bing', 'Bing Images')
      ));
    }

    try {
      const commonsRes: any = await fetchJson(
        `https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&srsearch=${encodeURIComponent(`"${name}" portrait author writer`)}&format=json&origin=*`,
        jsonHeaders,
      );
      const files = (commonsRes.query?.search || []).slice(0, 18).map((item: any) => item.title);
      const urls = await imageInfoForFiles(files);
      urls.forEach((url) => addImage(images, imageSources, seen, url, 'wikimedia', 'Wikimedia Commons'));
    } catch {}

    const duckImages = await findDuckDuckGoImages(name);
    duckImages.forEach((url) => addImage(images, imageSources, seen, url, 'duckDuckGo', 'DuckDuckGo Images'));

    return {
      images: images.slice(0, 36).map((url) => ({
        url,
        ...(imageSources.get(url) || { source: 'web', label: 'Web image' }),
      })),
    };
  } catch (error: any) {
    console.error('Search author images failed:', error);
    return { images: [] };
  }
}
