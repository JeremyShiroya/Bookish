import { defineEventHandler, getQuery, createError } from 'h3';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const name = query.name?.toString();

  if (!name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Author name is required for scraping',
    });
  }

  try {
    // 1. Search Wikipedia for the best match
    const searchRes: any = await $fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name)}&format=json&origin=*`);
    const bestMatch = searchRes.query?.search?.[0]?.title;

    if (!bestMatch) {
       return { image: null };
    }

    const wikiName = bestMatch.replace(/\s+/g, '_');
    const wikiResponse: any = await $fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${wikiName}`);
    
    if (wikiResponse) {
      const image = wikiResponse.originalimage?.source || wikiResponse.thumbnail?.source || null;
      return { image };
    }

    return { image: null };
  } catch (error: any) {
    console.error('Scrape author image failed:', error);
    return { image: null };
  }
});
