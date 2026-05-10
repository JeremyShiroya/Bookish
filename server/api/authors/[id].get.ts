import { db } from '../../utils/db';
import { authors, books } from '../../database/schema';
import { eq, desc } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id');
    
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Author ID is required',
      });
    }

    const result = await db.query.authors.findFirst({
      where: eq(authors.id, parseInt(id)),
      with: {
        books: {
          orderBy: [desc(books.createdAt)]
        }
      }
    });

    if (!result) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Author not found',
      });
    }

    // Try to fetch bio from Wikipedia if missing in DB (Background process)
    if (!result.bio) {
      // Fire and forget enrichment to keep response fast
      (async () => {
        try {
          const wikiName = result.name.replace(/\s+/g, '_');
          const wikiResponse: any = await $fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${wikiName}`);
          if (wikiResponse) {
            const updates: any = {};
            if (wikiResponse.extract) updates.bio = wikiResponse.extract;
            if (!result.image) {
              if (wikiResponse.originalimage?.source) updates.image = wikiResponse.originalimage.source;
              else if (wikiResponse.thumbnail?.source) updates.image = wikiResponse.thumbnail.source;
            }

            if (Object.keys(updates).length > 0) {
              await db.update(authors).set(updates).where(eq(authors.id, result.id));
            }
          }
        } catch (e) {
          console.warn('Background enrichment failed for', result.name);
        }
      })();
    }

    return {
      ...result,
      books: result.books.map(book => ({
        ...book,
        author: result.name
      }))
    };
  } catch (error: any) {
    console.error('Fetch author detail error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to fetch author details',
    });
  }
});
