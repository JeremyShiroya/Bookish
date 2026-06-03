const compact = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const normalizeKey = (value) => compact(value).toLowerCase().replace(/[^a-z0-9]/g, '');

const firstValue = (...values) => values.find((value) => value !== null && value !== undefined && value !== '') ?? null;

const parseYear = (...values) => {
  for (const value of values) {
    const match = compact(value).match(/\b(15|16|17|18|19|20)\d{2}\b/);
    if (match) return Number(match[0]);
  }
  return null;
};

const normalizeArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
};

const normalizeCreator = (value) => {
  const creator = normalizeArray(value)[0]?.replace(/\b\d{4}-?\d{0,4}\b/g, '').replace(/\s+/g, ' ').trim();
  if (!creator) return null;
  const parts = creator.split(',').map((part) => part.trim()).filter(Boolean);
  return parts.length >= 2 ? `${parts[1]} ${parts[0]}`.replace(/\s+/g, ' ').trim() : creator;
};

const normalizeDescription = (value) => normalizeArray(value)
  .map((item) => item.replace(/\s+/g, ' ').trim())
  .find((item) => item.length > 40 && !/^\d+\s+pages?\b/i.test(item)) || null;

const normalizeGenre = (value) => {
  const seen = new Set();
  return normalizeArray(value)
    .flatMap((item) => item.split(';'))
    .map((item) => item.replace(/\s*--.*$/, '').replace(/\s+/g, ' ').trim())
    .filter((item) => item && item.length <= 40 && !/(accessible book|internet archive|protected daisy|large type|overdrive|translation)/i.test(item))
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3)
    .join(', ') || null;
};

const scoreResult = (title, author, result) => {
  let score = 0;
  const targetTitle = normalizeKey(title);
  const resultTitle = normalizeKey(result.title);
  const targetAuthor = normalizeKey(author);
  const resultAuthor = normalizeKey(result.author);

  if (targetTitle && resultTitle) {
    if (targetTitle === resultTitle) score += 80;
    else if (resultTitle.includes(targetTitle) || targetTitle.includes(resultTitle)) score += 50;
  }
  if (targetAuthor && resultAuthor) {
    if (targetAuthor === resultAuthor) score += 35;
    else if (resultAuthor.includes(targetAuthor) || targetAuthor.includes(resultAuthor)) score += 20;
  }
  if (result.cover) score += 5;
  if (result.blurb) score += 5;
  return score;
};

const solrValue = (value) => `"${String(value).replace(/"/g, '\\"')}"`;

