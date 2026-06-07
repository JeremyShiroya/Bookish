export interface IAResult {
  id: string;
  title: string;
  author: string | null;
  cover: string | null;
  blurb: string | null;
  series: string | null;
  seriesInstallment: string | null;
  seriesTotal: string | null;
  genre: string | null;
  publishYear: number | null;
  publisher: string | null;
}

const internetArchiveHeaders = {
  'User-Agent': 'Bookish/1.0 (metadata lookup; contact: local-app)',
  'Accept': 'application/json',
};

function normalizeArray(value: unknown): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

function normalizeCreator(value: unknown) {
  const creator = normalizeArray(value)[0]?.replace(/\b\d{4}-?\d{0,4}\b/g, '').replace(/\s+/g, ' ').trim();
  if (!creator) return null;

  const parts = creator.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[1]} ${parts[0]}`.replace(/\s+/g, ' ').trim();
  }

  return creator;
}

function parseYear(...values: unknown[]) {
  for (const value of values) {
    const match = String(value || '').match(/\b(15|16|17|18|19|20)\d{2}\b/);
    if (match) return parseInt(match[0], 10);
  }
  return null;
}

function normalizeDescription(value: unknown) {
  const descriptions = normalizeArray(value)
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter((item) => item.length > 40 && !/^\d+\s+pages?\b/i.test(item));
  return descriptions[0] || null;
}

function normalizeGenre(value: unknown) {
  const seen = new Set<string>();
  const rejected = /(accessible book|internet archive|in library|protected daisy|large type|overdrive|translation|juvenile|conduct of life)/i;

  return normalizeArray(value)
    .flatMap((item) => item.split(';'))
    .map((item) => item.replace(/\s*--.*$/, '').replace(/\s+/g, ' ').trim())
    .filter((item) => item && item.length <= 40 && !rejected.test(item))
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3)
    .join(', ') || null;
}

function solrValue(value: string) {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function buildQueries(title: string, author?: string) {
  const queries = [
    `title:(${solrValue(title)}) AND mediatype:texts`,
    `title:(${title}) AND mediatype:texts`,
  ];
  if (author) {
    queries.unshift(`title:(${solrValue(title)}) AND creator:(${solrValue(author)}) AND mediatype:texts`);
    queries.push(`(${title} ${author}) AND mediatype:texts`);
  }
  return queries;
}

async function fetchItemDetails(identifier: string) {
  try {
    const response = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`, {
      headers: internetArchiveHeaders,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function toResult(doc: any, details: any): IAResult | null {
  const metadata = details?.metadata || {};
  const identifier = doc.identifier || metadata.identifier;
  const title = String(metadata.title || doc.title || '').replace(/\s+/g, ' ').trim();
  if (!identifier || !title) return null;

  const publisherRaw = metadata.publisher || metadata.printer || doc.publisher;
  const publisher = Array.isArray(publisherRaw)
    ? (publisherRaw.find((item: unknown) => typeof item === 'string' && item.trim()) as string | undefined)?.trim() || null
    : (typeof publisherRaw === 'string' && publisherRaw.trim() ? publisherRaw.trim() : null);

  return {
    id: `ia:${identifier}`,
    title,
    author: normalizeCreator(metadata.creator || doc.creator),
    cover: `https://archive.org/services/img/${encodeURIComponent(identifier)}`,
    blurb: normalizeDescription(metadata.description || doc.description),
    series: null,
    seriesInstallment: null,
    seriesTotal: null,
    genre: normalizeGenre(metadata.subject || doc.subject),
    publishYear: parseYear(metadata.year, metadata.date, doc.year),
    publisher,
  };
}

export async function searchInternetArchive(title: string, author?: string): Promise<IAResult[]> {
  try {
    const seen = new Set<string>();
    const docs: any[] = [];

    for (const q of buildQueries(title, author)) {
      const params = new URLSearchParams({
        q,
        rows: '8',
        output: 'json',
      });
      ['title', 'creator', 'year', 'identifier', 'description', 'subject'].forEach((field) => {
        params.append('fl[]', field);
      });

      const response = await fetch(`https://archive.org/advancedsearch.php?${params.toString()}`, {
        headers: internetArchiveHeaders,
      });
      if (!response.ok) continue;

      const data: any = await response.json();
      for (const doc of data.response?.docs || []) {
        if (!doc.identifier || seen.has(doc.identifier)) continue;
        seen.add(doc.identifier);
        docs.push(doc);
      }
    }

    const details = await Promise.all(docs.slice(0, 8).map((doc) => fetchItemDetails(doc.identifier)));
    return docs
      .slice(0, 8)
      .map((doc, index) => toResult(doc, details[index]))
      .filter((item): item is IAResult => item !== null);
  } catch (error) {
    console.error('Internet Archive search error:', error);
    return [];
  }
}
