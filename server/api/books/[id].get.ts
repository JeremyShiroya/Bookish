import { db } from '../../utils/db';
import { books } from '../../database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id');

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Book ID is required',
      });
    }

    const result = await db.query.books.findFirst({
      where: eq(books.id, parseInt(id)),
      with: {
        author: true,
        genres: {
          with: {
            genre: true,
          },
        },
      },
    });

    if (!result) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Book not found',
      });
    }

    return {
      ...result,
      author: result.author?.name || 'Unknown Author',
      authorImage: result.author?.image || null,
      genres: result.genres.map((bg) => bg.genre.name),
    };
  } catch (error: any) {
    console.error('Fetch single book error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to fetch book',
    });
  }
});
