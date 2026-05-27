// server/utils/koboScraper.ts

import * as cheerio from 'cheerio';

export interface KoboBookData {
  url: string;
  title: string;
  author: string;
  cover: string | null;
  blurb: string | null;
  series: string | null;
  seriesInstallment: string | null;
  genre: string | null;
  publishYear: number | null;
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: HEADERS });
    return res.ok ? res.text() : null;
  } catch {
    return null;
  }
}

function extractJsonLdBook(html: string, $: cheerio.CheerioAPI): any | null {
  let book: any = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (book) return;
    try {
      const parsed = JSON.parse($(el).html() || '');
      const candidate = Array.isArray(parsed)
        ? parsed.find((j: any) => j['@type'] === 'Book')
        : parsed['@type'] === 'Book' ? parsed : null;
      if (candidate) book = candidate;
    } catch {}
  });
  return book;
}

// Returns up to 5 Kobo book-page URLs for a query.
export async function searchKobo(title: string, author?: string): Promise<string[]> {
  const seen = new Set<string>();
  const urls: string[] = [];
  const regions = ['us', 'ww', 'ca', 'gb'];
  const queries = [
    { q: encodeURIComponent(title), titleOnly: true },
    { q: encodeURIComponent([title, author].filter(Boolean).join(' ')), titleOnly: false },
  ];

  for (const region of regions) {
    if (urls.length >= 8) break;

    for (const query of queries) {
      if (urls.length >= 8) break;
      const html = await fetchHtml(`https://www.kobo.com/${region}/en/search?query=${query.q}${query.titleOnly ? '&fcsearchfield=Title' : ''}`);
      if (!html) continue;

      const $ = cheerio.load(html);

      // Primary: extract ebook links directly from anchor tags
      $('a[href*="/ebook/"]').each((_, el) => {
        if (urls.length >= 8) return;
        const href = $(el).attr('href');
        if (!href) return;
        const full = href.startsWith('http') ? href : `https://www.kobo.com${href}`;
        const clean = full.split('?')[0].split('#')[0];
        if (!seen.has(clean)) { seen.add(clean); urls.push(clean); }
      });

      // Fallback: parse __NEXT_DATA__ SSR blob (Kobo uses Next.js)
      const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (match) {
        try {
          const nd = JSON.parse(match[1]);
          const pp = nd?.props?.pageProps;
          // Current Kobo structure: searchResultSSR.Items[].Book.Slug
          const ssrItems: any[] = pp?.searchResultSSR?.Items || [];
          for (const item of ssrItems) {
            const slug = item.Book?.Slug || item.Book?.slug;
            if (slug && urls.length < 8) {
              const u = `https://www.kobo.com/${region}/en/ebook/${slug}`;
              if (!seen.has(u)) { seen.add(u); urls.push(u); }
            }
          }
          // Legacy structure fallback
          if (urls.length === 0) {
            const legacyItems: any[] = pp?.searchResults?.items || pp?.items || [];
            for (const item of legacyItems) {
            const slug = item.slug || item.Slug || item.id;
              if (slug && urls.length < 8) {
                const u = `https://www.kobo.com/${region}/en/ebook/${slug}`;
                if (!seen.has(u)) { seen.add(u); urls.push(u); }
              }
            }
          }
        } catch {}
      }
    }
  }

  return urls.slice(0, 8);
}

// Scrapes a Kobo book detail page. Returns null if blocked or page has no cover.
export async function scrapeKoboBook(url: string): Promise<KoboBookData | null> {
  const html = await fetchHtml(url);
  if (!html) return null;

  const $ = cheerio.load(html);
  const ld = extractJsonLdBook(html, $);

  // Cover — OG image is the highest quality Kobo exposes in HTML
  const cover = $('meta[property="og:image"]').attr('content') || ld?.image || null;
  // Absence of cover is a strong signal the page is a bot-wall (CAPTCHA etc.)
  if (!cover) return null;

  // Title
  const title =
    ld?.name?.trim()
    || $('meta[property="og:title"]').attr('content')?.trim()
    || $('h1.title, h1[class*="title"]').first().text().trim()
    || '';

  // Author — JSON-LD author can be a string, object, or array
  const ldAuthor = ld?.author;
  const author =
    (typeof ldAuthor === 'string' ? ldAuthor
      : Array.isArray(ldAuthor) ? ldAuthor[0]?.name
      : ldAuthor?.name)
    || $('[class*="contributor"] a, [class*="author"] a').first().text().trim()
    || '';

  // Blurb
  const blurb =
    ld?.description?.trim()
    || $('meta[property="og:description"]').attr('content')?.trim()
    || $('[class*="synopsis"] p, [class*="description"] p').first().text().trim()
    || null;

  // Series — JSON-LD first, then DOM
  let series: string | null = ld?.bookSeries?.name || null;
  let seriesInstallment: string | null = ld?.bookSeries?.position?.toString() || null;
  if (!series) {
    const seriesText = $('[class*="series"] a, a[href*="series"]').first().text().trim();
    if (seriesText) {
      const m = seriesText.match(/^(.*?)(?:\s+#?(\d+(?:\.\d+)?))?$/);
      if (m) { series = m[1].trim() || null; seriesInstallment = m[2] || null; }
    }
  }

  // Genre — from breadcrumbs or category nav links
  const skipLabels = new Set(['Home', 'eBooks', 'Books', 'Kobo', 'en', 'us']);
  const genreSet = new Set<string>();
  $('[class*="breadcrumb"] a, nav a[href*="/category/"], [class*="genre"] a').each((_, el) => {
    const g = $(el).text().trim();
    if (g && !skipLabels.has(g)) genreSet.add(g);
  });
  const genre = [...genreSet].slice(0, 3).join(', ') || null;

  // Publish year — JSON-LD first, then DOM text search
  let publishYear: number | null = null;
  if (ld?.datePublished) {
    const y = parseInt(ld.datePublished.slice(0, 4), 10);
    if (!isNaN(y)) publishYear = y;
  }
  if (!publishYear) {
    const pubText = $('time, [class*="publish"], [itemprop="datePublished"]').first().text().trim();
    const m = pubText.match(/\b(19|20)\d{2}\b/);
    if (m) publishYear = parseInt(m[0], 10);
  }

  return { url, title, author, cover, blurb, series, seriesInstallment, genre, publishYear };
}
