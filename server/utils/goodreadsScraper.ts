import * as cheerio from 'cheerio';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

export interface GoodreadsSearchResult {
  url: string;
  title: string;
  rawTitle: string;
  author: string | null;
  cover: string | null;
  rawSeriesTitle: string | null;
  series: string | null;
  seriesInstallment: string | null;
  seriesTotal: string | null;
  webReview: string | null;
  ratingValue: string | null;
  ratingCount: string | null;
  reviewCount: string | null;
}

export interface GoodreadsBookDetails {
  title: string | null;
  author: string | null;
  blurb: string | null;
  cover: string | null;
  series: string | null;
  seriesInstallment: string | null;
  seriesTotal: string | null;
  seriesUrl: string | null;
  webReview: string | null;
  ratingValue: string | null;
  ratingCount: string | null;
  reviewCount: string | null;
  publishYear: number | null;
  genre: string | null;
}

const ABSOLUTE = /^https?:\/\//i;
const GOODREADS_CACHE_TTL_MS = 5 * 60 * 1000;
const goodreadsSearchCache = new Map<string, { expiresAt: number; results: GoodreadsSearchResult[] }>();
const goodreadsSearchInFlight = new Map<string, Promise<GoodreadsSearchResult[]>>();

function compact(value?: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function absoluteGoodreadsUrl(url?: string | null) {
  if (!url) return null;
  return ABSOLUTE.test(url) ? url : `https://www.goodreads.com${url}`;
}

function normalizeGoodreadsPageUrl(url?: string | null) {
  const full = absoluteGoodreadsUrl(url);
  return full ? full.split('?')[0].split('#')[0] : null;
}

export function normalizeGoodreadsImage(url?: string | null) {
  if (!url) return null;
  const cleaned = String(url)
    .replace(/^http:\/\//i, 'https://')
    .replace(/\._[A-Z]{1,3}\d+(?:_[A-Z]{1,3}\d+)?_\./, '.')
    .replace(/\._SX\d+_SY\d+_\./, '.')
    .replace(/\._SY\d+_\./, '.')
    .replace(/\._SX\d+_\./, '.');
  return cleaned.includes('nophoto') ? null : cleaned;
}

export function parseSeriesFromText(value?: string | null) {
  const text = compact(value);
  if (!text) return { series: null as string | null, seriesInstallment: null as string | null, seriesTotal: null as string | null };

  // "Book #1 of 6 in/of [the] Series Name [series]"
  const bookOfTotal = text.match(/book\s*#?\s*([\d.]+)\s+of\s+([\d.]+)\s+(?:in\s+)?(?:the\s+)?(.+?)(?:\s+series)?$/i);
  if (bookOfTotal) {
    return {
      series: compact(bookOfTotal[3]).replace(/\s+series$/i, '') || null,
      seriesInstallment: bookOfTotal[1],
      seriesTotal: bookOfTotal[2],
    };
  }

  // "Book #1 in/of [the] Series Name [series]"
  const bookInSeries = text.match(/book\s*#?\s*([\d.]+)\s+(?:in|of)\s+(?:the\s+)?(.+?)(?:\s+series)?$/i);
  if (bookInSeries) {
    return {
      series: compact(bookInSeries[2]).replace(/\s+series$/i, '') || null,
      seriesInstallment: bookInSeries[1],
      seriesTotal: null,
    };
  }

  // "Series Name #1 of 6" or "Series Name, #1 of 6"
  const namedNumberWithTotal = text.match(/^(.+?)(?:,\s*)?#\s*([\d.]+)\s+of\s+([\d.]+)$/i);
  if (namedNumberWithTotal) {
    return {
      series: compact(namedNumberWithTotal[1]).replace(/\s+series$/i, '') || null,
      seriesInstallment: namedNumberWithTotal[2],
      seriesTotal: namedNumberWithTotal[3],
    };
  }

  // "Series Name #1" or "Series Name, #1" or "Series Name book 1"
  const namedNumber = text.match(/^(.+?)(?:,\s*)?#\s*([\d.]+)$/i) || text.match(/^(.+?)\s+book\s+([\d.]+)$/i);
  if (namedNumber) {
    return {
      series: compact(namedNumber[1]).replace(/\s+series$/i, '') || null,
      seriesInstallment: namedNumber[2],
      seriesTotal: null,
    };
  }

  return { series: text.replace(/\s+series$/i, '') || null, seriesInstallment: null, seriesTotal: null };
}

export function parseGoodreadsSeriesTotal(html: string) {
  const $ = cheerio.load(html);
  let text = compact($('.responsiveSeriesHeader__subtitle').first().text());

  if (!text) {
    const rawProps = $('[data-react-class="ReactComponents.SeriesHeader"]').first().attr('data-react-props');
    if (rawProps) {
      try {
        text = compact(JSON.parse(rawProps).subtitle);
      } catch {
        text = '';
      }
    }
  }

  const match = text.match(/\b([\d,]+)\s+primary\s+works?\b/i);
  if (!match) return null;

  const total = Number(match[1].replace(/,/g, ''));
  return Number.isSafeInteger(total) && total > 0 ? String(total) : null;
}

export function splitGoodreadsTitle(rawTitle?: string | null) {
  const raw = compact(rawTitle);
  const match = raw.match(/^(.*?)\s*\(([^()]*(?:#|book\s*)\s*[\d.][^()]*)\)\s*$/i);
  if (!match) {
    return { title: raw, rawSeriesTitle: null as string | null, series: null as string | null, seriesInstallment: null as string | null, seriesTotal: null as string | null };
  }

  const parsed = parseSeriesFromText(match[2]);
  return {
    title: compact(match[1]),
    rawSeriesTitle: compact(match[2]),
    series: parsed.series,
    seriesInstallment: parsed.seriesInstallment,
    seriesTotal: parsed.seriesTotal,
  };
}

function parseYear(value?: string | null) {
  const match = compact(value).match(/\b(15|16|17|18|19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : null;
}

function cleanCount(value?: string | null) {
  const match = compact(value).match(/[\d,.]+(?:\s*(?:thousand|million|billion|[kmb]))?/i);
  return match?.[0]?.replace(/\s+/g, ' ') || null;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function formatGoodreadsReview(ratingValue?: string | null, ratingCount?: string | null, reviewCount?: string | null) {
  if (!ratingValue) return null;

  const counts = [
    ratingCount ? `${ratingCount} ratings` : null,
    reviewCount ? `${reviewCount} reviews` : null,
  ].filter(Boolean);

  return `Goodreads Rating: ${ratingValue}/5${counts.length ? ` (${counts.join(', ')}).` : '.'}`;
}

function parseRatingFromText(value?: string | null) {
  const text = compact(value);
  if (!text) {
    return {
      ratingValue: null as string | null,
      ratingCount: null as string | null,
      reviewCount: null as string | null,
      webReview: null as string | null,
    };
  }

  const ratingMatch =
    text.match(/(?:avg\s+rating|rating)(?:\s+of)?(?:\s+approximately|\s+about)?\s+([\d.]+)/i)
    || text.match(/\b([\d.]+)\s+(?:out\s+of\s+5(?:\s+stars?)?|avg)\b/i);
  const ratingValue =
    ratingMatch?.[1]
    || text.match(/\b([1-5]\.\d{1,2})\b(?=.*\b(?:ratings?|reviews?)\b)/i)?.[1]
    || null;
  const countPattern = /(?:over\s+|more\s+than\s+|approximately\s+|about\s+)?[\d,.]+\s*(?:thousand|million|billion|[kmb])?\s+(?:ratings?|reviews?)/ig;
  const counts = [...text.matchAll(countPattern)].map(match => match[0]);
  const ratingCount = cleanCount(counts.find(value => /\bratings?\b/i.test(value)));
  const reviewCount = cleanCount(counts.find(value => /\breviews?\b/i.test(value)));
  const webReview = formatGoodreadsReview(ratingValue, ratingCount, reviewCount);

  return { ratingValue, ratingCount, reviewCount, webReview };
}

function parseJsonLdBooks($: cheerio.CheerioAPI) {
  const books: any[] = [];

  const visit = (node: any) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node !== 'object') return;
    const type = node['@type'];
    const typeList = Array.isArray(type) ? type : [type];
    if (typeList.some((entry) => /book/i.test(String(entry || '')))) books.push(node);
    if (node['@graph']) visit(node['@graph']);
  };

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      visit(JSON.parse($(el).html() || ''));
    } catch {}
  });

  return books;
}

function getAuthorName(author: any) {
  if (!author) return null;
  if (typeof author === 'string') return compact(author) || null;
  if (Array.isArray(author)) return getAuthorName(author[0]);
  return compact(author.name) || null;
}

function firstText($: cheerio.CheerioAPI, selectors: string[]) {
  for (const selector of selectors) {
    const text = compact($(selector).first().text());
    if (text) return text;
  }
  return null;
}

function firstAttr($: cheerio.CheerioAPI, selectors: string[], attr: string) {
  for (const selector of selectors) {
    const value = compact($(selector).first().attr(attr));
    if (value) return value;
  }
  return null;
}

export function parseGoodreadsSearchHtml(html: string): GoodreadsSearchResult[] {
  const $ = cheerio.load(html);
  const results: GoodreadsSearchResult[] = [];
  const seen = new Set<string>();

  const pushResult = (url: string | null, rawTitle: string, author: string | null, cover: string | null, ratingText?: string | null) => {
    const fullUrl = absoluteGoodreadsUrl(url);
    if (!fullUrl || seen.has(fullUrl) || !rawTitle) return;
    seen.add(fullUrl);
    const split = splitGoodreadsTitle(rawTitle);
    const rating = parseRatingFromText(ratingText);
    results.push({
      url: fullUrl,
      title: split.title || rawTitle,
      rawTitle,
      author: author || null,
      cover: normalizeGoodreadsImage(cover),
      rawSeriesTitle: split.rawSeriesTitle,
      series: split.series,
      seriesInstallment: split.seriesInstallment,
      seriesTotal: split.seriesTotal,
      webReview: rating.webReview,
      ratingValue: rating.ratingValue,
      ratingCount: rating.ratingCount,
      reviewCount: rating.reviewCount,
    });
  };

  $('tr[itemtype="http://schema.org/Book"], tr[itemtype="https://schema.org/Book"]').each((_, el) => {
    const row = $(el);
    const titleEl = row.find('a.bookTitle').first();
    const rawTitle =
      compact(titleEl.find('span[itemprop="name"]').text())
      || compact(titleEl.text());
    pushResult(
      titleEl.attr('href') || null,
      rawTitle,
      compact(row.find('a.authorName span[itemprop="name"], a.authorName').first().text()) || null,
      row.find('img.bookCover, img').first().attr('src') || null,
      compact(row.find('.minirating').first().text()) || null,
    );
  });

  $('a[href*="/book/show/"]').each((_, el) => {
    if (results.length >= 8) return;
    const anchor = $(el);
    const rawTitle = compact(anchor.find('[itemprop="name"]').text()) || compact(anchor.attr('aria-label')) || compact(anchor.text());
    if (!rawTitle || rawTitle.length > 180) return;
    const container = anchor.closest('tr, li, article, div');
    const author =
      compact(container.find('a[href*="/author/show/"], a.authorName').first().text())
      || compact(anchor.closest('tr').find('a.authorName').first().text())
      || null;
    const cover = container.find('img[src*="gr-assets"], img[src*="goodreads"], img.bookCover, img').first().attr('src') || null;
    pushResult(anchor.attr('href') || null, rawTitle, author, cover, compact(container.find('.minirating').first().text()) || null);
  });

  return results.slice(0, 8);
}

function goodreadsUrlFromSearchHref(value?: string | null) {
  if (!value) return null;
  const decoded = decodeHtmlEntities(value);
  try {
    const url = decoded.startsWith('//') ? `https:${decoded}` : decoded;
    const parsed = new URL(url, 'https://duckduckgo.com');
    const redirected = parsed.searchParams.get('uddg');
    const candidate = redirected ? decodeURIComponent(redirected) : url;
    return candidate.includes('goodreads.com/book/show') ? normalizeGoodreadsPageUrl(candidate) : null;
  } catch {
    const match = decoded.match(/https?:\/\/(?:www\.)?goodreads\.com\/book\/show\/[^"'&<>\s]+/i);
    return normalizeGoodreadsPageUrl(match?.[0]);
  }
}

function cleanSearchTitle(value?: string | null) {
  return compact(value)
    .replace(/\s*\|\s*Goodreads.*$/i, '')
    .replace(/\s+by\s+.+$/i, '')
    .replace(/^Goodreads\s*[:|-]\s*/i, '');
}

function normalizedMatchKey(value?: string | null) {
  return compact(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function parseGoodreadsProxySearchText(
  value: string,
  title: string,
  author: string | undefined,
  resolvedUrl: string,
): GoodreadsSearchResult | null {
  const text = compact(value);
  const titleKey = normalizedMatchKey(title);
  const authorKey = normalizedMatchKey(author);
  const textKey = normalizedMatchKey(text);
  if (!titleKey || !textKey.includes(titleKey)) return null;
  if (authorKey && !textKey.includes(authorKey)) return null;

  const ratingPattern = /\b([1-5]\.\d{1,2})\s+(?:out\s+of\s+5(?:\s+stars?)?\s+)?([\d,]+)\s+ratings?\s+([\d,]+)\s+reviews?\b/i;
  const ratingMatch = text.match(ratingPattern);
  if (!ratingMatch) return null;

  const ratingValue = ratingMatch[1];
  const ratingCount = ratingMatch[2];
  const reviewCount = ratingMatch[3];
  const split = splitGoodreadsTitle(title);

  return {
    url: normalizeGoodreadsPageUrl(resolvedUrl) || resolvedUrl,
    title: split.title || compact(title),
    rawTitle: compact(title),
    author: compact(author) || null,
    cover: null,
    rawSeriesTitle: split.rawSeriesTitle,
    series: split.series,
    seriesInstallment: split.seriesInstallment,
    seriesTotal: split.seriesTotal,
    webReview: formatGoodreadsReview(ratingValue, ratingCount, reviewCount),
    ratingValue,
    ratingCount,
    reviewCount,
  };
}

async function fetchGoodreadsProxyResult(
  title: string,
  author: string | undefined,
  resolvedUrl: string,
) {
  try {
    const query = [
      resolvedUrl,
      title,
      author,
      'Goodreads rating ratings reviews',
    ].filter(Boolean).join(' ');
    const proxyUrl = `https://r.jina.ai/http://www.google.com/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(proxyUrl, { headers });
    if (!response.ok) return null;
    return parseGoodreadsProxySearchText(await response.text(), title, author, resolvedUrl);
  } catch {
    return null;
  }
}

export function parseGoodreadsYahooSearchHtml(
  html: string,
  title: string,
  author: string | undefined,
  resolvedUrl: string,
): GoodreadsSearchResult | null {
  const $ = cheerio.load(html);
  const titleKey = normalizedMatchKey(title);
  const authorTokens = compact(author)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(token => token.length > 1);
  const relevantRows: string[] = [];

  $('#web .dd, #web .algo, .web-res, .algo').each((_, element) => {
    const text = compact($(element).text());
    const textKey = normalizedMatchKey(text);
    if (!text || !/goodreads/i.test(text) || !textKey.includes(titleKey)) return;
    if (authorTokens.length && !authorTokens.every(token => text.toLowerCase().includes(token))) return;
    relevantRows.push(text);
  });

  if (!relevantRows.length) return null;
  const rating = parseRatingFromText(relevantRows.join(' '));
  if (!rating.ratingValue) return null;

  const split = splitGoodreadsTitle(title);
  return {
    url: normalizeGoodreadsPageUrl(resolvedUrl) || resolvedUrl,
    title: split.title || compact(title),
    rawTitle: compact(title),
    author: compact(author) || null,
    cover: null,
    rawSeriesTitle: split.rawSeriesTitle,
    series: split.series,
    seriesInstallment: split.seriesInstallment,
    seriesTotal: split.seriesTotal,
    webReview: rating.webReview,
    ratingValue: rating.ratingValue,
    ratingCount: rating.ratingCount,
    reviewCount: rating.reviewCount,
  };
}

async function fetchGoodreadsSearchFallback(
  title: string,
  author: string | undefined,
  resolvedUrl: string,
) {
  const proxyResult = await fetchGoodreadsProxyResult(title, author, resolvedUrl);
  if (proxyResult) return proxyResult;

  const queries = [
    [
      `"${title}"`,
      author ? `"${author}"` : null,
      'Goodreads rating ratings reviews',
    ],
    [
      `"${title}"`,
      author ? `"${author}"` : null,
      '"out of 5"',
      'Goodreads',
    ],
    [
      `"${title}"`,
      author ? `"${author}"` : null,
      'Goodreads average rating',
    ],
  ].map(parts => parts.filter(Boolean).join(' '));

  for (const query of queries) {
    try {
      const response = await fetch(
        `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`,
        { headers },
      );
      if (!response.ok) continue;
      const result = parseGoodreadsYahooSearchHtml(await response.text(), title, author, resolvedUrl);
      if (result) return result;
    } catch {
      // Try the next search wording.
    }
  }

  return null;
}

export function parseGoodreadsDiscoveryHtml(html: string): GoodreadsSearchResult[] {
  const $ = cheerio.load(html);
  const results: GoodreadsSearchResult[] = [];
  const seen = new Set<string>();

  const push = (href?: string | null, titleText?: string | null, snippetText?: string | null) => {
    if (results.length >= 8) return;
    const url = goodreadsUrlFromSearchHref(href);
    if (!url || seen.has(url)) return;
    const rawTitle = cleanSearchTitle(titleText) || compact(titleText) || 'Goodreads Book';
    const snippet = compact(snippetText);
    const author = compact(titleText).match(/\s+by\s+([^|]+?)(?:\s+\||$)/i)?.[1]?.trim() || null;
    const rating = parseRatingFromText(snippet);
    seen.add(url);
    results.push({
      url,
      title: rawTitle,
      rawTitle,
      author,
      cover: null,
      rawSeriesTitle: null,
      series: null,
      seriesInstallment: null,
      seriesTotal: null,
      webReview: rating.webReview,
      ratingValue: rating.ratingValue,
      ratingCount: rating.ratingCount,
      reviewCount: rating.reviewCount,
    });
  };

  $('.result, .web-result, article, div').each((_, el) => {
    const row = $(el);
    const link = row.find('a.result__a, a[href*="goodreads.com/book/show"], a[href*="uddg="]').first();
    if (!link.length) return;
    const href = link.attr('href');
    if (!goodreadsUrlFromSearchHref(href)) return;
    push(href, link.text(), row.find('.result__snippet, .snippet, [class*="snippet"]').first().text());
  });

  $('a[href*="goodreads.com/book/show"], a[href*="uddg="]').each((_, el) => {
    const link = $(el);
    push(link.attr('href'), link.text(), link.closest('div').text());
  });

  return results;
}

async function searchGoodreadsTitleRedirects(title: string, author?: string): Promise<GoodreadsSearchResult[]> {
  const queries = [
    author ? `${title} ${author}` : null,
    title,
  ].filter(Boolean) as string[];
  const results: GoodreadsSearchResult[] = [];
  const seen = new Set<string>();

  for (const value of queries) {
    try {
      const response = await fetch(`https://www.goodreads.com/book/title?id=${encodeURIComponent(value)}`, { headers });
      const url = normalizeGoodreadsPageUrl(response.url);
      // Goodreads serves an HTTP 202 anti-bot interstitial (no book data) when
      // it throttles a request. Treating that as success would short-circuit
      // the /search and DuckDuckGo fallbacks that can still read a rating from
      // result snippets — so require a real 200 response that actually parsed
      // into a book (title or rating), not the data-less interstitial.
      if (!url || seen.has(url)) continue;

      if (response.status !== 200) {
        const fallbackResult = await fetchGoodreadsSearchFallback(title, author, url);
        if (fallbackResult) {
          seen.add(url);
          results.push(fallbackResult);
          break;
        }
        continue;
      }

      const details = parseGoodreadsBookHtml(await response.text());
      if (!details.title && !details.ratingValue) continue;
      const split = splitGoodreadsTitle(details.title || title);
      seen.add(url);
      results.push({
        url,
        title: split.title || details.title || title,
        rawTitle: details.title || title,
        author: details.author || author || null,
        cover: details.cover,
        rawSeriesTitle: split.rawSeriesTitle,
        series: details.series || split.series,
        seriesInstallment: details.seriesInstallment || split.seriesInstallment,
        seriesTotal: details.seriesTotal || split.seriesTotal,
        webReview: details.webReview,
        ratingValue: details.ratingValue,
        ratingCount: details.ratingCount,
        reviewCount: details.reviewCount,
      });
      break;
    } catch {}
  }

  return results;
}

export function parseGoodreadsBookHtml(html: string, seed?: Partial<GoodreadsSearchResult>): GoodreadsBookDetails {
  const $ = cheerio.load(html);
  const ld = parseJsonLdBooks($)[0] || {};
  const splitTitle = splitGoodreadsTitle(seed?.rawTitle || seed?.title || '');

  const ldRating = ld.aggregateRating || {};
  const title =
    compact(ld.name)
    || firstText($, ['h1[data-testid="bookTitle"]', 'h1.BookPageTitleSection__title', 'h1'])
    || seed?.title
    || null;

  const author =
    getAuthorName(ld.author)
    || firstText($, ['span.ContributorLink__name', 'a.ContributorLink', 'a.authorName', '[data-testid="name"]'])
    || seed?.author
    || null;

  const blurb =
    compact(typeof ld.description === 'string' ? ld.description : ld.description?.value)
    || firstText($, [
      'div[data-testid="description"] span.Formatted',
      'div[data-testid="description"]',
      '.BookPageMetadataSection__description .Formatted',
      '#description span:last-child',
      '#description',
      '.DetailsLayoutRightParagraph__widthConstrained',
    ]);

  const cover =
    normalizeGoodreadsImage(
      firstAttr($, ['meta[property="og:image"]'], 'content')
      || (Array.isArray(ld.image) ? ld.image[0] : ld.image)
      || firstAttr($, ['img.ResponsiveImage', '[data-testid="coverImage"] img', 'img[itemprop="image"]'], 'src')
      || seed?.cover
    );

  let series = splitTitle.series || seed?.series || null;
  let seriesInstallment = splitTitle.seriesInstallment || seed?.seriesInstallment || null;
  let seriesTotal = splitTitle.seriesTotal || null;
  const seriesCandidates: string[] = [];
  $('h3[aria-label], [class*="Series"]:not(a), [data-testid*="series"]:not(a)').each((_, el) => {
    const value = compact($(el).attr('aria-label')) || compact($(el).text());
    if (value) seriesCandidates.push(value);
  });
  for (const value of seriesCandidates) {
    if (series && seriesInstallment && seriesTotal) break;
    const parsed = parseSeriesFromText(value);
    if (!series && parsed.series) series = parsed.series;
    if (!seriesInstallment && parsed.seriesInstallment) seriesInstallment = parsed.seriesInstallment;
    if (!seriesTotal && parsed.seriesTotal) seriesTotal = parsed.seriesTotal;
  }

  if (!series) {
    $('a[href*="/series/"]').each((_, el) => {
      if (series) return;
      const parsed = parseSeriesFromText(compact($(el).text()));
      if (parsed.series) series = parsed.series;
      if (!seriesInstallment && parsed.seriesInstallment) seriesInstallment = parsed.seriesInstallment;
    });
  }

  const seriesKey = compact(series).toLowerCase().replace(/[^a-z0-9]/g, '');
  const seriesLinks = $('a[href*="/series/"]').toArray();
  const matchingSeriesLink = seriesLinks.find((el) => {
    const textKey = compact($(el).text()).toLowerCase().replace(/[^a-z0-9]/g, '');
    const hrefKey = compact($(el).attr('href')).toLowerCase().replace(/[^a-z0-9]/g, '');
    return seriesKey && (textKey === seriesKey || textKey.includes(seriesKey) || hrefKey.includes(seriesKey));
  });
  const seriesUrl = normalizeGoodreadsPageUrl(
    matchingSeriesLink
      ? $(matchingSeriesLink).attr('href')
      : (seriesLinks.length === 1 ? $(seriesLinks[0]).attr('href') : null),
  );

  const ratingValue =
    compact(ldRating.ratingValue)
    || firstText($, ['div.RatingStatistics__rating', '[data-testid="ratingValue"]', 'span[itemprop="ratingValue"]']);
  const ratingCountRaw =
    compact(ldRating.ratingCount)
    || firstText($, ['span[data-testid="ratingsCount"]', '[data-testid="ratingsCount"]'])
    || firstAttr($, ['meta[itemprop="ratingCount"]'], 'content')
    || html.match(/[\d,]+\s+ratings?/i)?.[0];
  const ratingCount = cleanCount(ratingCountRaw);
  const reviewCountRaw =
    compact(ldRating.reviewCount)
    || firstText($, ['span[data-testid="reviewsCount"]', '[data-testid="reviewsCount"]'])
    || firstAttr($, ['meta[itemprop="reviewCount"]'], 'content')
    || html.match(/[\d,]+\s+reviews?/i)?.[0];
  const reviewCount = cleanCount(reviewCountRaw);
  const webReview = formatGoodreadsReview(ratingValue, ratingCount, reviewCount);

  const publishYear =
    parseYear(ld.datePublished)
    || parseYear(firstText($, ['p[data-testid="publicationInfo"]', '[data-testid="publicationInfo"]', '#details', '[class*="publication"]']))
    || parseYear(html.match(/First published[^<\n]*/i)?.[0]);

  const genres = new Set<string>();
  const ldGenre = ld.genre;
  if (Array.isArray(ldGenre)) ldGenre.forEach((g) => compact(g) && genres.add(compact(g)));
  else if (compact(ldGenre)) genres.add(compact(ldGenre));
  $('div[data-testid="genresList"] a, a[href*="/genres/"], .bookPageGenreLink, a.Button--tag').each((_, el) => {
    const value = compact($(el).find('span.Button__labelItem').text()) || compact($(el).text());
    if (!value || /^(genres|show more|fiction|audiobook)$/i.test(value) || value.length > 40) return;
    genres.add(value);
  });

  return {
    title,
    author,
    blurb: blurb || null,
    cover,
    series,
    seriesInstallment,
    seriesTotal,
    seriesUrl,
    webReview,
    ratingValue: ratingValue || null,
    ratingCount: ratingCount || null,
    reviewCount: reviewCount || null,
    publishYear,
    genre: [...genres].slice(0, 3).join(', ') || null,
  };
}

async function searchGoodreadsUncached(title: string, author?: string): Promise<GoodreadsSearchResult[]> {
  try {
    const seen = new Set<string>();
    const results: GoodreadsSearchResult[] = [];

    for (const result of await searchGoodreadsTitleRedirects(title, author)) {
      if (seen.has(result.url)) continue;
      seen.add(result.url);
      results.push(result);
    }

    if (results.length) {
      if (!results.some(result => result.webReview)) {
        const fallback = await fetchGoodreadsSearchFallback(title, author, results[0].url);
        if (fallback) {
          results[0] = {
            ...results[0],
            webReview: fallback.webReview,
            ratingValue: fallback.ratingValue,
            ratingCount: fallback.ratingCount,
            reviewCount: fallback.reviewCount,
          };
        }
      }
      return results.slice(0, 8);
    }

    const queries = [
      `${title} ${author || ''}`.trim(),
      title,
    ];

    for (const value of queries) {
      const query = encodeURIComponent(value);
      const response = await fetch(`https://www.goodreads.com/search?q=${query}`, { headers });
      if (response.status !== 200) {
        continue;
      }

      for (const result of parseGoodreadsSearchHtml(await response.text())) {
        if (seen.has(result.url)) continue;
        seen.add(result.url);
        results.push(result);
      }

    }

    if (results.length) return results.slice(0, 8);

    const discoveryQueries = [
      `site:goodreads.com/book/show "${title}" "${author || ''}" Goodreads ratings reviews`.trim(),
      `site:goodreads.com/book/show "${title}" Goodreads ratings reviews`,
    ];

    for (const value of discoveryQueries) {
      const query = encodeURIComponent(value);
      const response = await fetch(`https://duckduckgo.com/html/?q=${query}`, { headers });
      if (!response.ok) continue;
      for (const result of parseGoodreadsDiscoveryHtml(await response.text())) {
        if (seen.has(result.url)) continue;
        seen.add(result.url);
        results.push(result);
      }
      if (results.length) break;
    }

    return results.slice(0, 8);
  } catch (err) {
    console.error('Error searching Goodreads:', err);
    return [];
  }
}

export async function searchGoodreads(title: string, author?: string): Promise<GoodreadsSearchResult[]> {
  const key = `${normalizedMatchKey(title)}:${normalizedMatchKey(author)}`;
  const now = Date.now();
  const cached = goodreadsSearchCache.get(key);
  if (cached && cached.expiresAt > now) return cached.results;
  if (cached) goodreadsSearchCache.delete(key);

  const active = goodreadsSearchInFlight.get(key);
  if (active) return active;

  const request = searchGoodreadsUncached(title, author)
    .then((results) => {
      goodreadsSearchCache.set(key, {
        expiresAt: Date.now() + GOODREADS_CACHE_TTL_MS,
        results,
      });
      return results;
    })
    .finally(() => {
      goodreadsSearchInFlight.delete(key);
    });

  goodreadsSearchInFlight.set(key, request);
  return request;
}

export async function scrapeGoodreadsBook(bookUrl: string, seed?: Partial<GoodreadsSearchResult>): Promise<GoodreadsBookDetails | null> {
  if (!/^https:\/\/(?:www\.)?goodreads\.com\//i.test(bookUrl)) {
    console.warn('scrapeGoodreadsBook: rejected non-Goodreads URL', bookUrl);
    return null;
  }

  try {
    const response = await fetch(bookUrl, { headers });
    if (!response.ok) return null;
    const details = parseGoodreadsBookHtml(await response.text(), seed);
    if (!details.seriesUrl) return details;

    try {
      const seriesResponse = await fetch(details.seriesUrl, { headers });
      if (!seriesResponse.ok) return details;
      const seriesTotal = parseGoodreadsSeriesTotal(await seriesResponse.text());
      const installment = Number(details.seriesInstallment);
      if (seriesTotal && (!Number.isFinite(installment) || Number(seriesTotal) >= installment)) {
        details.seriesTotal = seriesTotal;
      }
    } catch {
      // Series enrichment is optional; the book metadata remains useful without it.
    }
    return details;
  } catch (err) {
    console.error('Error scraping book detail:', err);
    return null;
  }
}

export async function searchGoodreadsAuthorImages(name: string): Promise<string[]> {
  try {
    const query = encodeURIComponent(name);
    const response = await fetch(`https://www.goodreads.com/search?q=${query}&search_type=people`, { headers });
    if (!response.ok) return [];
    const html = await response.text();
    const $ = cheerio.load(html);
    const urls: string[] = [];
    const seen = new Set<string>();

    $('a[href*="/author/show/"]').each((_, el) => {
      if (urls.length >= 5) return;
      const href = normalizeGoodreadsPageUrl($(el).attr('href'));
      if (!href || seen.has(href)) return;
      seen.add(href);
      urls.push(href);
    });

    const images: string[] = [];
    await Promise.all(urls.map(async (url) => {
      try {
        const authorResponse = await fetch(url, { headers });
        if (!authorResponse.ok) return;
        const authorHtml = await authorResponse.text();
        const page = cheerio.load(authorHtml);
        const image =
          page('meta[property="og:image"]').attr('content')
          || page('img.authorPicture, img[itemprop="image"], img.ResponsiveImage').first().attr('src');
        const normalized = normalizeGoodreadsImage(image);
        if (normalized) images.push(normalized);
      } catch {}
    }));

    return images;
  } catch {
    return [];
  }
}

export async function getGoodreadsReview(title: string, author?: string): Promise<string | null> {
  try {
    const results = await searchGoodreads(title, author);
    if (!results.length) return null;
    const details = await scrapeGoodreadsBook(results[0].url, results[0]);
    return details?.webReview || null;
  } catch {
    return null;
  }
}
