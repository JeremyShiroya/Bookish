// server/utils/googleBooksApi.ts

export interface GBResult {
  title: string;
  author: string | null;
  blurb: string | null;
  genre: string | null;
  publishYear: number | null;
  publisher: string | null;
  series: string | null;
  seriesInstallment: string | null;
  seriesTotal: string | null;
  cover: string | null;
}

// Host-less: the retry engine decides which front door each attempt uses.
function buildGoogleBooksQueries(title: string, author?: string) {
  const queries: string[] = [];
  const seen = new Set<string>();
  const addQuery = (query: string) => {
    const path = `/books/v1/volumes?q=${query}&maxResults=10&printType=books&country=US&langRestrict=en`;
    if (!seen.has(path)) {
      seen.add(path);
      queries.push(path);
    }
  };

  const encodedTitle = encodeURIComponent(title);
  const encodedAuthor = author ? encodeURIComponent(author) : null;

  if (encodedAuthor) addQuery(`intitle:${encodedTitle}+inauthor:${encodedAuthor}`);
  addQuery(`intitle:${encodedTitle}`);
  if (encodedAuthor) addQuery(encodeURIComponent(`${title} ${author}`));
  addQuery(encodedTitle);

  return queries;
}

// Without an API key every caller shares one anonymous Google project, and its
// quota is measured PER DAY — observed exhausted in the wild with
// "Quota exceeded for quota metric 'Queries' and limit 'Queries per day'".
// A short cooldown is useless against that: it just walks back into the same
// wall and adds a wasted round trip to every lookup for the rest of the day.
// So the backoff length is read from the quota that actually tripped.
const GOOGLE_BOOKS_MINUTE_COOLDOWN_MS = 90 * 1000;
const GOOGLE_BOOKS_DAY_COOLDOWN_MS = 6 * 60 * 60 * 1000;

// Enough matches that further query variants only add duplicates — and, more
// to the point, more quota. Each lookup could otherwise fire four requests,
// which across a few hundred books is what exhausts a daily allowance.
const ENOUGH_RESULTS = 8;

let googleBooksBlockedUntil = 0;

export function googleBooksRateLimited() {
  return Date.now() < googleBooksBlockedUntil;
}

export function resetGoogleBooksRateLimit() {
  googleBooksBlockedUntil = 0;
}

export function googleBooksCooldownFor(message: string) {
  return /per day/i.test(message) ? GOOGLE_BOOKS_DAY_COOLDOWN_MS : GOOGLE_BOOKS_MINUTE_COOLDOWN_MS;
}

// An API key moves us off the shared anonymous project entirely.
//
// Two ways in, because this module runs in two places. On the server `process`
// exists and the key comes from the environment. In the WebView there is no
// `process` at all — reading it unguarded would throw on import and take the
// whole on-device metadata pipeline with it — so the native side injects the
// key instead, from Nuxt's public runtime config.
let injectedGoogleBooksKey = '';

export function setGoogleBooksApiKey(key: string) {
  injectedGoogleBooksKey = String(key || '').trim();
}

function googleBooksKey() {
  if (injectedGoogleBooksKey) return injectedGoogleBooksKey;
  if (typeof process === 'undefined') return '';
  return process.env?.GOOGLE_BOOKS_API_KEY || process.env?.NUXT_GOOGLE_BOOKS_API_KEY || '';
}

// Google Books answers a large share of requests with 503 "backendFailed".
// Everything plausible was MEASURED before settling on this design:
//
//   * Not our parameters: `country`, query shape, `projection` — no effect.
//   * Not the connection: a single kept-alive socket flips 200↔503 mid-stream,
//     and fresh TCP+TLS per request scored no better (1/14 in one run).
//   * Not DNS or a bad edge: the router and 8.8.8.8 return the same regional
//     VIPs (216.239.3x.223); Cloudflare's answer (172.217.x.x) points at a
//     different front-end set that is EXACTLY as flaky when hit directly with
//     correct SNI. The failure lives behind every front door.
//   * Failures burst for seconds at a time, then clear.
//   * The two public hosts fail only PARTIALLY in sync: in 14 simultaneous
//     www/books.googleapis.com pairs, 5 had exactly one side succeed. So
//     alternating hosts between attempts decorrelates them (~50% per round
//     vs ~30% single-host).
//   * A 503 round-trip costs ~550ms, so attempts are cheap.
//
// Design that follows from those facts:
//   1. Alternate front doors on every retry.
//   2. Straddle bursts: early retries are quick, later ones spaced, so an
//      unlucky start still escapes a multi-second burst window.
//   3. A hard time budget per request, so a total outage degrades to "this
//      provider contributed nothing" rather than hanging the lookup.
//   4. Cache successes (below): a title only ever needs to win once.
const BOOKS_HOSTS = ['www.googleapis.com', 'books.googleapis.com'];
const RETRY_DELAYS_MS = [250, 250, 500, 750, 1250, 2000, 3000];
const REQUEST_BUDGET_MS = 10000;

