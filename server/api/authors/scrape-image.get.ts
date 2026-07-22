import { defineEventHandler, getQuery, createError } from 'h3';

const headers = {
  'User-Agent': 'Pages/1.0 (author image lookup; contact: local-app)',
  'Accept': 'application/json',
};

async function imageInfoForFile(fileName: string) {
  const data: any = await $fetch(
    `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(`File:${fileName}`)}&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1000&format=json&origin=*`,
    { headers },
  );
  return Object.values(data.query?.pages || {})
    .map((page: any) => page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url)
    .find(Boolean) || null;
}

async function findWikipediaImage(name: string) {
  const titles = [name, `${name} (writer)`, `${name} (author)`, `${name} (novelist)`];
  for (const title of titles) {
    try {
      const summary: any = await $fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/\s+/g, '_'))}`,
        { headers },
      );
      const image = summary?.originalimage?.source || summary?.thumbnail?.source || null;
      if (image) return image;
    } catch {}
  }
  return null;
}

async function findWikidataImage(name: string) {
  try {
    const search: any = await $fetch(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&format=json&origin=*`,
      { headers },
    );
    const ids = (search.search || []).slice(0, 5).map((item: any) => item.id).filter(Boolean);
    if (!ids.length) return null;

    const entityData: any = await $fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(ids.join('|'))}&props=claims&format=json&origin=*`,
      { headers },
    );
    for (const id of ids) {
      const fileName = entityData.entities?.[id]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (!fileName) continue;
      const image = await imageInfoForFile(fileName);
      if (image) return image;
    }
  } catch {}
  return null;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const name = query.name?.toString().trim();

  if (!name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Author name is required for scraping',
    });
  }

  try {
    const image = await findWikipediaImage(name) || await findWikidataImage(name);
    return { image };
  } catch (error: any) {
    console.error('Scrape author image failed:', error);
    return { image: null };
  }
});
