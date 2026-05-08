import { db } from '../../utils/db';
import { books } from '../../database/schema';
import { eq, or, isNull } from 'drizzle-orm';

export default defineEventHandler(async () => {
  try {
    // Fetch all books that have content but pages = 0 or null
    const booksToUpdate = await db.query.books.findMany({
      columns: {
        id: true,
        content: true,
        pages: true,
      },
    });

    let updated = 0;

    for (const book of booksToUpdate) {
      if (book.content && (!book.pages || book.pages === 0)) {
        // Strip HTML tags and estimate pages from character count (~1500 chars per page)
        const textOnly = book.content.replace(/<[^>]+>/g, '');
        const estimatedPages = Math.max(1, Math.round(textOnly.length / 1500));

        await db.update(books)
          .set({ pages: estimatedPages })
          .where(eq(books.id, book.id));

        updated++;
      }
    }

    return { success: true, updated, message: `Backfilled page counts for ${updated} books.` };
  } catch (error: any) {
    console.error('Backfill pages error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to backfill page counts',
    });
  }
});
