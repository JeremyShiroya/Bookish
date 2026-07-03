import { useApiEndpoint } from '~/composables/useApiEndpoint';

const imageExtensions = /\.(jpe?g|png|webp)(?:[?#].*)?$/i;

const normalizeImageUrl = (url) => {
  if (!url) return null;
  return String(url).replace(/^http:\/\//i, 'https://').replace(/^\/\//, 'https://').trim();
};

const isUsefulAuthorImage = (url) => {
  const normalized = normalizeImageUrl(url);
  if (!normalized) return false;
  const lower = normalized.toLowerCase();
  return (
    (
      imageExtensions.test(lower)
      || lower.includes('wikimedia.org')
      || lower.includes('covers.openlibrary.org/a/')
    )
    && !/(svg|icon|logo|book[_ -]?cover|novel|signature|map|badge|sprite|placeholder|nophoto|no[_-]?image)/i.test(lower)
  );
};

const addImage = (images, seen, url) => {
  const normalized = normalizeImageUrl(url);
  if (!isUsefulAuthorImage(normalized)) return;
  const key = normalized.replace(/[?#].*$/, '').toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  images.push(normalized);
};

export const normalizeAuthorImageResults = (results = []) => {
  const output = [];
  const seen = new Set();

  for (const result of results) {
    const item = typeof result === 'string'
      ? { url: result, source: 'unknown', label: 'Web image' }
      : {
          url: result?.url,
          source: result?.source || 'unknown',
          label: result?.label || 'Web image',
        };
    const normalized = normalizeImageUrl(item.url);
    if (!normalized) continue;
    const key = normalized.replace(/[?#].*$/, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({ ...item, url: normalized });
  }

  return output;
};

const imageInfoForFiles = async (fileTitles) => {
  if (!fileTitles.length) return [];
  try {
    const titles = fileTitles
      .map((title) => title.startsWith('File:') ? title : `File:${title}`)
      .slice(0, 24)
      .join('|');
    const response = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1000&format=json&origin=*`,
    );
    if (!response.ok) return [];
    const data = await response.json();
    return Object.values(data.query?.pages || {})
      .map((page) => page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url)
      .filter(Boolean);
  } catch {
    return [];
  }
};

const findWikipediaSummaryImages = async (name) => {
  const titles = [name, `${name} (writer)`, `${name} (author)`, `${name} (novelist)`];
  const images = [];

  for (const title of titles) {
    try {
      const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/\s+/g, '_'))}`);
      if (!response.ok) continue;
      const data = await response.json();
      images.push(data?.originalimage?.source, data?.thumbnail?.source);
    } catch {}
  }

  return images.filter(Boolean);
};

const findWikidataImages = async (name) => {
  try {
    const searchResponse = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&format=json&origin=*`,
    );
    if (!searchResponse.ok) return [];
    const search = await searchResponse.json();
    const ids = (search.search || []).slice(0, 5).map((item) => item.id).filter(Boolean);
    if (!ids.length) return [];

    const entityResponse = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(ids.join('|'))}&props=claims&format=json&origin=*`,
    );
    if (!entityResponse.ok) return [];
    const entityData = await entityResponse.json();
    const files = ids
      .map((id) => entityData.entities?.[id]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value)
      .filter(Boolean);
    return imageInfoForFiles(files);
  } catch {
    return [];
  }
};

const findOpenLibraryAuthorImages = async (name) => {
  try {
    const response = await fetch(`https://openlibrary.org/search/authors.json?q=${encodeURIComponent(name)}&limit=8`);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.docs || []).flatMap((doc) => {
      const photos = Array.isArray(doc.photos) ? doc.photos : [];
      return photos.map((photo) => `https://covers.openlibrary.org/a/id/${photo}-L.jpg`);
    });
  } catch {
    return [];
  }
};

export const fetchAuthorImageResults = async (name) => {
  const { apiUrl } = useApiEndpoint();
  const images = [];
  const seen = new Set();

  try {
    const response = await fetch(apiUrl(`/api/authors/search-images?name=${encodeURIComponent(name)}`));
    const data = await response.json();
    const normalizedResults = normalizeAuthorImageResults(data.images || []);
    if (normalizedResults.length) return normalizedResults;
  } catch {}

  const [wikipedia, wikidata, openLibrary] = await Promise.all([
    findWikipediaSummaryImages(name),
    findWikidataImages(name),
    findOpenLibraryAuthorImages(name),
  ]);

  [...wikipedia, ...wikidata, ...openLibrary].forEach((url) => addImage(images, seen, url));
  return normalizeAuthorImageResults(images.slice(0, 24));
};
