import { defineEventHandler, getQuery, createError } from 'h3';
import { searchGoodreads, scrapeGoodreadsBook } from '../../utils/goodreadsScraper';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const title = query.title?.toString();
  const author = query.author?.toString();

  if (!title) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Title is required for metadata search',
    });
  }

  try {
    // 1. Try Goodreads
    const grResults = await searchGoodreads(title, author);
    
    if (grResults && grResults.length > 0) {
       // We only deeply scrape the top 3 results to keep the request fast
       const topResults = grResults.slice(0, 3);
       
       const enrichedResults = await Promise.all(topResults.map(async (book) => {
          const details = await scrapeGoodreadsBook(book.url);
          if (details) {
             return {
               googleId: book.url, // Using URL as ID
               title: book.title,
               author: book.author,
               blurb: details.blurb,
               publishYear: details.publishYear,
               cover: details.cover || book.cover, // Use high res if available
               series: details.series,
               seriesInstallment: details.seriesInstallment,
               webReview: details.webReview,
               genre: details.genre
             };
          }
          return {
             googleId: book.url,
             title: book.title,
             author: book.author,
             cover: book.cover
          };
       }));
       
       return { results: enrichedResults };
    }
  } catch (err) {
    console.warn("Goodreads scraper failed, falling back to OpenLibrary", err);
  }

  // 2. Fallback to OpenLibrary API
  let url = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=5`;
  if (author) {
    url += `&author=${encodeURIComponent(author)}`;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OpenLibrary API responded with status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.docs || data.docs.length === 0) {
      return { results: [] };
    }

    const results = await Promise.all(data.docs.map(async (doc: any) => {
      let blurb = null;
      let webReview = null;

      try {
        const detailsRes = await fetch(`https://openlibrary.org${doc.key}.json`);
        if (detailsRes.ok) {
          const details = await detailsRes.json();
          if (details.description) {
             blurb = typeof details.description === 'string' 
                ? details.description 
                : details.description.value;
          }
        }
        
        const ratingsRes = await fetch(`https://openlibrary.org${doc.key}/ratings.json`);
        if (ratingsRes.ok) {
          const ratingsData = await ratingsRes.json();
          if (ratingsData.summary && ratingsData.summary.average) {
            webReview = `OpenLibrary Rating: ${ratingsData.summary.average.toFixed(2)}/5 (based on ${ratingsData.summary.count || 0} reviews).`;
          }
        }
      } catch (err) {
         console.warn(`Failed to fetch extra details for ${doc.key}`);
      }

      const coverUrl = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null;
      
      let series = null;
      let seriesInstallment = null;
      if (doc.series_name && doc.series_name.length > 0) {
         series = doc.series_name[0];
      }
      if (doc.series_position && doc.series_position.length > 0) {
         seriesInstallment = doc.series_position[0];
      }

      return {
        googleId: doc.key, 
        title: doc.title,
        author: doc.author_name ? doc.author_name.join(', ') : '',
        blurb: blurb,
        publishYear: doc.first_publish_year || null,
        cover: coverUrl,
        series: series,
        seriesInstallment: seriesInstallment,
        webReview: webReview,
        genre: doc.subject ? doc.subject.slice(0, 3).join(', ') : null
      };
    }));

    return { results };

  } catch (error: any) {
    console.error('Failed to fetch metadata from OpenLibrary:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch book metadata from the web.',
    });
  }
});
