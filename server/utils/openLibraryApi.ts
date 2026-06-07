export interface OLResult {
  id: string;
  title: string;
  author: string;
  cover: string | null;
  blurb: string | null;
  series: string | null;
  seriesInstallment: string | null;
  seriesTotal: string | null;
  genre: string | null;
  publishYear: number | null;
  publisher: string | null;
  isbn13s: string[];
}

function pickPublisher(value: unknown): string | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === 'string' && item.trim());
    return first ? String(first).trim() : null;
  }
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

const openLibraryHeaders = {
  'User-Agent': 'Bookish/1.0 (metadata lookup; contact: local-app)',
  'Accept': 'application/json',
};

function normalizeSubjectGenre(subject: string) {
  const cleaned = subject.replace(/\s+/g, ' ').trim();
  const lower = cleaned.toLowerCase();
  if (!cleaned || cleaned.length > 40) return null;
  if (
    lower.includes('imaginary place')
    || lower.includes('protected daisy')
    || lower.includes('accessible book')
    || lower.includes('large type')
    || lower.includes('open library')
    || lower.includes('overdrive')
    || lower.includes('translation')
    || lower.includes('reviewed')
    || lower === 'general'
  ) return null;
  if (/^(fiction|literature)$/i.test(cleaned)) return cleaned;
  return cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function extractGenres(subjects: string[]) {
  const seen = new Set<string>();
  return subjects
    .flatMap((subject) => subject.split(','))
    .map(normalizeSubjectGenre)
    .filter((subject): subject is string => Boolean(subject))
    .sort((a, b) => {
      if (/science fiction/i.test(a) && !/science fiction/i.test(b)) return -1;
      if (/science fiction/i.test(b) && !/science fiction/i.test(a)) return 1;
      if (/^fiction$/i.test(a)) return 1;
      if (/^fiction$/i.test(b)) return -1;
      return 0;
    })
    .filter((subject) => {
      const key = subject.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3)
    .join(', ') || null;
}

export async function searchOpenLibrary(title: string, author?: string): Promise<OLResult[]> {
  try {
    const urls = [
      `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}${author ? `&author=${encodeURIComponent(author)}` : ''}&limit=8`,
      `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=8`,
      `https://openlibrary.org/search.json?q=${encodeURIComponent([title, author].filter(Boolean).join(' '))}&limit=8`,
    ];
    const seenUrls = new Set<string>();
    const seenResults = new Set<string>();
    const docs: any[] = [];

    for (const url of urls) {
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);

      const res = await fetch(url, { headers: openLibraryHeaders });
      if (!res.ok) continue;

      const data = await res.json();
      if (!data.docs?.length) continue;

      for (const doc of data.docs as any[]) {
        const key = doc.key || `${doc.title}:${doc.author_name?.join(',') || ''}`;
        if (seenResults.has(key)) continue;
        seenResults.add(key);
        docs.push(doc);
      }

    }

    if (!docs.length) return [];

    const results = await Promise.all(
      docs.slice(0, 8).map(async (doc): Promise<OLResult> => {
        let blurb: string | null = null;
        let detailSubjects: string[] = [];
        try {
          const detailRes = await fetch(`https://openlibrary.org${doc.key}.json`, { headers: openLibraryHeaders });
          if (detailRes.ok) {
            const detail = await detailRes.json();
            blurb = typeof detail.description === 'string'
              ? detail.description
              : detail.description?.value ?? null;
            detailSubjects = Array.isArray(detail.subjects) ? detail.subjects : [];
          }
        } catch {}

        const isbn13s: string[] = doc.isbn
          ? (doc.isbn as string[]).filter((s: string) => s.length === 13)
          : [];

        return {
          id: doc.key,
          title: doc.title,
          author: doc.author_name ? (doc.author_name as string[]).join(', ') : '',
          cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
          blurb,
          series: doc.series_name?.[0] ?? null,
          seriesInstallment: doc.series_position?.[0] ?? null,
          seriesTotal: null,
          genre: extractGenres([...(doc.subject || []), ...detailSubjects]),
          publishYear: doc.first_publish_year ?? null,
          publisher: pickPublisher(doc.publisher),
          isbn13s,
        };
      })
    );

    return results;
  } catch (err) {
    console.error('OpenLibrary search error:', err);
    return [];
  }
}
