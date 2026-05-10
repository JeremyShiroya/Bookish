import { db } from '../../utils/db';
import { collections, collectionsToBooks, books } from '../../database/schema';
import { eq, sql } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  try {
    const result = await db.select({
      id: collections.id,
      name: collections.name,
      description: collections.description,
      cover: collections.cover,
      bookCount: sql<number>`count(${collectionsToBooks.bookId})::int`,
    })
    .from(collections)
    .innerJoin(collectionsToBooks, eq(collections.id, collectionsToBooks.collectionId))
    .groupBy(collections.id)
    .orderBy(collections.name)
    .limit(20);

    // For each collection, we also want the preview covers (up to 3)
    const collectionsWithPreviews = await Promise.all(result.map(async (col) => {
      const previewBooks = await db.select({
        cover: books.cover,
        title: books.title
      })
      .from(books)
      .innerJoin(collectionsToBooks, eq(books.id, collectionsToBooks.bookId))
      .where(eq(collectionsToBooks.collectionId, col.id))
      .limit(3);

      return {
        ...col,
        previewBooks
      };
    }));

    return collectionsWithPreviews;
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch collections',
    });
  }
});
