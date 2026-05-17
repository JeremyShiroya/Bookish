import type { GBResult } from './googleBooksApi';

export interface OLResult {
  id: string;
  title: string;
  author: string;
  cover: string | null;
  blurb: string | null;
  series: string | null;
  seriesInstallment: string | null;
  genre: string | null;
  publishYear: number | null;
}

export async function searchOpenLibrary(title: string, author?: string): Promise<OLResult[]> {
  try {
    let url = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=5`;
    if (author) url += `&author=${encodeURIComponent(author)}`;

    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    if (!data.docs?.length) return [];

    const results = await Promise.all(
      (data.docs as any[]).map(async (doc): Promise<OLResult> => {
        let blurb: string | null = null;
        try {
          const detailRes = await fetch(`https://openlibrary.org${doc.key}.json`);
          if (detailRes.ok) {
            const detail = await detailRes.json();
            blurb = typeof detail.description === 'string'
              ? detail.description
              : detail.description?.value ?? null;
          }
        } catch {}

        return {
          id: doc.key,
          title: doc.title,
          author: doc.author_name ? (doc.author_name as string[]).join(', ') : '',
          cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
          blurb,
          series: doc.series_name?.[0] ?? null,
          seriesInstallment: doc.series_position?.[0] ?? null,
          genre: doc.subject ? (doc.subject as string[]).slice(0, 3).join(', ') : null,
          publishYear: doc.first_publish_year ?? null,
        };
      })
    );

    return results;
  } catch (err) {
    console.error('OpenLibrary search error:', err);
    return [];
  }
}

export function findOlMatch(targetTitle: string, olResults: OLResult[]): OLResult | null {
  if (!olResults.length) return null;
  const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const nt = n(targetTitle);
  return olResults.find(r => n(r.title).includes(nt) || nt.includes(n(r.title))) ?? olResults[0];
}
