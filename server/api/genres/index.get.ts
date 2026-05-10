import { db } from '../../utils/db';
import { genres, booksToGenres } from '../../database/schema';
import { sql, eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  try {
    const result = await db.select({
      id: genres.id,
      name: genres.name,
      bookCount: sql<number>`count(${booksToGenres.bookId})::int`,
    })
    .from(genres)
    .innerJoin(booksToGenres, eq(genres.id, booksToGenres.genreId))
    .groupBy(genres.id)
    .orderBy(genres.name);

    return result;
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch genres',
    });
  }
});
