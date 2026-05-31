export type MetadataSourceName = 'goodreads' | 'googleBooks' | 'openLibrary' | 'internetArchive' | 'kobo';

export type MetadataSource = {
  id: string;
  source: MetadataSourceName;
  title: string | null;
  author: string | null;
  cover: string | null;
  blurb: string | null;
  series: string | null;
  seriesInstallment: string | null;
  genre: string | null;
  publishYear: number | null;
  publisher?: string | null;
  webReview?: string | null;
};

const importantWords = new Set([
  'a',
  'an',
  'and',
  'by',
  'for',
  'in',
  'of',
  'the',
  'to',
]);

function normalize(value?: string | null) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function normalizedKey(value?: string | null) {
  return normalize(value).replace(/[^a-z0-9]/g, '');
}

function tokens(value?: string | null) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word && !importantWords.has(word));
}

function tokenOverlapScore(target?: string | null, candidate?: string | null) {
  const targetTokens = tokens(target);
  const candidateTokens = tokens(candidate);
  if (!targetTokens.length || !candidateTokens.length) return 0;

  const candidateSet = new Set(candidateTokens);
  const matches = targetTokens.filter((token) => candidateSet.has(token)).length;
  return matches / Math.max(targetTokens.length, candidateTokens.length);
}

function authorsCompatible(targetAuthor?: string | null, candidateAuthor?: string | null) {
  const targetKey = normalizedKey(targetAuthor);
  const candidateKey = normalizedKey(candidateAuthor);
  if (!targetKey || !candidateKey) return true;
  if (targetKey === candidateKey || targetKey.includes(candidateKey) || candidateKey.includes(targetKey)) return true;
  return tokenOverlapScore(targetAuthor, candidateAuthor) >= 0.5;
}

export function scoreSource(targetTitle?: string | null, targetAuthor?: string | null, source?: Pick<MetadataSource, 'title' | 'author'> | null) {
  if (!source) return 0;

  const targetTitleKey = normalizedKey(targetTitle);
  const titleKey = normalizedKey(source.title);
  const targetAuthorKey = normalizedKey(targetAuthor);
  const authorKey = normalizedKey(source.author);
  let score = 0;

  if (targetTitleKey && titleKey) {
    if (targetTitleKey === titleKey) score += 80;
    else if (targetTitleKey.includes(titleKey) || titleKey.includes(targetTitleKey)) score += 55;
    else score += Math.round(tokenOverlapScore(targetTitle, source.title) * 45);
  }

  if (targetAuthorKey && authorKey) {
    if (targetAuthorKey === authorKey) score += 35;
    else if (targetAuthorKey.includes(authorKey) || authorKey.includes(targetAuthorKey)) score += 24;
    else score += Math.round(tokenOverlapScore(targetAuthor, source.author) * 18);
  }

  if (!targetAuthorKey && authorKey) score += 5;
  return score;
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== '';
}

function firstValue<T>(...values: Array<T | null | undefined>) {
  return values.find(hasValue) ?? null;
}

function completenessScore(source: MetadataSource) {
  return [
    source.title,
    source.author,
    source.cover,
    source.blurb,
    source.genre,
    source.publishYear,
    source.series,
    source.seriesInstallment,
    source.webReview,
  ].filter(hasValue).length;
}

function matchSource(primary: MetadataSource, candidates: MetadataSource[]) {
  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: scoreSource(primary.title, primary.author, candidate),
    }))
    .filter((entry) => authorsCompatible(primary.author, entry.candidate.author))
    .filter((entry) => entry.score >= 45 || normalizedKey(entry.candidate.title) === normalizedKey(primary.title))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return completenessScore(b.candidate) - completenessScore(a.candidate);
    });

  return ranked[0]?.candidate ?? null;
}

