import { db } from '../../utils/db';
import { books, authors, genres, booksToGenres } from '../../database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id');
    const body = await readBody(event);

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Book ID is required',
      });
    }

    const updateData: any = {
      title: body.title,
      cover: body.cover,
      series: body.series,
      progress: body.progress,
      rating: body.rating,
      format: body.format,
      status: body.status,
      isFavourite: body.isFavourite,
      blurb: body.blurb,
      publishYear: body.publishYear ? parseInt(body.publishYear.toString(), 10) : null,
      seriesInstallment: body.seriesInstallment,
      webReview: body.webReview,
      genre: body.genre,
      updatedAt: new Date(),
    };

    // Handle Author Update if provided
    if (body.author) {
      const existingAuthor = await db.query.authors.findFirst({
        where: eq(authors.name, body.author)
      });

      if (existingAuthor) {
        updateData.authorId = existingAuthor.id;
      } else {
        const newAuthor = await db.insert(authors).values({
          name: body.author,
          image: body.authorImage || null,
        }).returning();
        updateData.authorId = newAuthor[0].id;
      }
    } else if (body.authorId) {
      updateData.authorId = body.authorId;
    }

    const updatedBook = await db.update(books)
      .set(updateData)
      .where(eq(books.id, parseInt(id)))
      .returning();

    if (updatedBook.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Book not found',
      });
    }

    // Handle many-to-many Genres synchronization
    if (body.genre !== undefined) {
      const genreNames = body.genre 
        ? body.genre.split(',').map((g: string) => g.trim()).filter((g: string) => g !== '')
        : [];
      
      // Clear existing links
      await db.delete(booksToGenres).where(eq(booksToGenres.bookId, parseInt(id)));
      
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
            bookId: parseInt(id),
            genreId: genreId
          });
        }
      }
    }

    const updatedBookWithAuthor = await db.query.books.findFirst({
      where: eq(books.id, updatedBook[0].id),
      with: {
        author: true
      }
    });

    return {
      ...updatedBookWithAuthor,
      author: updatedBookWithAuthor?.author?.name || body.author || 'Unknown Author',
      authorImage: updatedBookWithAuthor?.author?.image || null
    };
  } catch (error: any) {
    console.error('Update book error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to update book',
    });
  }
});
