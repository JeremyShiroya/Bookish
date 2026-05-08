import { db } from '../../utils/db';
import { books, authors } from '../../database/schema';
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
      publishYear: body.publishYear,
      seriesInstallment: body.seriesInstallment,
      webReview: body.webReview,
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

    return updatedBook[0];
  } catch (error: any) {
    console.error('Update book error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to update book',
    });
  }
});
