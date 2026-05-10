import { db } from '../../utils/db';
import { authors } from '../../database/schema';
import { eq, like } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const targetNames = ['Karin Slaughter', 'Robert C. Martin', 'Jon Yablonski'];
  const results = [];

  for (const name of targetNames) {
    try {
      // Find in DB (fuzzy match for Robert C. Mart)
      const searchName = name === 'Robert C. Martin' ? 'Robert C. Mart%' : name;
      const dbAuthor = await db.query.authors.findFirst({
        where: like(authors.name, searchName)
      });

      if (!dbAuthor) {
        results.push({ name, status: 'Not found in DB' });
        continue;
      }

      // Search Wikipedia for the best match
      const searchRes: any = await $fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name)}&format=json&origin=*`);
      const bestMatch = searchRes.query?.search?.[0]?.title;

      if (!bestMatch) {
        results.push({ name, status: 'No Wikipedia match found' });
        continue;
      }

      const wikiName = bestMatch.replace(/\s+/g, '_');
      const wikiResponse: any = await $fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${wikiName}`);
      
      if (wikiResponse) {
        let image = wikiResponse.originalimage?.source || wikiResponse.thumbnail?.source || null;
        
        // Hard fallback for Karin Slaughter if Wikipedia API is being flaky
        if (dbAuthor.name.includes('Karin Slaughter') && !image) {
          image = 'https://upload.wikimedia.org/wikipedia/commons/e/ea/Karin_Slaughter_2022.jpg';
        }

        const updates = {
          bio: wikiResponse.extract,
          image: image
        };

        await db.update(authors).set(updates).where(eq(authors.id, dbAuthor.id));
        results.push({ name: dbAuthor.name, status: 'Updated', match: bestMatch, image: updates.image });
      }
    } catch (e) {
      results.push({ name, status: 'Failed: ' + e.message });
    }
  }

  return { results };
});
