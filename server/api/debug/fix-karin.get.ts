import { db } from '../../utils/db';
import { authors } from '../../database/schema';
import { eq, like } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const name = 'Karin Slaughter';
  const url = 'https://upload.wikimedia.org/wikipedia/commons/e/e0/Karin_Slaughter_2017.jpg';
  
  try {
    const dbAuthor = await db.query.authors.findFirst({
      where: like(authors.name, 'Karin%')
    });

    if (dbAuthor) {
      await db.update(authors).set({ image: url }).where(eq(authors.id, dbAuthor.id));
      return { status: 'success', name: dbAuthor.name, image: url };
    }
    return { status: 'not found' };
  } catch (e) {
    return { error: e.message };
  }
});
