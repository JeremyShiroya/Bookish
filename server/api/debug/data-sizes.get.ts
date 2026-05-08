import { db } from '../../utils/db';
import { books } from '../../database/schema';
import { sql } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  try {
    // We'll use raw SQL or length() function to avoid loading the actual content over the wire
    const result = await db.select({
      id: books.id,
      title: books.title,
      coverLength: sql<number>`length(${books.cover})`,
      contentLength: sql<number>`length(${books.content})`,
    })
    .from(books);

    // Sort by largest content/cover first
    const sortedResult = [...result].sort((a, b) => 
      ((b.contentLength || 0) + (b.coverLength || 0)) - ((a.contentLength || 0) + (a.coverLength || 0))
    );

    const summary = {
      totalBooks: result.length,
      largestContent: Math.max(...result.map(b => b.contentLength || 0)),
      largestCover: Math.max(...result.map(b => b.coverLength || 0)),
      totalContentSize: result.reduce((acc, b) => acc + (b.contentLength || 0), 0),
      totalCoverSize: result.reduce((acc, b) => acc + (b.coverLength || 0), 0),
      books: sortedResult
    };

    return summary;
  } catch (error: any) {
    console.error('Debug endpoint error:', error);
    return { error: error.message };
  }
});
