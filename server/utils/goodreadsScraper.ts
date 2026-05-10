import * as cheerio from 'cheerio';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

export async function searchGoodreads(title: string, author?: string) {
  try {
    const query = encodeURIComponent(`${title} ${author || ''}`.trim());
    const searchUrl = `https://www.goodreads.com/search?q=${query}`;
    
    const response = await fetch(searchUrl, { headers });
    if (!response.ok) {
       console.error(`Goodreads search failed with status ${response.status}`);
       return [];
    }
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const results: any[] = [];
    
    $('tr[itemtype="http://schema.org/Book"]').slice(0, 5).each((i, el) => {
      const titleEl = $(el).find('a.bookTitle');
      const bookUrl = titleEl.attr('href');
      let bookTitle = titleEl.find('span[itemprop="name"]').text().trim();
      const authorName = $(el).find('a.authorName span[itemprop="name"]').text().trim();
      let coverUrl = $(el).find('img.bookCover').attr('src');
      
      // Cleanup the cover URL to try to get a higher res from search page itself
      if (coverUrl) {
         // e.g. https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/1555447414l/44767458._SY75_.jpg -> _SY475_
         coverUrl = coverUrl.replace(/_[A-Z]{2}\d+_\./, '');
      }

      // Sometimes book title contains series in parenthesis, e.g. "Dune (Dune, #1)"
      // Let's clean the title
      const rawTitle = bookTitle;
      const titleMatch = bookTitle.match(/^(.*?)\s*\(.*?\)$/);
      if (titleMatch) {
         bookTitle = titleMatch[1].trim();
      }

      if (bookUrl) {
         results.push({
           url: bookUrl.startsWith('/') ? `https://www.goodreads.com${bookUrl}` : bookUrl,
           title: bookTitle,
           rawTitle,
           author: authorName,
           cover: coverUrl,
         });
      }
    });
    
    return results;
  } catch (err) {
    console.error('Error searching Goodreads:', err);
    return [];
  }
}

export async function scrapeGoodreadsBook(bookUrl: string) {
  try {
    const response = await fetch(bookUrl, { headers });
    if (!response.ok) return null;
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract Cover (Goodreads uses a ResponsiveImage class for high res now, or a meta tag)
    let cover = $('meta[property="og:image"]').attr('content');
    
    // Extract Blurb (Often in a div with data-testid="description")
    let blurb = $('div[data-testid="description"]').text().trim();
    if (!blurb) {
       blurb = $('#description span').last().text().trim();
    }
    
    // Extract Series
    let series = null;
    let seriesInstallment = null;
    const seriesText = $('h3[aria-label^="Book"] a').text().trim() || $('h2#bookSeries').text().trim() || $('div.infoBoxRowTitle:contains("Series")').next('.infoBoxRowItem').text().trim();
    
    // Cleanup seriesText if it looks like "Dune #1"
    if (seriesText) {
      const match = seriesText.match(/^(.*?)(?:\s+#(\d+(?:\.\d+)?))?$/);
      if (match) {
        series = match[1].trim();
        if (match[2]) seriesInstallment = match[2];
      }
    }
    
    // Extract Rating
    let ratingStr = $('div.RatingStatistics__rating').first().text().trim() || $('span[itemprop="ratingValue"]').first().text().trim();
    let ratingCount = $('span[data-testid="ratingsCount"]').first().text().trim() || $('meta[itemprop="ratingCount"]').first().attr('content');
    
    // cleanup ratingCount string if it has text like "1,234 ratings"
    if (ratingCount) {
        ratingCount = ratingCount.replace(/[^\d,]/g, '').trim();
    }

    let webReview = null;
    if (ratingStr) {
       webReview = `Goodreads Rating: ${ratingStr}/5`;
       if (ratingCount) webReview += ` (based on ${ratingCount} reviews).`;
       else webReview += '.';
    }
    
    // Extract Publish Year
    let publishYear = null;
    const pubDetails = $('p[data-testid="publicationInfo"]').text().trim() || $('div#details').text().trim();
    if (pubDetails) {
       const yearMatch = pubDetails.match(/\b(19|20)\d{2}\b/);
       if (yearMatch) publishYear = parseInt(yearMatch[0], 10);
    }

    // Extract Genres
    const genresList: string[] = [];
    $('div[data-testid="genresList"] a.Button--tag').each((i, el) => {
       const g = $(el).find('span.Button__label').text().trim() || $(el).text().trim();
       if (g && !genresList.includes(g)) genresList.push(g);
    });
    if (genresList.length === 0) {
       $('.bookPageGenreLink').slice(0, 3).each((i, el) => {
          const g = $(el).text().trim();
          if (g && !genresList.includes(g)) genresList.push(g);
       });
    }
    const genre = genresList.slice(0, 3).join(', ');
    
    return {
       blurb,
       cover,
       series,
       seriesInstallment,
       webReview,
       publishYear,
       genre
    };
  } catch (err) {
    console.error('Error scraping book detail:', err);
    return null;
  }
}