// 200s are cached because the same title is looked up repeatedly — manual
// fetch, import backfill, series sweep, connection test — and Books data for
// a fixed query is effectively static. An empty item list is still a valid,
// cacheable answer. Only successful responses are stored.
const BOOKS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const BOOKS_CACHE_MAX = 300;
const booksCache = new Map<string, { expires: number; data: any }>();

function readBooksCache(query: string) {
  const hit = booksCache.get(query);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    booksCache.delete(query);
    return null;
  }
  return hit.data;
}

function writeBooksCache(query: string, data: any) {
  if (booksCache.size >= BOOKS_CACHE_MAX) {
    // Maps iterate in insertion order, so the first key is the oldest entry.
    const oldest = booksCache.keys().next().value;
    if (oldest !== undefined) booksCache.delete(oldest);
  }
  booksCache.set(query, { expires: Date.now() + BOOKS_CACHE_TTL_MS, data });
}

// Exported so the Settings → Connection test exercises the exact engine the
// app uses, retries and all — not a one-shot probe that cries wolf whenever a
// single attempt lands in a 503 burst.
export async function googleBooksRequest(pathAndQuery: string, budgetMs = REQUEST_BUDGET_MS) {
  const deadline = Date.now() + budgetMs;
  let res = await fetch(`https://${BOOKS_HOSTS[0]}${pathAndQuery}`);
  for (
    let attempt = 1;
    res.status >= 500 && attempt <= RETRY_DELAYS_MS.length && Date.now() < deadline;
    attempt += 1
  ) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
    res = await fetch(`https://${BOOKS_HOSTS[attempt % BOOKS_HOSTS.length]}${pathAndQuery}`);
  }
  return res;
}

// Retrying four query variants back-to-back could take a while during a full
// outage; past this, remaining variants are skipped rather than queued.
const LOOKUP_BUDGET_MS = 20000;

export async function searchGoogleBooks(title: string, author?: string): Promise<GBResult[]> {
  if (googleBooksRateLimited()) return [];

  try {
    const seen = new Set<string>();
    const results: GBResult[] = [];
    const key = googleBooksKey();
    const lookupDeadline = Date.now() + LOOKUP_BUDGET_MS;

    for (const query of buildGoogleBooksQueries(title, author)) {
      if (results.length >= ENOUGH_RESULTS) break;

      let data: any = readBooksCache(query);
      if (!data) {
        const remaining = lookupDeadline - Date.now();
        if (remaining <= 0) break;
        const res = await googleBooksRequest(
          key ? `${query}&key=${encodeURIComponent(key)}` : query,
          Math.min(REQUEST_BUDGET_MS, remaining),
        );
        if (res.status === 429) {
          const body = await res.text().catch(() => '');
          const cooldown = googleBooksCooldownFor(body);
          googleBooksBlockedUntil = Date.now() + cooldown;
          console.warn(
            `[GoogleBooks] Quota exceeded (${/per day/i.test(body) ? 'per day' : 'per minute'})`
            + ` — pausing this provider for ${Math.round(cooldown / 60000)} min`
            + (key ? '' : '. Set GOOGLE_BOOKS_API_KEY to use your own quota instead of the shared anonymous one.'),
          );
          return results;
        }
        if (!res.ok) continue;
        data = await res.json();
        writeBooksCache(query, data);
      }

      if (!data.items?.length) continue;

      const parsed = data.items
      .map((item: any): GBResult | null => {
        const info = item.volumeInfo;
        if (!info?.title) return null;

        let publishYear: number | null = null;
        if (info.publishedDate) {
          const y = parseInt(info.publishedDate.slice(0, 4), 10);
          if (!isNaN(y)) publishYear = y;
        }

        let cover: string | null = null;
        if (info.imageLinks?.thumbnail) {
          cover = info.imageLinks.thumbnail
            .replace(/zoom=\d+/, 'zoom=6')  // zoom=6 gives ~600-800px wide
            .replace('&edge=curl', '')       // remove page-curl effect
            .replace(/^http:\/\//, 'https://');
        }

        // Series name is not reliably available in the Google Books API basic response
        const series: string | null = null;
        let seriesInstallment: string | null = null;
        if (info.seriesInfo?.bookDisplayNumber) {
          seriesInstallment = info.seriesInfo.bookDisplayNumber.toString();
        }

        return {
          title: info.title,
          author: info.authors?.join(', ') || null,
          blurb: info.description || null,
          genre: info.categories?.slice(0, 3).join(', ') || null,
          publishYear,
          publisher: typeof info.publisher === 'string' && info.publisher.trim() ? info.publisher.trim() : null,
          series,
          seriesInstallment,
          seriesTotal: null,
          cover,
        };
      })
      .filter((r: GBResult | null): r is GBResult => r !== null);

      for (const result of parsed) {
        const key = `${result.title.toLowerCase()}:${result.author?.toLowerCase() || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(result);
      }

    }

    return results.slice(0, 10);
  } catch (err) {
    console.error('Google Books API error:', err);
    return [];
  }
}
