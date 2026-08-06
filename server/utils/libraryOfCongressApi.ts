import type { MetadataSource } from './metadataAggregator';

const compact = (value?: unknown) => String(value || '').replace(/\s+/g, ' ').trim();

const parseYear = (value?: unknown): number | null => {
  const match = compact(value).match(/\b(15|16|17|18|19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
};

export const searchLibraryOfCongress = async (title: string, author?: string): Promise<MetadataSource[]> => {
  if (!title) return [];

  try {
    const query = author ? `title:${title} AND contributor:${author}` : `title:${title}`;
    const url = `https://www.loc.gov/books/?q=${encodeURIComponent(query)}&fo=json&c=5`;
    const response = await fetch(url);

    if (!response.ok) return [];

    const data = await response.json();
    const results = data.results || [];

    return results.map((item: any): MetadataSource => {
      const itemTitle = Array.isArray(item.title) ? item.title[0] : item.title;
      const itemAuthor = Array.isArray(item.contributor) ? item.contributor[0] : item.contributor;
      const subjects = Array.isArray(item.subject) ? item.subject.slice(0, 3).join(', ') : item.subject;

      return {
        id: `loc:${item.id || item.url || itemTitle}`,
        source: 'libraryOfCongress',
        title: compact(itemTitle),
        author: itemAuthor ? compact(itemAuthor) : author || null,
        cover: item.image_url ? (Array.isArray(item.image_url) ? item.image_url[0] : item.image_url) : null,
        blurb: Array.isArray(item.description) ? compact(item.description[0]) : compact(item.description) || null,
        series: null,
        seriesInstallment: null,
        seriesTotal: null,
        genre: compact(subjects) || null,
        publishYear: parseYear(item.date),
        publisher: null,
        webReview: null,
      };
    }).filter((item: MetadataSource) => item.title);
  } catch {
    return [];
  }
};
