import { afterEach, describe, expect, it, vi } from 'vitest';
import { parsePublisherBookPage, searchKnownPublisherSites, searchPublisherMetadata } from './publisherMetadata';

describe('publisher metadata scraper', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts publisher cover and blurb metadata from a book page', () => {
    const result = parsePublisherBookPage(`
      <html>
        <head>
          <meta property="og:title" content="Dune">
          <meta property="og:description" content="A publisher description of Dune with enough detail to be useful in the picker.">
          <meta property="og:image" content="https://images.penguinrandomhouse.com/cover/9780593099322">
          <script type="application/ld+json">
            {"@type":"Book","name":"Dune","author":{"@type":"Person","name":"Frank Herbert"},"publisher":{"@type":"Organization","name":"Penguin Random House"}}
          </script>
        </head>
        <body><h1>Dune</h1></body>
      </html>
    `, 'https://www.penguinrandomhouse.com/books/dune', 'Dune', 'Frank Herbert', 'Penguin Random House');

    expect(result).toMatchObject({
      title: 'Dune',
      author: 'Frank Herbert',
      cover: 'https://images.penguinrandomhouse.com/cover/9780593099322',
      blurb: 'A publisher description of Dune with enough detail to be useful in the picker.',
      publisher: 'Penguin Random House',
      searchedPublisher: 'Penguin Random House',
      publisherSite: 'penguinrandomhouse.com',
    });
  });

  it('cleans publisher title metadata and extracts the byline author', () => {
    const result = parsePublisherBookPage(`
      <html>
        <head>
          <meta property="og:title" content="Project Hail Mary (Movie Tie-In) by Andy Weir: 9798217299461 | PenguinRandomHouse.com: Books">
          <meta property="og:description" content="A publisher page description for Project Hail Mary with enough text to qualify.">
          <meta property="og:image" content="https://images.penguinrandomhouse.com/cover/9798217299461">
        </head>
      </html>
    `, 'https://www.penguinrandomhouse.com/books/611060/project-hail-mary-movie-tie-in-by-andy-weir/', 'Project Hail Mary', 'Andy Weir', 'Arrow');

    expect(result).toMatchObject({
      title: 'Project Hail Mary (Movie Tie-In)',
      author: 'Andy Weir',
      publisher: null,
      searchedPublisher: 'Arrow',
      publisherSite: 'penguinrandomhouse.com',
    });
  });

  it('does not accept publisher search pages as book metadata pages', () => {
    const result = parsePublisherBookPage(`
      <html>
        <head>
          <meta property="og:title" content="Search results for Gone Girl">
          <meta property="og:description" content="Search results page text that is long enough but should not become a book result.">
        </head>
      </html>
    `, 'https://www.hachettebookgroup.com/?s=Gone%20Girl%20Gillian%20Flynn', 'Gone Girl', 'Gillian Flynn', 'Grand Central Publishing');

    expect(result).toBeNull();
  });

  it('extracts nested publisher-page imprint metadata', () => {
    const result = parsePublisherBookPage(`
      <html>
        <head>
          <meta name="Tealium" data-book-imprint="Dell" data-book-division="Bantam Dell">
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "WebPage",
              "mainEntity": {
                "@type": "Book",
                "name": "Broken",
                "author": "Karin Slaughter",
                "image": "https://images.penguinrandomhouse.com/cover/9781101887448",
                "publisher": "Bantam Dell",
                "publisherImprint": "Dell",
                "about": "A publisher page description for Broken with enough text to qualify as a useful blurb."
              }
            }
          </script>
        </head>
      </html>
    `, 'https://www.penguinrandomhouse.com/books/168365/broken-by-karin-slaughter/', 'Broken', 'Karin Slaughter', 'penguinrandomhouse.com');

    expect(result).toMatchObject({
      title: 'Broken',
      author: 'Karin Slaughter',
      publisher: 'Dell',
      searchedPublisher: 'penguinrandomhouse.com',
      publisherSite: 'penguinrandomhouse.com',
    });
  });


  it('discovers unmapped publisher sites from Google redirect URLs and scrapes them', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('https://www.google.com/search?')) {
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => `
            <a href="/url?url=https%3A%2F%2Fangryrobotbooks.com%2Fbooks%2Fsea-of-rust&sa=U">Sea of Rust</a>
          `,
        } as Response;
      }

      if (url === 'https://angryrobotbooks.com/books/sea-of-rust') {
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => `
            <html>
              <head>
                <meta property="og:description" content="A publisher page description with enough text to qualify as a useful blurb.">
                <meta property="og:image" content="https://angryrobotbooks.com/images/sea-of-rust.jpg">
                <script type="application/ld+json">
                  {"@type":"Book","name":"Sea of Rust","author":{"@type":"Person","name":"C. Robert Cargill"}}
                </script>
              </head>
            </html>
          `,
        } as Response;
      }

      return { ok: false, headers: new Headers(), text: async () => '' } as Response;
    });

    await expect(searchPublisherMetadata('Sea of Rust', 'C. Robert Cargill', ['Angry Robot'])).resolves.toEqual([
      expect.objectContaining({
        id: 'https://angryrobotbooks.com/books/sea-of-rust',
        publisher: null,
        searchedPublisher: 'Angry Robot',
        publisherSite: 'angryrobotbooks.com',
        title: 'Sea of Rust',
        blurb: 'A publisher page description with enough text to qualify as a useful blurb.',
      }),
    ]);
  });

  it('searches a mapped publisher website directly before relying on search engines', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('https://www.penguinrandomhouse.com/search/site?q=')) {
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => `
            <a href="/books/123/project-hail-mary-by-andy-weir/">Project Hail Mary by Andy Weir</a>
          `,
        } as Response;
      }

      if (url === 'https://www.penguinrandomhouse.com/books/123/project-hail-mary-by-andy-weir/') {
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => `
            <html>
              <head>
                <meta property="og:description" content="A publisher page description for Project Hail Mary with enough text to qualify.">
                <meta property="og:image" content="https://images.penguinrandomhouse.com/cover/9780593135204">
                <script type="application/ld+json">
                  {"@type":"Book","name":"Project Hail Mary by Andy Weir: 9780593135204 | PenguinRandomHouse.com: Books"}
                </script>
              </head>
            </html>
          `,
        } as Response;
      }

      return { ok: false, headers: new Headers(), text: async () => '' } as Response;
    });

    await expect(searchPublisherMetadata('Project Hail Mary', 'Andy Weir', ['London : Arrow'])).resolves.toEqual([
      expect.objectContaining({
        id: 'https://www.penguinrandomhouse.com/books/123/project-hail-mary-by-andy-weir/',
        publisher: null,
        searchedPublisher: 'London : Arrow',
        publisherSite: 'penguinrandomhouse.com',
        title: 'Project Hail Mary',
        author: 'Andy Weir',
      }),
    ]);
  });

  it('researches known publisher sites when no publisher name was found', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('https://www.penguinrandomhouse.com/search/site?q=')) {
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => `
            <a href="/books/168365/broken-by-karin-slaughter/">Broken</a>
          `,
        } as Response;
      }

      if (url === 'https://www.penguinrandomhouse.com/books/168365/broken-by-karin-slaughter/') {
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => `
            <html>
              <head>
                <meta property="og:title" content="Broken by Karin Slaughter: 9781101887448 | PenguinRandomHouse.com: Books">
                <meta property="og:description" content="A publisher page description for Broken with enough text to qualify as a useful blurb.">
                <meta property="og:image" content="https://images1.penguinrandomhouse.com/cover/9781101887448">
              </head>
            </html>
          `,
        } as Response;
      }

      return { ok: false, headers: new Headers(), text: async () => '' } as Response;
    });

    await expect(searchKnownPublisherSites('Broken', 'Karin Slaughter')).resolves.toEqual([
      expect.objectContaining({
        id: 'https://www.penguinrandomhouse.com/books/168365/broken-by-karin-slaughter/',
        title: 'Broken',
        author: 'Karin Slaughter',
        searchedPublisher: 'penguinrandomhouse.com',
        publisherSite: 'penguinrandomhouse.com',
      }),
    ]);
  });
});
