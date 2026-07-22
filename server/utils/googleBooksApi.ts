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

// Google Books' anonymous quota is per-IP and small. A library backfill plus a
// series sweep can burn through it in minutes, after which EVERY request is a
// 429 — observed on a 300-book device where this provider returned nothing but
// quota errors. Once rate-limited, stop asking for a while: further calls only
// deepen the block and add latency to every lookup.
const GOOGLE_BOOKS_COOLDOWN_MS = 10 * 60 * 1000;
let googleBooksBlockedUntil = 0;

export function googleBooksRateLimited() {
  return Date.now() < googleBooksBlockedUntil;
}

export function resetGoogleBooksRateLimit() {
  googleBooksBlockedUntil = 0;
}

export async function searchGoogleBooks(title: string, author?: string): Promise<GBResult[]> {
  if (googleBooksRateLimited()) return [];

  try {
    const seen = new Set<string>();
    const results: GBResult[] = [];

    for (const url of buildGoogleBooksUrls(title, author)) {
      const res = await fetch(url);
      if (res.status === 429) {
        googleBooksBlockedUntil = Date.now() + GOOGLE_BOOKS_COOLDOWN_MS;
        console.warn('[GoogleBooks] Quota exceeded — pausing this provider for 10 minutes');
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
