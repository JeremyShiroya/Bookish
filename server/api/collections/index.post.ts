import { readBody, createError } from 'h3';
import { db } from '../../utils/db';
import { collections } from '../../database/schema';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const name = String(body?.name || '').trim();

    if (!name) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Playlist name is required',
      });
    }

    const [created] = await db.insert(collections).values({
      name,
      description: body?.description || null,
      cover: body?.cover || null,
      updatedAt: new Date(),
    }).returning();

    return {
      ...created,
      bookIds: [],
      bookCount: 0,
      previewBooks: [],
    };
  } catch (error) {
    if ((error as any)?.statusCode) throw error;
    console.error('Create playlist error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create playlist',
    });
  }
});
