import { describe, expect, it } from 'vitest';
import { buildMetadataResults } from './metadataAggregator';

describe('books metadata enrichment', () => {
  it('keeps exact Open Library matches even when scraping providers return nothing', () => {
    const results = buildMetadataResults('Broken', 'Karin Slaughter', {
      goodreadsSources: [],
      googleBooksSources: [],
      internetArchiveSources: [],
      openLibrarySources: [{
        id: '/works/OL14907121W',
        source: 'openLibrary',
        title: 'Broken',
        author: 'Karin Slaughter',
        cover: 'https://covers.openlibrary.org/b/id/6424942-L.jpg',
        blurb: null,
        series: null,
        seriesInstallment: null,
        genre: null,
        publishYear: 2010,
        webReview: null,
      }],
      koboSources: [],
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      title: 'Broken',
      author: 'Karin Slaughter',
      publishYear: 2010,
      webReview: null,
    });
  });

  it('fills missing fields from matching sources and keeps Goodreads rating Goodreads-only', () => {
    const results = buildMetadataResults('Dune', 'Frank Herbert', {
      goodreadsSources: [{
        id: 'gr:dune',
        source: 'goodreads',
        title: 'Dune',
        author: 'Frank Herbert',
        cover: null,
        blurb: null,
        series: 'Dune',
        seriesInstallment: '1',
        genre: null,
        publishYear: null,
        webReview: 'Goodreads Rating: 4.28/5 (based on 1,511,111 reviews).',
      }],
      googleBooksSources: [{
        id: 'gb:Dune',
        source: 'googleBooks',
        title: 'Dune',
        author: 'Frank Herbert',
        cover: 'https://example.com/dune.jpg',
        blurb: 'Set on the desert planet Arrakis.',
        series: null,
        seriesInstallment: null,
        genre: 'Science Fiction',
        publishYear: 1965,
        webReview: 'Not a Goodreads rating',
      }],
      internetArchiveSources: [],
      openLibrarySources: [],
      koboSources: [],
    });

    expect(results[0]).toMatchObject({
      title: 'Dune',
      author: 'Frank Herbert',
      cover: 'https://example.com/dune.jpg',
      blurb: 'Set on the desert planet Arrakis.',
      series: 'Dune',
      seriesInstallment: '1',
      genre: 'Science Fiction',
      publishYear: 1965,
      webReview: 'Goodreads Rating: 4.28/5 (based on 1,511,111 reviews).',
      sourceTags: ['googleBooks', 'goodreads'],
    });
  });

  it('returns non-Goodreads matches when Goodreads fails without inventing a web review', () => {
    const results = buildMetadataResults('Kindred', 'Octavia Butler', {
      goodreadsSources: [],
      googleBooksSources: [{
        id: 'gb:Kindred',
        source: 'googleBooks',
        title: 'Kindred',
        author: 'Octavia E. Butler',
        cover: 'https://example.com/kindred.jpg',
        blurb: null,
        series: null,
        seriesInstallment: null,
        genre: 'Fiction',
        publishYear: 1979,
        webReview: null,
      }],
      internetArchiveSources: [],
      openLibrarySources: [{
        id: 'ol:kindred',
        source: 'openLibrary',
        title: 'Kindred',
        author: 'Octavia Butler',
        cover: null,
        blurb: 'A woman is pulled through time.',
        series: null,
        seriesInstallment: null,
        genre: 'Science Fiction',
        publishYear: 1979,
        webReview: null,
      }],
      koboSources: [],
    });

    expect(results[0]).toMatchObject({
      title: 'Kindred',
      cover: 'https://example.com/kindred.jpg',
      blurb: 'A woman is pulled through time.',
      webReview: null,
    });
  });

  it('uses Internet Archive as an API fallback when Open Library and Google are unavailable', () => {
    const results = buildMetadataResults('Clean Code', 'Robert C. Martin', {
      goodreadsSources: [],
      googleBooksSources: [],
      internetArchiveSources: [{
        id: 'ia:clean-code-a-handbook-of-agile-software-craftsmanship',
        source: 'internetArchive',
        title: 'Clean Code A Handbook of Agile Software Craftsmanship',
        author: 'Robert C. Martin',
        cover: 'https://archive.org/services/img/clean-code-a-handbook-of-agile-software-craftsmanship',
        blurb: 'A practical guide to writing clean, maintainable code.',
        series: null,
        seriesInstallment: null,
        genre: 'Computer programming',
        publishYear: 2008,
        webReview: null,
      }],
      openLibrarySources: [],
      koboSources: [],
    });

    expect(results[0]).toMatchObject({
      title: 'Clean Code A Handbook of Agile Software Craftsmanship',
      author: 'Robert C. Martin',
      publishYear: 2008,
      webReview: null,
    });
  });

  it('attaches the searched Goodreads rating even when the primary provider has a longer title', () => {
    const results = buildMetadataResults('Clean Code', 'Robert C. Martin', {
      goodreadsSources: [{
        id: 'gr:clean-code',
        source: 'goodreads',
        title: 'Clean Code',
        author: 'Robert C. Martin',
        cover: null,
        blurb: null,
        series: null,
        seriesInstallment: null,
        genre: null,
        publishYear: null,
        webReview: 'Goodreads Rating: 4.37/5 (23,637 ratings, 1,485 reviews).',
      }],
      googleBooksSources: [],
      internetArchiveSources: [{
        id: 'ia:clean-code-a-handbook-of-agile-software-craftsmanship',
        source: 'internetArchive',
        title: 'Clean Code A Handbook of Agile Software Craftsmanship',
        author: 'Robert C. Martin',
        cover: 'https://archive.org/services/img/clean-code-a-handbook-of-agile-software-craftsmanship',
        blurb: null,
        series: null,
        seriesInstallment: null,
        genre: null,
        publishYear: 2008,
        webReview: null,
      }],
      openLibrarySources: [],
      koboSources: [],
    });

    const internetArchiveResult = results.find((result) => result.googleId.startsWith('ia:'));
    expect(internetArchiveResult).toMatchObject({
      title: 'Clean Code A Handbook of Agile Software Craftsmanship',
      webReview: 'Goodreads Rating: 4.37/5 (23,637 ratings, 1,485 reviews).',
    });
  });

  it('adds publisher blurbs to the selectable blurb options without replacing stronger covers', () => {
    const results = buildMetadataResults('Dune', 'Frank Herbert', {
      goodreadsSources: [],
      googleBooksSources: [{
        id: 'gb:dune',
        source: 'googleBooks',
        title: 'Dune',
        author: 'Frank Herbert',
        cover: 'https://example.com/google-dune.jpg',
        blurb: 'Google Books description for Dune that is long enough to be offered.',
        series: null,
        seriesInstallment: null,
        genre: 'Science Fiction',
        publishYear: 1965,
        publisher: 'Penguin Random House',
        webReview: null,
      }],
      internetArchiveSources: [],
      openLibrarySources: [],
      koboSources: [],
      publisherSources: [{
        id: 'https://www.penguinrandomhouse.com/books/dune',
        source: 'publisher',
        title: 'Dune',
        author: 'Frank Herbert',
        cover: 'https://example.com/publisher-dune.jpg',
        blurb: 'Publisher site description for Dune that differs from Google Books.',
        series: null,
        seriesInstallment: null,
        genre: null,
        publishYear: null,
        publisher: 'Penguin Random House',
        webReview: null,
      }],
    });

    const [result] = results;
    expect(result).toBeDefined();
    expect(result).toMatchObject({
      cover: 'https://example.com/google-dune.jpg',
      publisher: 'Penguin Random House',
      sourceTags: ['publisher', 'googleBooks'],
      publisherSource: {
        name: 'Penguin Random House',
        site: 'penguinrandomhouse.com',
        url: 'https://www.penguinrandomhouse.com/books/dune',
      },
    });
    expect(result?.blurbOptions).toEqual([
      { source: 'googleBooks', blurb: 'Google Books description for Dune that is long enough to be offered.' },
      { source: 'publisher', blurb: 'Publisher site description for Dune that differs from Google Books.' },
    ]);
  });
});
