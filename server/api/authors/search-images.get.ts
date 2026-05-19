import { defineEventHandler, getQuery, createError } from 'h3';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const name = query.name?.toString();

  if (!name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Author name is required',
    });
  }

  try {
    const allImages: string[] = [];

    // 1. Try Wikipedia Page Images
    try {
      const searchRes: any = await $fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name)}&format=json&origin=*`);
      const bestMatch = searchRes.query?.search?.[0]?.title;

      if (bestMatch) {
        const imagesRes: any = await $fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(bestMatch)}&prop=pageimages|images&pithumbsize=1000&format=json&origin=*`);
        const page = Object.values(imagesRes.query.pages)[0] as any;
        
        if (page.thumbnail?.source) allImages.push(page.thumbnail.source);
        
        if (page.images) {
          const otherTitles = page.images
            .filter((img: any) => !img.title.toLowerCase().includes('.svg') && !img.title.toLowerCase().includes('.png'))
            .slice(0, 10)
            .map((img: any) => img.title);

          if (otherTitles.length > 0) {
            const detailsRes: any = await $fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(otherTitles.join('|'))}&prop=imageinfo&iiprop=url&iiurlwidth=1000&format=json&origin=*`);
            Object.values(detailsRes.query.pages).forEach((p: any) => {
              if (p.imageinfo?.[0]?.thumburl) allImages.push(p.imageinfo[0].thumburl);
            });
          }
        }
      }
    } catch (e: any) {
      if (e?.status !== 404 && e?.statusCode !== 404) {
        console.warn('Wiki image search failed:', e?.message ?? 'network error')
      }
    }

    // 2. Try a general search (DuckDuckGo or similar if possible, but Wikipedia is safest server-side)
    // For "Google-like" results without a key, we can use a more aggressive Wikipedia Search for files directly
    try {
      const fileSearchRes: any = await $fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srnamespace=6&srsearch=${encodeURIComponent(name)}&format=json&origin=*`);
      if (fileSearchRes.query?.search) {
         const fileTitles = fileSearchRes.query.search.slice(0, 10).map((s: any) => s.title);
         if (fileTitles.length > 0) {
           const detailsRes: any = await $fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(fileTitles.join('|'))}&prop=imageinfo&iiprop=url&iiurlwidth=1000&format=json&origin=*`);
           Object.values(detailsRes.query.pages).forEach((p: any) => {
             if (p.imageinfo?.[0]?.thumburl) allImages.push(p.imageinfo[0].thumburl);
           });
         }
      }
    } catch (e: any) {
      if (e?.status !== 404 && e?.statusCode !== 404) {
        console.warn('File search failed:', e?.message ?? 'network error')
      }
    }

    // Deduplicate and filter
    const uniqueImages = [...new Set(allImages)].filter(url => 
      url.match(/\.(jpg|jpeg|png|webp)/i) && 
      !url.toLowerCase().includes('icon') &&
      !url.toLowerCase().includes('logo') &&
      !url.toLowerCase().includes('stub') &&
      !url.toLowerCase().includes('magnify')
    ).slice(0, 12);

    return { images: uniqueImages };
  } catch (error: any) {
    console.error('Search author images failed:', error);
    return { images: [] };
  }
});

