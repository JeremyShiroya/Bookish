// server/utils/googleBooksApi.ts

export interface GBResult {
  title: string;
  author: string | null;
  blurb: string | null;
  genre: string | null;
  publishYear: number | null;
  series: string | null;
  seriesInstallment: string | null;
  cover: string | null;
}

export async function searchGoogleBooks(title: string, author?: string): Promise<GBResult[]> {
  try {
    // Build query with unencoded field operators (Google Books requires intitle: and inauthor: unencoded)
    const parts = [`intitle:${encodeURIComponent(title)}`];
    if (author) parts.push(`inauthor:${encodeURIComponent(author)}`);
    const url = `https://www.googleapis.com/books/v1/volumes?q=${parts.join('+')}&maxResults=5&printType=books`;

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