const fetchInternetArchiveDetails = async (identifier) => {
  try {
    const response = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

const searchInternetArchive = async (title, author) => {
  const queries = [
    `title:(${solrValue(title)}) AND mediatype:texts`,
  ];
  if (author) {
    queries.unshift(`title:(${solrValue(title)}) AND creator:(${solrValue(author)}) AND mediatype:texts`);
  }
  const docs = [];
  const seen = new Set();

  for (const q of queries) {
    try {
      const params = new URLSearchParams({ q, rows: '6', output: 'json' });
      ['title', 'creator', 'year', 'identifier', 'description', 'subject'].forEach((field) => params.append('fl[]', field));
      const response = await fetch(`https://archive.org/advancedsearch.php?${params.toString()}`);
      if (!response.ok) continue;
      const data = await response.json();
      for (const doc of data.response?.docs || []) {
        if (!doc.identifier || seen.has(doc.identifier)) continue;
        seen.add(doc.identifier);
        docs.push(doc);
      }
    } catch {}
  }

  const details = await Promise.all(docs.slice(0, 6).map((doc) => fetchInternetArchiveDetails(doc.identifier)));
  return docs.slice(0, 6).map((doc, index) => {
    const metadata = details[index]?.metadata || {};
    const identifier = doc.identifier || metadata.identifier;
    const publisherRaw = metadata.publisher || doc.publisher;
    const publisher = Array.isArray(publisherRaw) ? compact(publisherRaw[0]) : compact(publisherRaw);
    return {
      googleId: `ia:${identifier}`,
      title: compact(metadata.title || doc.title),
      author: normalizeCreator(metadata.creator || doc.creator),
      cover: identifier ? `https://archive.org/services/img/${encodeURIComponent(identifier)}` : null,
      blurb: normalizeDescription(metadata.description || doc.description),
      series: null,
      seriesInstallment: null,
      genre: normalizeGenre(metadata.subject || doc.subject),
      publishYear: parseYear(metadata.year, metadata.date, doc.year),
      publisher: publisher || null,
      webReview: null,
    };
  }).filter((item) => item.title);
};

const fetchOpenLibraryWork = async (key) => {
  try {
    const response = await fetch(`https://openlibrary.org${key}.json`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

const searchOpenLibrary = async (title, author) => {
  try {
    const params = new URLSearchParams({ title, limit: '8' });
    if (author) params.set('author', author);
    const response = await fetch(`https://openlibrary.org/search.json?${params.toString()}`);
    if (!response.ok) return [];
    const data = await response.json();
    const docs = (data.docs || []).slice(0, 8);
    const details = await Promise.all(docs.map((doc) => fetchOpenLibraryWork(doc.key)));
    return docs.map((doc, index) => ({
      googleId: doc.key,
      title: doc.title || null,
      author: doc.author_name?.join(', ') || null,
      cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
      blurb: typeof details[index]?.description === 'string'
        ? details[index].description
        : details[index]?.description?.value || null,
      series: doc.series_name?.[0] || null,
      seriesInstallment: doc.series_position?.[0] || null,
      genre: normalizeGenre([...(doc.subject || []), ...(details[index]?.subjects || [])]),
      publishYear: doc.first_publish_year || null,
      publisher: Array.isArray(doc.publisher) ? compact(doc.publisher[0]) : compact(doc.publisher) || null,
      webReview: null,
    })).filter((item) => item.title);
  } catch {
    return [];
  }
};

const mergeResults = (title, author, sources) => {
  const seen = new Set();
  return sources
    .flat()
    .sort((a, b) => scoreResult(title, author, b) - scoreResult(title, author, a))
    .map((item) => {
      const matches = sources.flat().filter((candidate) => (
        normalizeKey(candidate.title) === normalizeKey(item.title)
        && (!candidate.author || !item.author || normalizeKey(candidate.author) === normalizeKey(item.author))
      ));
      return {
        googleId: item.googleId,
        title: firstValue(item.title, ...matches.map((match) => match.title)),
        author: firstValue(item.author, ...matches.map((match) => match.author)),
        cover: firstValue(item.cover, ...matches.map((match) => match.cover)),
        blurb: firstValue(item.blurb, ...matches.map((match) => match.blurb)),
        series: firstValue(item.series, ...matches.map((match) => match.series)),
        seriesInstallment: firstValue(item.seriesInstallment, ...matches.map((match) => match.seriesInstallment)),
        genre: firstValue(item.genre, ...matches.map((match) => match.genre)),
        publishYear: firstValue(item.publishYear, ...matches.map((match) => match.publishYear)),
        publisher: firstValue(item.publisher, ...matches.map((match) => match.publisher)),
        webReview: null,
      };
    })
    .filter((item) => {
      const key = `${normalizeKey(item.title)}:${normalizeKey(item.author)}`;
      if (!key.replace(':', '') || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
};

const readStreamingMetadataResponse = async (response, onProgress) => {
  if (!response.body) {
    const data = await response.json();
    return data.results || [];
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let results = [];

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line);
      if (event.type === 'step') {
        onProgress?.(event);
      } else if (event.type === 'result') {
        results = event.results || [];
      } else if (event.type === 'error') {
        throw new Error(event.message || 'Failed to fetch metadata from the web.');
      }
    }
  }

  if (buffer.trim()) {
    const event = JSON.parse(buffer);
    if (event.type === 'result') results = event.results || [];
    if (event.type === 'step') onProgress?.(event);
    if (event.type === 'error') throw new Error(event.message || 'Failed to fetch metadata from the web.');
  }

  return results;
};

export const fetchBookMetadataResults = async (title, author, publisher, options = {}) => {
  const params = new URLSearchParams({ title });
  if (author) params.set('author', author);
  if (publisher) params.set('publisher', publisher);
  if (options.onProgress) params.set('stream', '1');

  try {
    const response = await fetch(`/api/books/metadata?${params.toString()}`);
    if (!response.ok) throw new Error(`Metadata request failed with ${response.status}`);
    if (options.onProgress) {
      const streamedResults = await readStreamingMetadataResponse(response, options.onProgress);
      return streamedResults;
    } else {
      const data = await response.json();
      if (data.results?.length) return data.results;
    }
  } catch (error) {
    options.onProgress?.({ type: 'step', id: 'core', status: 'error', detail: error?.message || 'Metadata endpoint failed' });
    options.onProgress?.({ type: 'step', id: 'publisherSearch', status: 'skipped', detail: 'Skipped because the metadata endpoint failed' });
    options.onProgress?.({ type: 'step', id: 'publisherScrape', status: 'skipped', detail: 'Skipped because the metadata endpoint failed' });
  }

  const [internetArchiveResults, openLibraryResults] = await Promise.all([
    searchInternetArchive(title, author),
    searchOpenLibrary(title, author),
  ]);
  return mergeResults(title, author, [internetArchiveResults, openLibraryResults]);
};
