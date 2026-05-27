import { db } from '../../utils/db';
import { collections, collectionsToBooks, books } from '../../database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  try {
    const result = await db.select({
      id: collections.id,
      name: collections.name,
      description: collections.description,
      cover: collections.cover,
      createdAt: collections.createdAt,
      updatedAt: collections.updatedAt,
    })
    .from(collections)
    .orderBy(collections.name)
    .limit(20);

    // For each playlist, we also want membership and preview covers.
    const collectionsWithPreviews = await Promise.all(result.map(async (col) => {
      const collectionBooks = await db.select({
        id: books.id,
        cover: books.cover,
        title: books.title
      })
      .from(books)
      .innerJoin(collectionsToBooks, eq(books.id, collectionsToBooks.bookId))
      .where(eq(collectionsToBooks.collectionId, col.id))

      return {
        ...col,
        bookIds: collectionBooks.map((book) => book.id),
        bookCount: collectionBooks.length,
        previewBooks: collectionBooks.slice(0, 3),
      };
    }));

    return collectionsWithPreviews;
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch playlists',
    });
  }
});
