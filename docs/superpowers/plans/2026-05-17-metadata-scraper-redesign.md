# Metadata Scraper Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Goodreads-primary / OpenLibrary-fallback metadata pipeline with a Kobo-primary pipeline that uses Google Books for gap-filling and Goodreads exclusively for review/rating.

**Architecture:** Three sources run in parallel — `searchKobo` returns book page URLs, `searchGoogleBooks` returns structured JSON, `getGoodreadsReview` returns a rating string. The endpoint scrapes the top Kobo pages in parallel, merges Google Books data into any missing fields, and attaches the Goodreads review to every result. If Kobo scraping fails entirely, Google Books results are returned as a fallback.

**Tech Stack:** Nuxt 4 server routes (h3), cheerio (already installed), native fetch, TypeScript.

---

### Task 1: Google Books API utility

**Files:**
- Create: `server/utils/googleBooksApi.ts`

The Google Books API is free with no key for basic queries. Endpoint:
`https://www.googleapis.com/books/v1/volumes?q=intitle:{title}+inauthor:{author}&maxResults=5&printType=books`

- [ ] **Step 1: Create the file**

```typescript
// server/utils/googleBooksApi.ts

export interface GBResult {
  title: string;
  author: string;
  blurb: string | null;
  genre: string | null;
  publishYear: number | null;
  series: string | null;
  seriesInstallment: string | null;
  cover: string | null;
}

export async function searchGoogleBooks(title: string, author?: string): Promise<GBResult[]> {
  try {
    const terms = [`intitle:${title}`, author ? `inauthor:${author}` : ''].filter(Boolean).join('+');
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(terms)}&maxResults=5&printType=books`;

    const res = await fetch(url);
    if (!res.ok) return [];

    const data: any = await res.json();
    if (!data.items?.length) return [];

    return data.items
      .map((item: any): GBResult | null => {
        const info = item.volumeInfo;
        if (!info?.title) return null;

        let publishYear: number | null = null;
        if (info.publishedDate) {
          const y = parseInt(info.publishedDate.slice(0, 4), 10);
          if (!isNaN(y)) publishYear = y;
        }

        // Bump zoom param for a larger cover image (1→3 gives ~500px wide)
        let cover: string | null = null;
        if (info.imageLinks?.thumbnail) {
          cover = info.imageLinks.thumbnail
            .replace('zoom=1', 'zoom=3')
            .replace(/^http:\/\//, 'https://');
        }

        // Series info is only present on some volumes
        let series: string | null = null;
        let seriesInstallment: string | null = null;
        const sv = info.seriesInfo?.volumeSeries?.[0];
        if (sv?.shortSeriesBookTitle) {
          const m = sv.shortSeriesBookTitle.match(/^(.*?)(?:\s+#?(\d+(?:\.\d+)?))?$/);
          if (m) {
            series = m[1].trim() || null;
            seriesInstallment = m[2] || null;
          }
        }

        return {
          title: info.title,
          author: (info.authors || []).join(', '),
          blurb: info.description || null,
          genre: info.categories?.slice(0, 3).join(', ') || null,
          publishYear,
          series,
          seriesInstallment,
          cover,
        };
      })
      .filter((r: GBResult | null): r is GBResult => r !== null);
  } catch (err) {
    console.error('Google Books API error:', err);
    return [];
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/utils/googleBooksApi.ts
git commit -m "feat: add Google Books API utility for metadata cross-reference"
```

---

### Task 2: Kobo scraper

**Files:**
- Create: `server/utils/koboScraper.ts`

Kobo book detail pages have server-rendered OG tags (`og:image` for the high-res cover, `og:description` for the blurb) and often a `application/ld+json` block with structured Book data. The search page may be a React SPA, so `searchKobo` tries HTML link extraction first, then falls back to the `__NEXT_DATA__` SSR blob Kobo embeds on its Next.js pages.

`scrapeKoboBook` returns `null` only when the response is blocked (no `og:image` means a bot-wall page). Callers filter nulls.

- [ ] **Step 1: Create the file**

```typescript
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
  const q = encodeURIComponent([title, author].filter(Boolean).join(' '));
  const html = await fetchHtml(`https://www.kobo.com/us/en/search?query=${q}&fcsearchfield=Title`);
  if (!html) return [];

  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const urls: string[] = [];

  // Primary: extract ebook links directly from anchor tags
  $('a[href*="/ebook/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const full = href.startsWith('http') ? href : `https://www.kobo.com${href}`;
    const clean = full.split('?')[0].split('#')[0];
    if (!seen.has(clean)) { seen.add(clean); urls.push(clean); }
  });

  // Fallback: parse __NEXT_DATA__ SSR blob (Kobo uses Next.js)
  if (urls.length === 0) {
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (match) {
      try {
        const nd = JSON.parse(match[1]);
        const items: any[] =
          nd?.props?.pageProps?.searchResults?.items
          || nd?.props?.pageProps?.items
          || [];
        for (const item of items) {
          const slug = item.slug || item.Slug || item.id;
          if (slug && urls.length < 5) {
            const u = `https://www.kobo.com/us/en/ebook/${slug}`;
            if (!seen.has(u)) { seen.add(u); urls.push(u); }
          }
        }
      } catch {}
    }
  }

  return urls.slice(0, 5);
}

// Scrapes a Kobo book detail page. Returns null if blocked.
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
```

- [ ] **Step 2: Commit**

```bash
git add server/utils/koboScraper.ts
git commit -m "feat: add Kobo scraper for primary book covers and metadata"
```

---

### Task 3: Add `getGoodreadsReview` to existing scraper

**Files:**
- Modify: `server/utils/goodreadsScraper.ts` (append to end of file)

The existing `searchGoodreads` and `scrapeGoodreadsBook` functions stay untouched. We add one new export that composes them into a single "give me just the review string" helper. The metadata endpoint will call this once per user search (not per result), so it's a single Goodreads roundtrip.

- [ ] **Step 1: Append the new export**

Open `server/utils/goodreadsScraper.ts`. At the very bottom of the file, after the closing brace of `scrapeGoodreadsBook`, add:

```typescript
// Returns only the webReview string (e.g. "Goodreads Rating: 4.23/5 (based on 1,234,567 reviews).")
// Used by the metadata endpoint — one call per user search, not per result.
export async function getGoodreadsReview(title: string, author?: string): Promise<string | null> {
  try {
    const results = await searchGoodreads(title, author);
    if (!results.length) return null;
    const details = await scrapeGoodreadsBook(results[0].url);
    return details?.webReview || null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/utils/goodreadsScraper.ts
git commit -m "feat: export getGoodreadsReview from Goodreads scraper"
```

---

### Task 4: Rewrite the metadata endpoint

**Files:**
- Modify: `server/api/books/metadata.get.ts` (full rewrite)

Orchestration strategy:
1. Run `searchKobo`, `searchGoogleBooks`, and `getGoodreadsReview` in parallel.
2. Scrape the top 3 Kobo URLs in parallel.
3. For each scraped Kobo result, find the best-matching Google Books entry by title similarity to fill any null fields.
4. Attach the (single) Goodreads review to all results.
5. If all Kobo scrapes return null (blocked), return Google Books results as fallback with the Goodreads review attached.

`findGbMatch` normalises both titles (lowercase, strip non-alphanumeric) and returns the Google Books entry whose normalised title is a substring of the Kobo title or vice-versa. Falls back to the first Google Books result if no title match.

- [ ] **Step 1: Rewrite the file**

```typescript
// server/api/books/metadata.get.ts

import { defineEventHandler, getQuery, createError } from 'h3';
import { searchKobo, scrapeKoboBook } from '../../utils/koboScraper';
import { searchGoogleBooks, type GBResult } from '../../utils/googleBooksApi';
import { getGoodreadsReview } from '../../utils/goodreadsScraper';

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findGbMatch(koboTitle: string, gb: GBResult[]): GBResult | null {
  if (!gb.length) return null;
  const n = norm(koboTitle);
  return (
    gb.find(r => norm(r.title).includes(n) || n.includes(norm(r.title)))
    ?? gb[0]
  );
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const title = query.title?.toString();
  const author = query.author?.toString();

  if (!title) {
    throw createError({ statusCode: 400, statusMessage: 'Title is required for metadata search' });
  }

  // 1. Kick off all three source searches in parallel
  const [koboUrlsResult, gbResult, reviewResult] = await Promise.allSettled([
    searchKobo(title, author),
    searchGoogleBooks(title, author),
    getGoodreadsReview(title, author),
  ]);

  const koboUrls = koboUrlsResult.status === 'fulfilled' ? koboUrlsResult.value : [];
  const gbResults = gbResult.status === 'fulfilled' ? gbResult.value : [];
  const webReview = reviewResult.status === 'fulfilled' ? reviewResult.value : null;

  // 2. Scrape top Kobo pages in parallel
  const scraped = koboUrls.length
    ? await Promise.allSettled(koboUrls.slice(0, 3).map(url => scrapeKoboBook(url)))
    : [];

  const enrichedResults = scraped
    .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof scrapeKoboBook>>>> =>
      r.status === 'fulfilled' && r.value !== null
    )
    .map(r => {
      const kobo = r.value;
      const gb = findGbMatch(kobo.title, gbResults);
      return {
        googleId: kobo.url,
        title: kobo.title,
        author: kobo.author,
        cover: kobo.cover,                          // Kobo: highest quality
        blurb: kobo.blurb ?? gb?.blurb ?? null,     // Kobo first, Google Books fills gap
        series: kobo.series ?? gb?.series ?? null,
        seriesInstallment: kobo.seriesInstallment ?? gb?.seriesInstallment ?? null,
        genre: kobo.genre ?? gb?.genre ?? null,
        publishYear: kobo.publishYear ?? gb?.publishYear ?? null,
        webReview,                                   // Always from Goodreads
      };
    });

  if (enrichedResults.length > 0) {
    return { results: enrichedResults };
  }

  // 3. Kobo blocked entirely — fall back to Google Books + Goodreads review
  if (gbResults.length > 0) {
    return {
      results: gbResults.slice(0, 5).map(gb => ({
        googleId: `gb:${gb.title}`,
        title: gb.title,
        author: gb.author,
        cover: gb.cover,
        blurb: gb.blurb,
        series: gb.series,
        seriesInstallment: gb.seriesInstallment,
        genre: gb.genre,
        publishYear: gb.publishYear,
        webReview,
      })),
    };
  }

  return { results: [] };
});
```

- [ ] **Step 2: Commit**

```bash
git add server/api/books/metadata.get.ts
git commit -m "feat: redesign metadata endpoint — Kobo primary, Google Books gap-fill, Goodreads review"
```

---

### Task 5: Manual verification

The scraper sources are third-party HTML/APIs that can't be usefully unit-tested without heavy mocking. Verify the full pipeline with the dev server.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test with a well-known book that has series info**

Navigate to `/add`. Type "Dune" in the title field. Click **Fetch Metadata**.

Expected result in the modal:
- Cover is a high-quality Kobo cover image (not a Google Books thumbnail)
- Blurb is populated
- Series: "Dune"
- Installment: "1"
- Genre: populated (e.g. "Science Fiction")
- Goodreads rating visible (e.g. "Goodreads Rating: 4.23/5…")

- [ ] **Step 3: Test a standalone novel (no series)**

Try "The Hitchhiker's Guide to the Galaxy" by Douglas Adams.

Expected: cover + blurb populated, series/installment empty (correct — it's standalone on Kobo).

- [ ] **Step 4: Test with author name included**

Try title "Harry Potter" author "Rowling".

Expected: series "Harry Potter" populated, installment "1" for the first result.

- [ ] **Step 5: Verify Goodreads fallback graceful**

Open browser devtools Network tab. If you see a Goodreads request that returns 429/403, the `webReview` field in the modal should be absent/null — not an error. The rest of the card should still populate normally from Kobo + Google Books.

- [ ] **Step 6: Commit verification note**

```bash
git commit --allow-empty -m "chore: manual verification passed for Kobo/Google Books/Goodreads metadata pipeline"
```
