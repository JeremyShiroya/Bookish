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

function buildGoogleBooksUrls(title: string, author?: string) {
  const urls: string[] = [];
  const seen = new Set<string>();
  const addUrl = (query: string) => {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=10&printType=books&country=US&langRestrict=en`;
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  };

  const encodedTitle = encodeURIComponent(title);
  const encodedAuthor = author ? encodeURIComponent(author) : null;

  if (encodedAuthor) addUrl(`intitle:${encodedTitle}+inauthor:${encodedAuthor}`);
  addUrl(`intitle:${encodedTitle}`);
  if (encodedAuthor) addUrl(encodeURIComponent(`${title} ${author}`));
  addUrl(encodedTitle);

  return urls;
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

// Google Books intermittently answers 503 "Service temporarily unavailable"
// — observed repeatedly from both the phone and a desktop, on the same URL and
// key, minutes apart. It is transient and unrelated to the transport: a run
// that looked like CapacitorHttp being rejected reversed completely on the next
// attempt. Treating a 503 like a permanent failure meant the provider silently
// contributed nothing, so a short retry rides it out instead.
const TRANSIENT_RETRIES = 2;
const TRANSIENT_DELAY_MS = 1200;

async function booksFetch(url: string) {
  let res = await fetch(url);
  for (let attempt = 0; attempt < TRANSIENT_RETRIES && res.status >= 500; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, TRANSIENT_DELAY_MS * (attempt + 1)));
    res = await fetch(url);
  }
  return res;
}

export async function searchGoogleBooks(title: string, author?: string): Promise<GBResult[]> {
  if (googleBooksRateLimited()) return [];

  try {
    const seen = new Set<string>();
    const results: GBResult[] = [];
    const key = googleBooksKey();

    for (const url of buildGoogleBooksUrls(title, author)) {
      if (results.length >= ENOUGH_RESULTS) break;
      const res = await booksFetch(key ? `${url}&key=${encodeURIComponent(key)}` : url);
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

      const data: any = await res.json();
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
