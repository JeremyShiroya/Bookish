import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseGoodreadsBookHtml,
  parseGoodreadsDiscoveryHtml,
  parseGoodreadsProxySearchText,
  parseGoodreadsSearchHtml,
  parseGoodreadsSeriesBooks,
  parseGoodreadsSeriesTotal,
  parseSeriesFromText,
  scrapeGoodreadsBook,
  searchGoodreads,
  splitGoodreadsTitle,
} from './goodreadsScraper';

describe('goodreadsScraper parsing helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts series and installment from title parentheticals', () => {
    expect(splitGoodreadsTitle('Dune (Dune, #1)')).toEqual({
      title: 'Dune',
      rawSeriesTitle: 'Dune, #1',
      series: 'Dune',
      seriesInstallment: '1',
      seriesTotal: null,
    });
  });

  it('extracts series and installment from aria/detail text', () => {
    expect(parseSeriesFromText('Book 2 in the Grant County series')).toEqual({
      series: 'Grant County',
      seriesInstallment: '2',
      seriesTotal: null,
    });
  });

  it('extracts the primary-work count from a Goodreads series page', () => {
    expect(parseGoodreadsSeriesTotal(`
      <html>
        <body>
          <div class="recommendation">12 primary works • 24 total works</div>
          <h1>Grant County Series</h1>
          <div class="responsiveSeriesHeader__subtitle">6 primary works • 9 total works</div>
        </body>
      </html>
    `)).toBe('6');
  });

  it('does not use total works when the primary-work count is absent', () => {
    expect(parseGoodreadsSeriesTotal('<div>9 total works</div>')).toBeNull();
  });

  it('parses modern Goodreads book details with JSON-LD and visible metadata', () => {
    const html = `
      <html>
        <head>
          <meta property="og:image" content="https://images.example/book._SY475_.jpg">
          <script type="application/ld+json">
            {
              "@type": "Book",
              "name": "Sharp Objects",
              "author": { "name": "Gillian Flynn" },
              "description": "A reporter returns home to investigate a disturbing crime.",
              "datePublished": "2006-09-26",
              "genre": ["Mystery", "Thriller"],
              "aggregateRating": { "ratingValue": "4.02", "ratingCount": "123456", "reviewCount": "7890" }
            }
          </script>
        </head>
        <body>
          <a href="/series/116525-will-trent">Will Trent</a>
          <h3 aria-label="Book 1 in the Camille Preaker series"></h3>
          <a href="/series/81050-camille-preaker">Camille Preaker</a>
          <div data-testid="genresList">
            <a class="Button--tag"><span class="Button__labelItem">Mystery</span></a>
            <a class="Button--tag"><span class="Button__labelItem">Crime</span></a>
          </div>
        </body>
      </html>
    `;

    expect(parseGoodreadsBookHtml(html)).toMatchObject({
      title: 'Sharp Objects',
      author: 'Gillian Flynn',
      blurb: 'A reporter returns home to investigate a disturbing crime.',
      cover: 'https://images.example/book.jpg',
      series: 'Camille Preaker',
      seriesInstallment: '1',
      seriesUrl: 'https://www.goodreads.com/series/81050-camille-preaker',
      publishYear: 2006,
      genre: 'Mystery, Thriller, Crime',
      ratingValue: '4.02',
      ratingCount: '123456',
      reviewCount: '7890',
      webReview: 'Goodreads Rating: 4.02/5 (123456 ratings, 7890 reviews).',
    });
  });

  it('falls back to legacy blurb, publication, genre, and rating selectors', () => {
    const html = `
      <html>
        <body>
          <h1>Dune</h1>
          <div id="description"><span>short</span><span>Set on the desert planet Arrakis.</span></div>
          <div id="details">First published June 1st 1965 by Chilton Books</div>
          <span itemprop="ratingValue">4.28</span>
          <meta itemprop="ratingCount" content="987654">
          <meta itemprop="reviewCount" content="45678">
          <a class="bookPageGenreLink">Science Fiction</a>
          <a class="bookPageGenreLink">Classics</a>
        </body>
      </html>
    `;

    expect(parseGoodreadsBookHtml(html, { rawTitle: 'Dune (Dune, #1)' })).toMatchObject({
      blurb: 'Set on the desert planet Arrakis.',
      series: 'Dune',
      seriesInstallment: '1',
      publishYear: 1965,
      genre: 'Science Fiction, Classics',
      webReview: 'Goodreads Rating: 4.28/5 (987654 ratings, 45678 reviews).',
    });
  });

  it('parses search results with cover, author, and raw series title', () => {
    const html = `
      <table>
        <tr itemtype="http://schema.org/Book">
          <td><img class="bookCover" src="https://images.example/dune._SY75_.jpg"></td>
          <td>
            <a class="bookTitle" href="/book/show/44767458-dune"><span itemprop="name">Dune (Dune, #1)</span></a>
            <a class="authorName"><span itemprop="name">Frank Herbert</span></a>
            <span class="minirating">4.28 avg rating - 1,511,111 ratings</span>
          </td>
        </tr>
      </table>
    `;

    expect(parseGoodreadsSearchHtml(html)[0]).toMatchObject({
      url: 'https://www.goodreads.com/book/show/44767458-dune',
      title: 'Dune',
      rawTitle: 'Dune (Dune, #1)',
      author: 'Frank Herbert',
      cover: 'https://images.example/dune.jpg',
      rawSeriesTitle: 'Dune, #1',
      series: 'Dune',
      seriesInstallment: '1',
      ratingValue: '4.28',
      ratingCount: '1,511,111',
      reviewCount: null,
      webReview: 'Goodreads Rating: 4.28/5 (1,511,111 ratings).',
    });
  });

  it('discovers Goodreads book URLs and ratings from search result snippets', () => {
    const html = `
      <div class="result">
        <a class="result__a" href="/l/?uddg=https%3A%2F%2Fwww.goodreads.com%2Fbook%2Fshow%2F3735293-clean-code">Clean Code by Robert C. Martin | Goodreads</a>
        <a class="result__snippet">4.37 avg rating, 23,637 ratings, 1,485 reviews</a>
      </div>
    `;

    expect(parseGoodreadsDiscoveryHtml(html)[0]).toMatchObject({
      url: 'https://www.goodreads.com/book/show/3735293-clean-code',
      title: 'Clean Code',
      author: 'Robert C. Martin',
      ratingValue: '4.37',
      ratingCount: '23,637',
      reviewCount: '1,485',
      webReview: 'Goodreads Rating: 4.37/5 (23,637 ratings, 1,485 reviews).',
    });
  });

  it('parses a matching Goodreads aggregate rating from proxied search text', () => {
    const text = `
      Frank Herbert's Books. Dune (Dune, #1). 4.29 1,674,991 ratings
      86,506 reviews. https://www.goodreads.com/book/show/44767458-dune
    `;

    expect(parseGoodreadsProxySearchText(text, 'Dune', 'Frank Herbert', 'https://www.goodreads.com/book/show/44767458-dune')).toMatchObject({
      url: 'https://www.goodreads.com/book/show/44767458-dune',
      title: 'Dune',
      author: 'Frank Herbert',
      ratingValue: '4.29',
      ratingCount: '1,674,991',
      reviewCount: '86,506',
      webReview: 'Goodreads Rating: 4.29/5 (1,674,991 ratings, 86,506 reviews).',
    });
  });

  it('rejects proxied rating text that does not match the requested author', () => {
    const text = `
      Twilight by Stephenie Meyer. 3.65 7,000,000 ratings 120,000 reviews.
      https://www.goodreads.com/book/show/41865-twilight
    `;

    expect(parseGoodreadsProxySearchText(
      text,
      'Twilight',
      'Richard Dawkins',
      'https://www.goodreads.com/book/show/41865-twilight',
    )).toBeNull();
  });

  it('uses the resolved Goodreads URL with a proxy fallback when Goodreads returns 202', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('https://www.goodreads.com/book/title')) {
        const response = new Response('Please verify you are a human', { status: 202 });
        Object.defineProperty(response, 'url', {
          value: 'https://www.goodreads.com/book/show/44767458-dune',
        });
        return response;
      }
      if (url.startsWith('https://r.jina.ai/http://www.google.com/search?')) {
        return new Response(`
          Frank Herbert's Books. Dune blocked fallback. 4.29 1,674,991 ratings
          86,506 reviews. https://www.goodreads.com/book/show/44767458-dune
        `, { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const results = await searchGoodreads('Dune blocked fallback', 'Frank Herbert');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(results[0]).toMatchObject({
      url: 'https://www.goodreads.com/book/show/44767458-dune',
      ratingValue: '4.29',
      webReview: 'Goodreads Rating: 4.29/5 (1,674,991 ratings, 86,506 reviews).',
    });
  });

  it('falls back to validated Yahoo snippets when the proxy is unavailable', async () => {
    const yahooHtml = `
      <div id="web">
        <div class="dd">
          <h3>Dune Yahoo fallback by Frank Herbert | Goodreads</h3>
          <p>Read 84.4k reviews from the world's largest community for readers.</p>
        </div>
        <div class="dd">
          <h3>Dune Yahoo fallback Book Review</h3>
          <p>Dune Yahoo fallback by Frank Herbert has a rating of approximately 4.29 out of 5
          stars on Goodreads, based on over 1.6 million ratings.</p>
        </div>
      </div>
    `;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('https://www.goodreads.com/book/title')) {
        const response = new Response('blocked', { status: 202 });
        Object.defineProperty(response, 'url', {
          value: 'https://www.goodreads.com/book/show/44767458-dune',
        });
        return response;
      }
      if (url.startsWith('https://r.jina.ai/http://www.google.com/search?')) {
        return new Response('proxy unavailable', { status: 451 });
      }
      if (url.startsWith('https://search.yahoo.com/search?')) {
        return new Response(yahooHtml, { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const results = await searchGoodreads('Dune Yahoo fallback', 'Frank Herbert');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(results[0]).toMatchObject({
      url: 'https://www.goodreads.com/book/show/44767458-dune',
      ratingValue: '4.29',
      ratingCount: '1.6 million',
      reviewCount: '84.4k',
      webReview: 'Goodreads Rating: 4.29/5 (1.6 million ratings, 84.4k reviews).',
    });
  });

  it('coalesces concurrent identical Goodreads searches', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('https://www.goodreads.com/book/title')) {
        const response = new Response('blocked', { status: 202 });
        Object.defineProperty(response, 'url', {
          value: 'https://www.goodreads.com/book/show/999-coalesced-book',
        });
        return response;
      }
      if (url.startsWith('https://r.jina.ai/http://www.google.com/search?')) {
        return new Response(`
          Coalesced Book by Test Author. 4.12 12,345 ratings 678 reviews.
          https://www.goodreads.com/book/show/999-coalesced-book
        `, { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const [first, second] = await Promise.all([
      searchGoodreads('Coalesced Book', 'Test Author'),
      searchGoodreads('Coalesced Book', 'Test Author'),
    ]);

    expect(first).toEqual(second);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('tries the Goodreads title redirect before the blocked search page', async () => {
    const detailHtml = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@type": "Book",
              "name": "Dune",
              "author": { "name": "Frank Herbert" },
              "aggregateRating": { "ratingValue": "4.29", "ratingCount": "1670353", "reviewCount": "86099" }
            }
          </script>
        </head>
      </html>
    `;

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('https://www.goodreads.com/book/title')) {
        const response = new Response(detailHtml, { status: 200 });
        Object.defineProperty(response, 'url', {
          value: 'https://www.goodreads.com/book/show/44767458-dune',
        });
        return response;
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const results = await searchGoodreads('Dune', 'Frank Herbert');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/book/title?id=Dune%20Frank%20Herbert');
    expect(results[0]).toMatchObject({
      url: 'https://www.goodreads.com/book/show/44767458-dune',
      title: 'Dune',
      author: 'Frank Herbert',
      webReview: 'Goodreads Rating: 4.29/5 (1670353 ratings, 86099 reviews).',
    });
  });

  it('enriches book details with the Goodreads primary-work series count', async () => {
    const bookHtml = `
      <html>
        <head>
          <script type="application/ld+json">
            { "@type": "Book", "name": "Blindsighted", "author": { "name": "Karin Slaughter" } }
          </script>
        </head>
        <body>
          <a href="/series/116525-will-trent">Will Trent</a>
          <h3 aria-label="Book 1 in the Grant County series"></h3>
          <a href="/series/43676-grant-county">Grant County</a>
        </body>
      </html>
    `;
    const seriesHtml = '<div class="responsiveSeriesHeader__subtitle">6 primary works • 8 total works</div>';

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === 'https://www.goodreads.com/book/show/1-blindsighted') {
        return new Response(bookHtml, { status: 200 });
      }
      if (url === 'https://www.goodreads.com/series/43676-grant-county') {
        return new Response(seriesHtml, { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const details = await scrapeGoodreadsBook('https://www.goodreads.com/book/show/1-blindsighted');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(details).toMatchObject({
      series: 'Grant County',
      seriesInstallment: '1',
      seriesTotal: '6',
    });
  });

  it('rejects non-Goodreads URLs before scraping book details', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new Error('fetch should not be called');
    });

    await expect(scrapeGoodreadsBook('https://example.com/book/show/1')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('parseGoodreadsSeriesBooks', () => {
  // Matches the REAL series-page shape (verified against a live page fetched
  // on-device 2026-07-19): one SeriesList component per book, props
  // { series: [{ isLibrarianView, readOnlyStars, book }] } with NO
  // seriesHeader field; the "Book N" label is an <h3> sibling, and the
  // installment also rides in the title parenthetical.
  const component = (book: Record<string, unknown>) => {
    const props = JSON.stringify({ series: [{ isLibrarianView: false, readOnlyStars: false, book }] })
      .replace(/"/g, '&quot;');
    return `<div data-react-class="ReactComponents.SeriesList" data-react-props="${props}"></div>`;
  };

  it('reads the roster from the real React series-list markup', () => {
    const html = `
      <h3 class="gr-h3">Book 1</h3>
      ${component({
        title: 'Red Rising (Red Rising Saga, #1)',
        bookTitleBare: 'Red Rising',
        bookUrl: '/book/show/15839976-red-rising',
        imageUrl: 'https://images-na.ssl-images-amazon.com/books/1461354651l/15839976._SX318_.jpg',
        author: { id: 4764, name: 'Pierce Brown' },
        publicationDate: 'January 28, 2014',
      })}
      <h3 class="gr-h3">Book 2</h3>
      ${component({
        title: 'Golden Son',
        bookTitleBare: 'Golden Son',
        bookUrl: '/book/show/18966819-golden-son?from_search=true',
        imageUrl: 'https://images-na.ssl-images-amazon.com/books/1394684475l/18966819.jpg',
        author: { id: 4764, name: 'Pierce Brown' },
        publicationDate: '2015',
      })}`;

    const books = parseGoodreadsSeriesBooks(html);

    expect(books).toHaveLength(2);
    expect(books[0]).toMatchObject({
      installment: '1',
      title: 'Red Rising',
      author: 'Pierce Brown',
      year: 2014,
      url: 'https://www.goodreads.com/book/show/15839976-red-rising',
    });
    // Size suffix stripped so the cover renders full resolution.
    expect(books[0].cover).not.toContain('_SX318_');
    // No parenthetical on this one — the installment comes from the <h3>.
    expect(books[1]).toMatchObject({ installment: '2', title: 'Golden Son', year: 2015 });
    expect(books[1].url).toBe('https://www.goodreads.com/book/show/18966819-golden-son');
  });

  it('never lets box sets or split editions claim an installment slot', () => {
    const html = `
      <h3 class="gr-h3">Book 1-3</h3>
      ${component({
        title: 'The Red Rising Trilogy (Red Rising Saga, #1-3)',
        bookTitleBare: 'The Red Rising Trilogy',
        bookUrl: '/book/show/256716-trilogy',
        imageUrl: 'https://images.gr-assets.com/books/box.jpg',
        author: { name: 'Pierce Brown' },
      })}
      <h3 class="gr-h3">Book 1, part 1</h3>
      ${component({
        title: 'Red Rising, Part 1',
        bookTitleBare: 'Red Rising, Part 1',
        bookUrl: '/book/show/999-part',
        imageUrl: 'https://images.gr-assets.com/books/part.jpg',
        author: { name: 'Pierce Brown' },
      })}`;

    const books = parseGoodreadsSeriesBooks(html);
    expect(books).toHaveLength(2);
    expect(books[0].installment).toBeNull();
    expect(books[1].installment).toBeNull();
  });

  it('falls back to the legacy list markup', () => {
    const html = `
      <div class="listWithDividers__item">
        <h3>Book 1</h3>
        <a class="gr-h3" href="/book/show/15839976-red-rising"><span itemprop="name">Red Rising</span></a>
        <span itemprop="author"><a href="/author/1">Pierce Brown</a></span>
        <img src="https://images.gr-assets.com/books/1461354651m/15839976.jpg" />
      </div>`;

    const books = parseGoodreadsSeriesBooks(html);

    expect(books).toHaveLength(1);
    expect(books[0]).toMatchObject({
      installment: '1',
      title: 'Red Rising',
      author: 'Pierce Brown',
      cover: 'https://images.gr-assets.com/books/1461354651m/15839976.jpg',
    });
  });

  it('returns an empty roster for unrecognized markup', () => {
    expect(parseGoodreadsSeriesBooks('<html><body><p>nothing</p></body></html>')).toEqual([]);
  });
});

// Regression: on the native app CapacitorHttp reports every response.url as
// https://localhost/_capacitor_http_interceptor_?u=<encoded>. Search results
// built from response.url carried that localhost URL, scrapeGoodreadsBook
// rejected them all as non-Goodreads, and the series roster never resolved on
// a phone even though every network request succeeded.
describe('CapacitorHttp interceptor URLs', () => {
  it('title-redirect results use the page canonical URL, not the interceptor response.url', async () => {
    const interceptor = 'https://localhost/_capacitor_http_interceptor_?u='
      + encodeURIComponent('https://www.goodreads.com/book/title?id=Red%20Rising');
    const bookHtml = `
      <html><head>
        <title>Red Rising</title>
        <meta property="og:url" content="https://www.goodreads.com/book/show/15839976-red-rising" />
      </head><body>
        <h1 data-testid="bookTitle">Red Rising</h1>
        <div class="RatingStatistics__rating">4.27</div>
      </body></html>`;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      const response = new Response(bookHtml, { status: 200 });
      Object.defineProperty(response, 'url', { value: interceptor });
      return response;
    });

    const results = await searchGoodreads(`interceptor-test-${Date.now()}`);
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('https://www.goodreads.com/book/show/15839976-red-rising');
  });

  it('scrapeGoodreadsBook unwraps interceptor URLs instead of rejecting them', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      expect(String(input)).toBe('https://www.goodreads.com/book/show/1-x');
      return new Response('<html><body><h1>X</h1></body></html>', { status: 200 });
    });

    const wrapped = 'https://localhost/_capacitor_http_interceptor_?u='
      + encodeURIComponent('https://www.goodreads.com/book/show/1-x');
    await scrapeGoodreadsBook(wrapped);
    expect(fetchMock).toHaveBeenCalled();
  });
});
