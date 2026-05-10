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

    const book = deletedBook[0];
    
    // Cleanup: If this was the last book for the author, delete the author too
    if (book.authorId) {
      const otherBooks = await db.query.books.findFirst({
        where: eq(books.authorId, book.authorId)
      });
      
      if (!otherBooks) {
        // No other books left for this author, clean them up
        const { authors } = await import('../../database/schema');
        await db.delete(authors).where(eq(authors.id, book.authorId));
      }
    }

    return { message: 'Book deleted successfully' };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to delete book',
    });
  }
});
