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

    const deletedBook = await db.delete(books)
      .where(eq(books.id, parseInt(id)))
      .returning();

    if (deletedBook.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Book not found',
      });
    }

    return { message: 'Book deleted successfully' };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to delete book',
    });
  }
});
