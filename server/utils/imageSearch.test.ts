import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  addUniqueImage,
  isUsefulAuthorImageUrl,
  isUsefulCoverUrl,
  rankAuthorResult,
  rankCoverResult,
  parseGoogleImageSearchHtml,
  parseBingImageSearchHtml,
  searchGoogleImages,
} from './imageSearch';

describe('image search helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('dedupes useful cover URLs and filters placeholders', () => {
    const images: string[] = [];
    const seen = new Set<string>();

    addUniqueImage(images, seen, 'http://example.com/dune.jpg?utm_source=x', isUsefulCoverUrl);
    addUniqueImage(images, seen, 'https://example.com/dune.jpg?utm_source=y', isUsefulCoverUrl);
    addUniqueImage(images, seen, 'https://example.com/placeholder.jpg', isUsefulCoverUrl);

    expect(images).toEqual(['https://example.com/dune.jpg?utm_source=x']);
  });

  it('keeps known publisher cover CDN URLs without file extensions', () => {
    expect(isUsefulCoverUrl('https://images.penguinrandomhouse.com/cover/9780593099322')).toBe(true);
    expect(isUsefulCoverUrl('https://example.com/cover/9780593099322')).toBe(false);
  });

  it('keeps author portraits but rejects book covers and logos', () => {
    expect(isUsefulAuthorImageUrl('https://example.com/gillian-flynn-portrait.jpg')).toBe(true);
    expect(isUsefulAuthorImageUrl('https://covers.openlibrary.org/a/id/12345-L.jpg')).toBe(true);
    expect(isUsefulAuthorImageUrl('https://encrypted-tbn0.gstatic.com/images?q=tbn:portrait')).toBe(true);
    expect(isUsefulAuthorImageUrl('https://images.penguinrandomhouse.com/author/22367')).toBe(true);
    expect(isUsefulAuthorImageUrl('https://example.com/sharp-objects-book-cover.jpg')).toBe(false);
    expect(isUsefulAuthorImageUrl('https://example.com/logo.svg')).toBe(false);
  });

  it('ranks book-cover-shaped Google results higher', () => {
    const good = rankCoverResult({
      url: 'https://example.com/dune-cover.jpg',
      title: 'Dune by Frank Herbert book cover',
      thumbnail: null,
      context: null,
      width: 600,
      height: 900,
    }, 'Dune', 'Frank Herbert');

    const weak = rankCoverResult({
      url: 'https://example.com/dune-wallpaper.jpg',
      title: 'Dune wallpaper',
      thumbnail: null,
      context: null,
      width: 1200,
      height: 700,
    }, 'Dune', 'Frank Herbert');

    expect(good).toBeGreaterThan(weak);
  });

  it('ranks portrait-like author results higher', () => {
    const good = rankAuthorResult({
      url: 'https://example.com/gillian-flynn-author-photo.jpg',
      title: 'Gillian Flynn author portrait',
      thumbnail: null,
      context: null,
      width: 500,
      height: 600,
    }, 'Gillian Flynn');

    const weak = rankAuthorResult({
      url: 'https://example.com/sharp-objects-cover.jpg',
      title: 'Sharp Objects book cover',
      thumbnail: null,
      context: null,
      width: 600,
      height: 900,
    }, 'Gillian Flynn');

    expect(good).toBeGreaterThan(weak);
  });

  it('scrapes Google image results when env vars are missing', async () => {
    vi.unstubAllEnvs();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => '<a href="/imgres?imgurl=https%3A%2F%2Fexample.com%2Fdune.jpg&imgrefurl=https%3A%2F%2Fexample.com%2Fdune"></a>',
    } as Response);

    await expect(searchGoogleImages('Dune cover', { num: 5 })).resolves.toEqual([{
      url: 'https://example.com/dune.jpg',
      title: 'Dune cover',
      thumbnail: null,
      context: 'Google Images',
      width: null,
      height: null,
    }]);
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('google.com/search?'), expect.any(Object));
  });

  it('parses Google image URLs from result HTML', () => {
    const html = `
      <a href="/imgres?imgurl=https%3A%2F%2Fexample.com%2Fcover-one.jpg&imgrefurl=https%3A%2F%2Fexample.com"></a>
      <script>{"ou":"https:\\/\\/example.com\\/cover-two.webp","tu":"https:\\/\\/encrypted-tbn0.gstatic.com\\/images?q=tbn:thumb"}</script>
    `;

    expect(parseGoogleImageSearchHtml(html, 'Dune cover').map((item) => item.url)).toEqual([
      'https://example.com/cover-one.jpg',
      'https://example.com/cover-two.webp',
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:thumb',
    ]);
  });

  it('parses original image URLs from Bing image results', () => {
    const html = `
      <a class="iusc" m='{"murl":"https://example.com/author-one.jpg","turl":"https://example.com/thumb.jpg"}'></a>
      <div data-meta="{&quot;murl&quot;:&quot;https://example.com/author-two.webp&quot;}"></div>
    `;

    expect(parseBingImageSearchHtml(html)).toEqual([
      'https://example.com/author-one.jpg',
      'https://example.com/author-two.webp',
    ]);
  });

  it('maps Google Programmable Search image results', async () => {
    vi.stubEnv('GOOGLE_SEARCH_API_KEY', 'key');
    vi.stubEnv('GOOGLE_SEARCH_CX', 'cx');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{
          link: 'https://example.com/dune.jpg',
          title: 'Dune cover',
          displayLink: 'example.com',
          image: { thumbnailLink: 'https://example.com/thumb.jpg', width: 500, height: 750 },
        }],
      }),
    } as Response);

    await expect(searchGoogleImages('Dune cover', { num: 1, scrape: false })).resolves.toEqual([{
      url: 'https://example.com/dune.jpg',
      title: 'Dune cover',
      thumbnail: 'https://example.com/thumb.jpg',
      context: 'example.com',
      width: 500,
      height: 750,
    }]);
  });

  it('paginates Google Programmable Search when more than ten results are requested', async () => {
    vi.stubEnv('GOOGLE_SEARCH_API_KEY', 'key');
    vi.stubEnv('GOOGLE_SEARCH_CX', 'cx');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));
      const start = url.searchParams.get('start');
      const offset = start === '11' ? 10 : 0;
      return {
        ok: true,
        json: async () => ({
          items: Array.from({ length: start === '11' ? 2 : 10 }, (_, index) => ({
            link: `https://example.com/dune-${offset + index}.jpg`,
            title: 'Dune cover',
            displayLink: 'example.com',
            image: { width: 500, height: 750 },
          })),
        }),
      } as Response;
    });

    const results = await searchGoogleImages('Dune cover', { num: 12, scrape: false });

    expect(results).toHaveLength(12);
    expect(results[10].url).toBe('https://example.com/dune-10.jpg');
  });
});
