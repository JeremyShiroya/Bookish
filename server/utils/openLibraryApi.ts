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
  isbn13s: string[];
}

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
    let url = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=5`;
    if (author) url += `&author=${encodeURIComponent(author)}`;

    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    if (!data.docs?.length) return [];

    const results = await Promise.all(
      (data.docs as any[]).map(async (doc): Promise<OLResult> => {
        let blurb: string | null = null;
        let detailSubjects: string[] = [];
        try {
          const detailRes = await fetch(`https://openlibrary.org${doc.key}.json`);
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
          genre: extractGenres([...(doc.subject || []), ...detailSubjects]),
          publishYear: doc.first_publish_year ?? null,
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
