import type { MetadataSource } from './metadataAggregator';

const compact = (value?: unknown) => String(value || '').replace(/\s+/g, ' ').trim();

const parseYear = (value?: unknown): number | null => {
  const match = compact(value).match(/\b(15|16|17|18|19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
};

export const searchWikidata = async (title: string, author?: string): Promise<MetadataSource[]> => {
  if (!title) return [];

  try {
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(title)}&language=en&type=item&format=json&origin=*`;
    const response = await fetch(searchUrl);
    if (!response.ok) return [];

    const data = await response.json();
    const results = data.search || [];
    if (!results.length) return [];

    const ids = results.slice(0, 5).map((item: any) => item.id).join('|');
    const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids}&languages=en&props=claims|labels|descriptions&format=json&origin=*`;
    const entityResponse = await fetch(entityUrl);
    if (!entityResponse.ok) return [];

    const entityData = await entityResponse.json();
    const entities = entityData.entities || {};

    const sources: MetadataSource[] = [];

    for (const id of Object.keys(entities)) {
      const entity = entities[id];
      const itemTitle = entity.labels?.en?.value || null;
      const blurb = entity.descriptions?.en?.value || null;
      if (!itemTitle) continue;

      // Extract publication date claim (P577) if present
      const dateClaim = entity.claims?.P577?.[0]?.mainsnak?.datavalue?.value?.time;
      const pubYear = parseYear(dateClaim);

      // Extract series position (P1545) if present
      const seriesOrdinal = entity.claims?.P1545?.[0]?.mainsnak?.datavalue?.value;

      sources.push({
        id: `wikidata:${id}`,
        source: 'wikidata',
        title: compact(itemTitle),
        author: author ? compact(author) : null,
        cover: null,
        blurb: compact(blurb) || null,
        series: null,
        seriesInstallment: seriesOrdinal ? String(seriesOrdinal) : null,
        seriesTotal: null,
        genre: null,
        publishYear: pubYear,
        publisher: null,
        webReview: null,
      });
    }

    return sources;
  } catch {
    return [];
  }
};
