import type { MetadataSource } from './metadataAggregator';

const compact = (value?: unknown) => String(value || '').replace(/\s+/g, ' ').trim();

export const searchOpenAlex = async (title: string, author?: string): Promise<MetadataSource[]> => {
  if (!title) return [];

  try {
    const query = author ? `${title} ${author}` : title;
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per_page=5`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Bookish/1.2 (mailto:support@bookish.app)',
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    const results = data.results || [];

    return results.map((work: any): MetadataSource => {
      const authors = (work.authorships || [])
        .map((a: any) => a.author?.display_name)
        .filter(Boolean)
        .join(', ');

      const concepts = (work.concepts || [])
        .slice(0, 3)
        .map((c: any) => c.display_name)
        .filter(Boolean)
        .join(', ');

      const coverUrl = work.primary_location?.landing_page_url || work.doi || null;

      return {
        id: `openalex:${work.id}`,
        source: 'openAlex',
        title: compact(work.title),
        author: authors || author || null,
        cover: null,
        blurb: work.abstract_inverted_index ? 'Academic work with available abstract.' : null,
        series: null,
        seriesInstallment: null,
        seriesTotal: null,
        genre: concepts || null,
        publishYear: work.publication_year ? Number(work.publication_year) : null,
        publisher: work.primary_location?.source?.display_name || null,
        webReview: null,
      };
    }).filter((item: MetadataSource) => item.title);
  } catch {
    return [];
  }
};
