import { describe, expect, it } from 'vitest';
import {
  parseGoodreadsBookHtml,
  parseGoodreadsSearchHtml,
  parseSeriesFromText,
  splitGoodreadsTitle,
} from './goodreadsScraper';

describe('goodreadsScraper parsing helpers', () => {
  it('extracts series and installment from title parentheticals', () => {
    expect(splitGoodreadsTitle('Dune (Dune, #1)')).toEqual({
      title: 'Dune',
      rawSeriesTitle: 'Dune, #1',
      series: 'Dune',
      seriesInstallment: '1',
    });
  });

  it('extracts series and installment from aria/detail text', () => {
    expect(parseSeriesFromText('Book 2 in the Grant County series')).toEqual({
      series: 'Grant County',
      seriesInstallment: '2',
    });
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
              "aggregateRating": { "ratingValue": "4.02", "ratingCount": "123456" }
            }
          </script>
        </head>
        <body>
          <h3 aria-label="Book 1 in the Camille Preaker series"></h3>
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
      publishYear: 2006,
      genre: 'Mystery, Thriller, Crime',
      ratingValue: '4.02',
      ratingCount: '123456',
      webReview: 'Goodreads Rating: 4.02/5 (based on 123456 reviews).',
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
      webReview: 'Goodreads Rating: 4.28/5 (based on 987654 reviews).',
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
    });
  });
});
