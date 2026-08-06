import type { MetadataSource } from './metadataAggregator';

let _hardcoverApiKey: string | null = null;

export function setHardcoverApiKey(key: string | null) {
  _hardcoverApiKey = key;
}

const compact = (value?: unknown) => String(value || '').replace(/\s+/g, ' ').trim();

const parseYear = (value?: unknown): number | null => {
  const match = compact(value).match(/\b(15|16|17|18|19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
};

export const searchHardcover = async (title: string, author?: string): Promise<MetadataSource[]> => {
  if (!title) return [];

  const query = `
    query SearchBooks($query: String!) {
      books(where: { title: { _ilike: $query } }, limit: 6) {
        id
        title
        description
        release_date
        rating
        image {
          url
        }
        contributions {
          author {
            name
          }
        }
        book_series {
          position
          series {
            name
            books_count
          }
        }
        cached_tags
      }
    }
  `;

  try {
    const searchTerm = `%${title.trim()}%`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Bookish/1.2 (+https://github.com/JeremyShiroya/Bookish)',
    };
    if (_hardcoverApiKey) {
      headers.Authorization = _hardcoverApiKey.startsWith('Bearer ')
        ? _hardcoverApiKey
        : `Bearer ${_hardcoverApiKey}`;
    }

    const response = await fetch('https://api.hardcover.app/v1/graphql', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        variables: { query: searchTerm },
      }),
    });

    if (!response.ok) return [];

    const json = await response.json();
    const books = json.data?.books || [];

    return books.map((book: any): MetadataSource => {
      const authorName = book.contributions?.map((c: any) => c.author?.name).filter(Boolean).join(', ') || author || null;
      const seriesObj = book.book_series?.[0];
      const seriesName = seriesObj?.series?.name || null;
      const seriesPosition = seriesObj?.position ? String(seriesObj.position) : null;
      const seriesTotal = seriesObj?.series?.books_count ? String(seriesObj.series.books_count) : null;
      const rating = book.rating ? `⭐ ${Number(book.rating).toFixed(1)}/5` : null;
      const genre = Array.isArray(book.cached_tags) ? book.cached_tags.slice(0, 3).join(', ') : null;

      return {
        id: `hardcover:${book.id}`,
        source: 'hardcover',
        title: compact(book.title),
        author: authorName,
        cover: book.image?.url || null,
        blurb: compact(book.description) || null,
        series: seriesName,
        seriesInstallment: seriesPosition,
        seriesTotal,
        genre,
        publishYear: parseYear(book.release_date),
        publisher: null,
        webReview: rating,
      };
    }).filter((item: MetadataSource) => item.title);
  } catch {
    return [];
  }
};

export type HardcoverRosterBook = {
  installment: number;
  title: string;
  author: string | null;
  cover: string | null;
  year: number | null;
};

export type HardcoverSeriesRoster = {
  series: string | null;
  total: number | null;
  books: HardcoverRosterBook[];
};

export const fetchHardcoverSeriesRoster = async (seriesName: string, seedTitle?: string): Promise<HardcoverSeriesRoster> => {
  const searchTerm = seriesName || seedTitle;
  if (!searchTerm) return { series: null, total: null, books: [] };

  const query = `
    query GetSeriesRoster($query: String!) {
      series(where: { name: { _ilike: $query } }, limit: 1) {
        name
        books_count
        book_series(order_by: { position: asc }) {
          position
          book {
            title
            release_date
            image {
              url
            }
            contributions {
              author {
                name
              }
            }
          }
        }
      }
    }
  `;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Bookish/1.2 (+https://github.com/JeremyShiroya/Bookish)',
    };
    if (_hardcoverApiKey) {
      headers.Authorization = _hardcoverApiKey.startsWith('Bearer ')
        ? _hardcoverApiKey
        : `Bearer ${_hardcoverApiKey}`;
    }

    const response = await fetch('https://api.hardcover.app/v1/graphql', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        variables: { query: `%${searchTerm.trim()}%` },
      }),
    });

    if (!response.ok) return { series: null, total: null, books: [] };

    const json = await response.json();
    const seriesObj = json.data?.series?.[0];
    if (!seriesObj) return { series: null, total: null, books: [] };

    const seriesTitle = seriesObj.name || seriesName;
    const total = Number(seriesObj.books_count) || null;
    const bookSeries = seriesObj.book_series || [];

    const books: HardcoverRosterBook[] = bookSeries
      .map((entry: any) => {
        const position = Number(entry.position);
        if (!Number.isSafeInteger(position) || position < 1) return null;
        const b = entry.book;
        if (!b?.title) return null;
        const author = b.contributions?.map((c: any) => c.author?.name).filter(Boolean).join(', ') || null;

        return {
          installment: position,
          title: compact(b.title),
          author,
          cover: b.image?.url || null,
          year: parseYear(b.release_date),
        };
      })
      .filter((b: HardcoverRosterBook | null): b is HardcoverRosterBook => b !== null);

    return {
      series: seriesTitle,
      total: total || (books.length ? Math.max(...books.map((b) => b.installment)) : null),
      books,
    };
  } catch {
    return { series: null, total: null, books: [] };
  }
};
