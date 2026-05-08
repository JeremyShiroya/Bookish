import { db } from '../../utils/db';
import { books, authors, genres, booksToGenres } from '../../database/schema';
import { desc, eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  try {
    // Using relational queries for a cleaner object structure
    const result = await db.query.books.findMany({
      columns: {
        content: false,
      },
      with: {
        author: true,
        genres: {
          with: {
            genre: true
          }
        }
      },
      orderBy: [desc(books.createdAt)],
      limit: 50,
    });

    // Flatten the genres for easier frontend consumption
    return result.map(book => ({
      ...book,
      author: book.author?.name || 'Unknown Author',
      authorImage: book.author?.image || null,
      genres: book.genres.map(bg => bg.genre.name)
    }));
  } catch (error) {
    console.error('Fetch books error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch books with relations',
    });
  }
});
