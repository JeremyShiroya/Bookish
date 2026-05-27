import { readBody, getRouterParam, createError } from 'h3';
import { eq } from 'drizzle-orm';
import { db } from '../../../utils/db';
import { collections, collectionsToBooks } from '../../../database/schema';

export default defineEventHandler(async (event) => {
  try {
    const collectionId = Number(getRouterParam(event, 'id'));
    const body = await readBody(event);
    const bookId = Number(body?.bookId);

    if (!Number.isFinite(collectionId) || !Number.isFinite(bookId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Playlist and book IDs are required',
      });
    }

    await db.insert(collectionsToBooks).values({
      collectionId,
      bookId,
    }).onConflictDoNothing();

    await db.update(collections)
      .set({ updatedAt: new Date() })
      .where(eq(collections.id, collectionId));

    return { success: true };
  } catch (error) {
    if ((error as any)?.statusCode) throw error;
    console.error('Add book to playlist error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to add book to playlist',
    });
  }
});
