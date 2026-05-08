import { db } from '../../utils/db';
import { books, authors, genres, booksToGenres } from '../../database/schema';
import { eq, inArray } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    
    // Basic validation
    if (!body.title || !body.author) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Title and Author are required',
      });
    }

    // 1. Resolve or Create Author
    let authorId: number;
    let authorName: string = body.author;
    const existingAuthor = await db.query.authors.findFirst({
      where: eq(authors.name, body.author)
    });

    if (existingAuthor) {
      authorId = existingAuthor.id;
    } else {
      const newAuthor = await db.insert(authors).values({
        name: body.author,
        image: body.authorImage || null,
      }).returning();
      authorId = newAuthor[0].id;
    }

    // 2. Insert Book
    const newBookRecords = await db.insert(books).values({
      title: body.title,
      authorId: authorId,
      cover: body.cover,
      series: body.series,
      progress: body.progress || 0,
      rating: body.rating || 0,
      format: body.format,
      pages: body.pages || 0,
      status: body.status || 'Unread',
      isFavourite: body.isFavourite || false,
      content: body.content || null,
      blurb: body.blurb || null,
      publishYear: body.publishYear || null,
      seriesInstallment: body.seriesInstallment || null,
      webReview: body.webReview || null,
    }).returning();
    
    const newBook = newBookRecords[0];

    // 3. Handle Genres (Many-to-Many)
    const genreNames = body.genres || [];
    if (genreNames.length > 0) {
      for (const genreName of genreNames) {
        // Find or create genre
        let genreId: number;
        const existingGenre = await db.query.genres.findFirst({
          where: eq(genres.name, genreName)
        });

        if (existingGenre) {
          genreId = existingGenre.id;
        } else {
          const insertedGenre = await db.insert(genres).values({ name: genreName }).returning();
          genreId = insertedGenre[0].id;
        }

        // Link book and genre
        await db.insert(booksToGenres).values({
          bookId: newBook.id,
          genreId: genreId
        });
      }
    }

    // Return the "Flattened" object consistent with GET /api/books structure
    return {
      ...newBook,
      author: authorName,
      genres: genreNames,
      authorImage: body.authorImage || null
    };

  } catch (error: any) {
    console.error('Create book error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to create book',
    });
  }
});
