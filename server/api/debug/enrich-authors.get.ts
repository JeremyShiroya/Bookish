import { db } from '../../utils/db';
import { authors } from '../../database/schema';
import { isNull, sql } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  try {
    // Fetch authors missing bio or image
    const targets = await db.select()
      .from(authors)
      .where(sql`${authors.bio} IS NULL OR ${authors.image} IS NULL`);

    const results = [];
    
    for (const author of targets) {
      try {
        const wikiName = author.name.replace(/\s+/g, '_');
        const wikiResponse: any = await $fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${wikiName}`);
        
        if (wikiResponse) {
          const updates: any = {};
          if (wikiResponse.extract && !author.bio) updates.bio = wikiResponse.extract;
          if (!author.image) {
            if (wikiResponse.originalimage?.source) updates.image = wikiResponse.originalimage.source;
            else if (wikiResponse.thumbnail?.source) updates.image = wikiResponse.thumbnail.source;
          }

          if (Object.keys(updates).length > 0) {
            await db.update(authors).set(updates).where(sql`${authors.id} = ${author.id}`);
            results.push({ name: author.name, status: 'Updated' });
          } else {
            results.push({ name: author.name, status: 'No changes' });
          }
        }
      } catch (e) {
        results.push({ name: author.name, status: 'Failed: ' + e.message });
      }
      
      // Delay to be nice to Wikipedia API
      await new Promise(r => setTimeout(r, 500));
    }

    return { 
      message: `Enrichment complete. Processed ${targets.length} authors.`,
      details: results 
    };
  } catch (error: any) {
    return { error: error.message };
  }
});