function mergeMetadata(primary: MetadataSource, matches: MetadataSource[], goodreadsMatch: MetadataSource | null) {
  const sources = [primary, ...matches.filter((item) => item.id !== primary.id)];
  const goodreads = goodreadsMatch?.webReview ? goodreadsMatch : null;

  return {
    googleId: primary.id,
    title: firstValue(primary.title, ...sources.map((item) => item.title)),
    author: firstValue(primary.author, ...sources.map((item) => item.author)),
    cover: firstValue(
      ...sources.filter((item) => item.source === 'googleBooks').map((item) => item.cover),
      ...sources.filter((item) => item.source === 'kobo').map((item) => item.cover),
      ...sources.filter((item) => item.source === 'openLibrary').map((item) => item.cover),
      ...sources.filter((item) => item.source === 'internetArchive').map((item) => item.cover),
      ...sources.filter((item) => item.source === 'goodreads').map((item) => item.cover),
    ),
    blurb: firstValue(
      ...sources.filter((item) => item.source === 'googleBooks').map((item) => item.blurb),
      ...sources.filter((item) => item.source === 'goodreads').map((item) => item.blurb),
      ...sources.filter((item) => item.source === 'kobo').map((item) => item.blurb),
      ...sources.filter((item) => item.source === 'internetArchive').map((item) => item.blurb),
      ...sources.filter((item) => item.source === 'openLibrary').map((item) => item.blurb),
    ),
    series: firstValue(
      ...sources.filter((item) => item.source === 'goodreads').map((item) => item.series),
      ...sources.filter((item) => item.source === 'kobo').map((item) => item.series),
      ...sources.filter((item) => item.source === 'openLibrary').map((item) => item.series),
      ...sources.filter((item) => item.source === 'googleBooks').map((item) => item.series),
      ...sources.filter((item) => item.source === 'internetArchive').map((item) => item.series),
    ),
    seriesInstallment: firstValue(
      ...sources.filter((item) => item.source === 'goodreads').map((item) => item.seriesInstallment),
      ...sources.filter((item) => item.source === 'kobo').map((item) => item.seriesInstallment),
      ...sources.filter((item) => item.source === 'openLibrary').map((item) => item.seriesInstallment),
      ...sources.filter((item) => item.source === 'googleBooks').map((item) => item.seriesInstallment),
      ...sources.filter((item) => item.source === 'internetArchive').map((item) => item.seriesInstallment),
    ),
    genre: firstValue(
      ...sources.filter((item) => item.source === 'googleBooks').map((item) => item.genre),
      ...sources.filter((item) => item.source === 'openLibrary').map((item) => item.genre),
      ...sources.filter((item) => item.source === 'internetArchive').map((item) => item.genre),
      ...sources.filter((item) => item.source === 'goodreads').map((item) => item.genre),
      ...sources.filter((item) => item.source === 'kobo').map((item) => item.genre),
    ),
    publishYear: firstValue(
      ...sources.filter((item) => item.source === 'openLibrary').map((item) => item.publishYear),
      ...sources.filter((item) => item.source === 'internetArchive').map((item) => item.publishYear),
      ...sources.filter((item) => item.source === 'googleBooks').map((item) => item.publishYear),
      ...sources.filter((item) => item.source === 'goodreads').map((item) => item.publishYear),
      ...sources.filter((item) => item.source === 'kobo').map((item) => item.publishYear),
    ),
    publisher: firstValue(
      ...sources.filter((item) => item.source === 'googleBooks').map((item) => item.publisher),
      ...sources.filter((item) => item.source === 'openLibrary').map((item) => item.publisher),
      ...sources.filter((item) => item.source === 'goodreads').map((item) => item.publisher),
      ...sources.filter((item) => item.source === 'kobo').map((item) => item.publisher),
      ...sources.filter((item) => item.source === 'internetArchive').map((item) => item.publisher),
    ),
    webReview: goodreads?.webReview ?? null,
  };
}

export function buildMetadataResults(
  targetTitle: string,
  targetAuthor: string | undefined,
  sources: Record<`${MetadataSourceName}Sources`, MetadataSource[]>,
) {
  const allSources = [
    ...sources.internetArchiveSources,
    ...sources.openLibrarySources,
    ...sources.googleBooksSources,
    ...sources.koboSources,
    ...sources.goodreadsSources,
  ];
  if (!allSources.length) return [];

  const primaries = allSources
    .map((source) => ({
      source,
      score: scoreSource(targetTitle, targetAuthor, source),
    }))
    .filter((entry) => entry.score >= 45 || normalizedKey(entry.source.title) === normalizedKey(targetTitle))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.source.source !== b.source.source) {
        const priority = ['internetArchive', 'openLibrary', 'googleBooks', 'kobo', 'goodreads'];
        return priority.indexOf(a.source.source) - priority.indexOf(b.source.source);
      }
      return completenessScore(b.source) - completenessScore(a.source);
    })
    .map((entry) => entry.source);

  const fallbackPrimaries = primaries.length ? primaries : allSources;
  const targetGoodreads = sources.goodreadsSources
    .map((source) => ({
      source,
      score: scoreSource(targetTitle, targetAuthor, source),
    }))
    .filter((entry) => entry.source.webReview && (entry.score >= 60 || normalizedKey(entry.source.title) === normalizedKey(targetTitle)))
    .sort((a, b) => b.score - a.score || completenessScore(b.source) - completenessScore(a.source))[0]?.source ?? null;
  const seen = new Set<string>();

  return fallbackPrimaries
    .map((primary) => {
      const canUseSearchedGoodreads = !targetAuthor || scoreSource(targetTitle, targetAuthor, primary) >= 90;
      const goodreads = primary.source === 'goodreads'
        ? primary
        : (matchSource(primary, sources.goodreadsSources) ?? (canUseSearchedGoodreads ? targetGoodreads : null));
      const googleBooks = primary.source === 'googleBooks' ? primary : matchSource(primary, sources.googleBooksSources);
      const openLibrary = primary.source === 'openLibrary' ? primary : matchSource(primary, sources.openLibrarySources);
      const internetArchive = primary.source === 'internetArchive' ? primary : matchSource(primary, sources.internetArchiveSources);
      const kobo = primary.source === 'kobo' ? primary : matchSource(primary, sources.koboSources);

      return mergeMetadata(primary, [goodreads, googleBooks, openLibrary, internetArchive, kobo].filter(Boolean) as MetadataSource[], goodreads);
    })
    .filter((item) => {
      const key = `${normalizedKey(item.title)}:${normalizedKey(item.author)}`;
      if (!key.replace(':', '') || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}
