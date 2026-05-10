import { db } from '../../utils/db';
import { authors, books } from '../../database/schema';
import { sql, eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  try {
    // Fetch authors and count their books
    const result = await db.select({
      id: authors.id,
      name: authors.name,
      image: authors.image,
      bio: authors.bio,
      bookCount: sql<number>`count(${books.id})::int`,
    })
    .from(authors)
    .innerJoin(books, eq(authors.id, books.authorId))
    .groupBy(authors.id)
    .orderBy(authors.name);

    return result;
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch authors',
    });
  }
});
