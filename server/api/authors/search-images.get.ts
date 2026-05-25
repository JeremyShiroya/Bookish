import { defineEventHandler, getQuery, createError } from 'h3';
import { searchGoodreadsAuthorImages } from '../../utils/goodreadsScraper';
import {
  addUniqueImage,
  isUsefulAuthorImageUrl,
  rankAuthorResult,
  searchGoogleImages,
} from '../../utils/imageSearch';

const imageHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

function addImage(target: string[], seen: Set<string>, url?: string | null) {
  addUniqueImage(target, seen, url, isUsefulAuthorImageUrl);
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
  const detailsRes: any = await $fetch(
    `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1000&format=json&origin=*`,
  );
  return Object.values(detailsRes.query?.pages || {})
    .map((page: any) => page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url)
    .filter(Boolean);
}

async function findWikipediaCandidates(name: string) {
  const searchRes: any = await $fetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`${name} writer OR author`)}&format=json&origin=*`,
  );
  return (searchRes.query?.search || []).slice(0, 4).map((item: any) => item.title);
}

async function findDuckDuckGoImages(name: string) {
  try {
    const q = `${name} author portrait`;
    const html = await $fetch<string>(`https://duckduckgo.com/?q=${encodeURIComponent(q)}&iax=images&ia=images`, {
      headers: imageHeaders,
    });
    const vqd = html.match(/vqd=['"]([^'"]+)['"]/)?.[1] || html.match(/vqd=([\d-]+)/)?.[1];
    if (!vqd) return [];
    const data: any = await $fetch(
      `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(q)}&vqd=${encodeURIComponent(vqd)}&f=,,,&p=1`,
      { headers: imageHeaders },
    );
    return (data.results || []).map((item: any) => item.image || item.thumbnail).filter(Boolean);
  } catch {
    return [];
  }
}

async function findOpenLibraryAuthorImages(name: string) {
  try {
    const data: any = await $fetch(`https://openlibrary.org/search/authors.json?q=${encodeURIComponent(name)}&limit=8`);
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

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const name = query.name?.toString();

  if (!name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Author name is required',
    });
  }

  const images: string[] = [];
  const seen = new Set<string>();

  try {
    const [googleImagesResult, goodreadsImagesResult, openLibraryImagesResult] = await Promise.allSettled([
      searchGoogleAuthorImages(name),
      searchGoodreadsAuthorImages(name),
      findOpenLibraryAuthorImages(name),
    ]);

    const googleImages = googleImagesResult.status === 'fulfilled' ? googleImagesResult.value : [];

    googleImages.forEach((item) => {
      addImage(images, seen, item.url);
      addImage(images, seen, item.thumbnail);
    });

    if (goodreadsImagesResult.status === 'fulfilled') {
      goodreadsImagesResult.value.forEach((url) => addImage(images, seen, url));
    }

    if (openLibraryImagesResult.status === 'fulfilled') {
      openLibraryImagesResult.value.forEach((url) => addImage(images, seen, url));
    }

    const wikiTitles = await findWikipediaCandidates(name);

    for (const title of wikiTitles) {
      try {
        const summary: any = await $fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
        addImage(images, seen, summary?.originalimage?.source);
        addImage(images, seen, summary?.thumbnail?.source);
      } catch {}

      try {
        const pageRes: any = await $fetch(
          `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages|images|pageprops&pithumbsize=1000&format=json&origin=*`,
        );
        const page = Object.values(pageRes.query?.pages || {})[0] as any;
        addImage(images, seen, page?.thumbnail?.source);

        const wikiDataId = page?.pageprops?.wikibase_item;
        if (wikiDataId) {
          const entityData: any = await $fetch(`https://www.wikidata.org/wiki/Special:EntityData/${wikiDataId}.json`);
          const entity = entityData.entities?.[wikiDataId];
          const fileName = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
          const urls = await imageInfoForFiles(fileName ? [fileName] : []);
          urls.forEach((url) => addImage(images, seen, url));
        }

        const pageFiles = (page?.images || [])
          .map((item: any) => item.title)
          .filter((title: string) => /(\.jpe?g|\.png|\.webp)$/i.test(title))
          .filter((title: string) => !/logo|icon|cover|book|map|signature/i.test(title));
        const urls = await imageInfoForFiles(pageFiles);
        urls.forEach((url) => addImage(images, seen, url));
      } catch {}
    }

    try {
      const commonsRes: any = await $fetch(
        `https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&srsearch=${encodeURIComponent(`"${name}" portrait author writer`)}&format=json&origin=*`,
      );
      const files = (commonsRes.query?.search || []).slice(0, 18).map((item: any) => item.title);
      const urls = await imageInfoForFiles(files);
      urls.forEach((url) => addImage(images, seen, url));
    } catch {}

    const duckImages = await findDuckDuckGoImages(name);
    duckImages.forEach((url) => addImage(images, seen, url));

    return { images: images.slice(0, 24) };
  } catch (error: any) {
    console.error('Search author images failed:', error);
    return { images: [] };
  }
});
