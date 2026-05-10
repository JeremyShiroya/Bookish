import { db } from '../../utils/db';
import { authors } from '../../database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID is required',
    });
  }

  try {
    const result = await db.update(authors)
      .set({
        image: body.image,
        updatedAt: new Date()
      })
      .where(eq(authors.id, parseInt(id)))
      .returning();

    return result[0];
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to update author',
    });
  }
});
