import * as cheerio from 'cheerio';
import { isUsefulCoverUrl, normalizeImageUrl } from './imageSearch';
import { scoreSource } from './metadataAggregator';
import { knownPublisherDomains, resolvePublisherDomain } from './publisherSites';

export type PublisherMetadataResult = {
  id: string;
  title: string | null;
  author: string | null;
  cover: string | null;
  blurb: string | null;
  publisher: string | null;
  searchedPublisher: string;
  publisherSite: string | null;
};

export type PublisherMetadataProgress = {
  stage: 'publisherSearch' | 'publisherScrape';
  status: 'active' | 'success' | 'error';
  message?: string;
};

type PublisherMetadataOptions = {
  onProgress?: (event: PublisherMetadataProgress) => void;
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function compact(value?: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function absoluteUrl(value: string | null | undefined, baseUrl: string) {
  if (!value) return null;
  try {
    return normalizeImageUrl(new URL(value, baseUrl).toString());
  } catch {
    return normalizeImageUrl(value);
  }
}

function absolutePageUrl(value: string | null | undefined, baseUrl: string) {
  if (!value) return null;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return /^https?:\/\//i.test(String(value || '')) ? String(value) : null;
  }
}

function publisherHostMatches(url: string, domain: string) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    const target = domain.replace(/^www\./, '').toLowerCase();
    return hostname === target || hostname.endsWith(`.${target}`);
  } catch {
    return false;
  }
}

const blockedPublisherHosts = [
  'amazon.',
  'archive.org',
  'barnesandnoble.',
  'bookshop.org',
  'books.google.',
  'ebay.',
  'goodreads.com',
  'google.',
  'instagram.com',
  'kobo.com',
  'librarything.com',
  'openlibrary.org',
  'reddit.com',
  'target.com',
  'tiktok.com',
  'twitter.com',
  'walmart.com',
  'wikipedia.org',
  'x.com',
  'youtube.com',
];

const publisherTokenStopwords = new Set([
  'and',
  'book',
  'books',
  'co',
  'company',
  'edition',
  'editions',
  'group',
  'house',
  'imprint',
  'inc',
  'limited',
  'llc',
  'ltd',
  'press',
  'publisher',
  'publishers',
  'publishing',
  'the',
]);

function normalizeToken(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function publisherTokens(publisher: string) {
  return publisher
    .split(/[^a-z0-9]+/i)
    .map(normalizeToken)
    .filter((token) => token.length >= 3 && !publisherTokenStopwords.has(token));
}

function bookTokens(value?: string | null) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !publisherTokenStopwords.has(token));
}

function candidateLooksLikeBook(url: string, label: string, title: string, author?: string) {
  const haystack = `${label} ${url}`
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const titleTokens = bookTokens(title);
  if (!titleTokens.length) return false;

  const matchedTitleTokens = titleTokens.filter((token) => haystack.includes(token));
  const titleMatches = matchedTitleTokens.length >= Math.min(2, titleTokens.length)
    || haystack.includes(normalizeToken(title));
  if (!titleMatches) return false;

  const authorTokens = bookTokens(author);
  if (!authorTokens.length) return true;
  return authorTokens.some((token) => haystack.includes(token)) || matchedTitleTokens.length >= titleTokens.length;
}

function hostLooksLikePublisher(url: string, publisher: string) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (blockedPublisherHosts.some((blocked) => hostname.includes(blocked))) return false;

    const compactHost = normalizeToken(hostname.split('.')[0] || hostname);
    const tokens = publisherTokens(publisher);
    if (!compactHost || !tokens.length) return false;

    const matches = tokens.filter((token) => compactHost.includes(token));
    if (matches.length >= 2) return true;
    if (matches.length === 1 && tokens[0] && matches[0] === tokens[0]) return true;
    return false;
  } catch {
    return false;
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function cleanGoogleHref(href: string) {
  if (href.startsWith('/url?')) {
    try {
      const parsed = new URL(href, 'https://www.google.com');
      return parsed.searchParams.get('q')
        || parsed.searchParams.get('url')
        || parsed.searchParams.get('u');
    } catch {
      return null;
    }
  }

  if (/^https?:\/\//i.test(href)) {
    try {
      const parsed = new URL(href);
      if (/(\.|^)google\./i.test(parsed.hostname) && parsed.pathname === '/url') {
        return parsed.searchParams.get('q')
          || parsed.searchParams.get('url')
          || parsed.searchParams.get('u');
      }
    } catch {}
    return href;
  }
  return null;
}

function cleanDuckDuckGoHref(href: string) {
  try {
    const parsed = new URL(href, 'https://duckduckgo.com');
    const uddg = parsed.searchParams.get('uddg');
    if (uddg) return decodeURIComponent(uddg);
    if (/^https?:\/\//i.test(href) && !/(\.|^)duckduckgo\.com$/i.test(parsed.hostname)) return href;
  } catch {
    if (/^https?:\/\//i.test(href)) return href;
  }
  return null;
}

function isRejectedBookPageUrl(url: string) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    const hasSearchQuery = ['s', 'q', 'query', 'keyword', 'term'].some((key) => parsed.searchParams.has(key));
    if ((path === '/' || /^\/search(\/|$)/i.test(path)) && hasSearchQuery) return true;
  } catch {}

  return /\/(search|cart|checkout|account|login|privacy|terms|tag|category|authors?)(\/|\?|$)/i.test(url)
    || /\.(jpe?g|png|webp|gif|svg|pdf)(\?|$)/i.test(url);
}

function extractGoogleResultUrls(html: string, publisher: string, domains: string[]) {
  const $ = cheerio.load(html);
  const urls: string[] = [];
  const seen = new Set<string>();

  $('a[href]').each((_, element) => {
    const href = cleanGoogleHref($(element).attr('href') || '');
    if (!href) return;
    const acceptedHost = domains.some((domain) => publisherHostMatches(href, domain))
      || hostLooksLikePublisher(href, publisher);
    if (!acceptedHost) return;

    const clean = href.split('#')[0] || href;
    if (isRejectedBookPageUrl(clean)) return;

    if (!seen.has(clean)) {
      seen.add(clean);
      urls.push(clean);
    }
  });

  return urls.slice(0, 8);
}

function extractDuckDuckGoResultUrls(html: string, publisher: string, domains: string[]) {
  const $ = cheerio.load(html);
  const urls: string[] = [];
  const seen = new Set<string>();

  $('a.result__a[href], a[href*="uddg="], a[href^="http"]').each((_, element) => {
    const href = cleanDuckDuckGoHref($(element).attr('href') || '');
    if (!href) return;
    const acceptedHost = domains.some((domain) => publisherHostMatches(href, domain))
      || hostLooksLikePublisher(href, publisher);
    if (!acceptedHost) return;

    const clean = href.split('#')[0] || href;
    if (isRejectedBookPageUrl(clean)) return;

    if (!seen.has(clean)) {
      seen.add(clean);
      urls.push(clean);
    }
  });

  return urls.slice(0, 8);
}

function publisherSiteSearchUrls(domain: string, title: string, author: string | undefined) {
  const query = [title, author].filter(Boolean).join(' ');
  const encoded = encodeURIComponent(query);
  const plusEncoded = query.trim().replace(/\s+/g, '+');
  const host = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const hosts = host.startsWith('www.') ? [host] : [`www.${host}`, host];
  const urls: string[] = [];

  for (const searchHost of hosts) {
    const base = `https://${searchHost}`;
    urls.push(
      `${base}/search/site?q=${encoded}`,
      `${base}/search/search?q=${encoded}`,
      `${base}/search-results/?q=${encoded}`,
      `${base}/search?q=${encoded}`,
      `${base}/search?query=${encoded}`,
      `${base}/search?keyword=${encoded}`,
      `${base}/search-results?term=${encoded}`,
      `${base}/?s=${encoded}`,
    );

    if (/simonandschuster\.com$/i.test(domain)) {
      urls.unshift(`${base}/search/books/_/Ntt-${plusEncoded}`);
    }
    if (/harpercollins\.com$/i.test(domain)) {
      urls.unshift(`${base}/search?q=${encoded}&type=product`);
    }
    if (/hachettebookgroup\.com$/i.test(domain)) {
      urls.unshift(`${base}/search/?q=${encoded}`);
    }
    if (/us\.macmillan\.com$/i.test(domain)) {
      urls.unshift(`${base}/search?query=${encoded}`);
    }
  }

  return urls.filter((url, index, list) => list.indexOf(url) === index);
}

function extractPublisherSiteUrls(
  html: string,
  pageUrl: string,
  title: string,
  author: string | undefined,
  publisher: string,
  domains: string[],
) {
  const $ = cheerio.load(html);
  const urls: string[] = [];
  const seen = new Set<string>();

  $('a[href]').each((_, element) => {
    const href = absolutePageUrl($(element).attr('href'), pageUrl);
    if (!href) return;
    const acceptedHost = domains.some((domain) => publisherHostMatches(href, domain))
      || hostLooksLikePublisher(href, publisher);
    if (!acceptedHost) return;

    const clean = href.split('#')[0] || href;
    if (isRejectedBookPageUrl(clean)) return;

    const label = compact($(element).text());
    if (!candidateLooksLikeBook(clean, label, title, author)) return;

    if (!seen.has(clean)) {
      seen.add(clean);
      urls.push(clean);
    }
  });

  return urls.slice(0, 8);
}

async function findPublisherBookUrls(title: string, author: string | undefined, publisher: string, domain: string | null) {
  const exact = [quoteTerm(title), quoteTerm(author)].filter(Boolean).join(' ');
  const domains = domain ? [domain] : [];
  const directSiteResults = domain
    ? publisherSiteSearchUrls(domain, title, author).map(async (url) => {
      const html = await fetchHtml(url);
      return html ? extractPublisherSiteUrls(html, url, title, author, publisher, domains) : [];
    })
    : [];
  const siteQueries = domain ? [
    `site:${domain} ${exact}`,
    `site:${domain} ${exact} book`,
  ] : [];
  const queries = [
    ...siteQueries,
    `${quoteTerm(publisher)} ${exact}`,
    `${quoteTerm(publisher)} ${exact} official book`,
  ].filter((query, index, list) => query.trim() && list.indexOf(query) === index);

  const seen = new Set<string>();
  const googleResults = queries.map(async (query) => {
    const params = new URLSearchParams({ q: query, hl: 'en', gl: 'us' });
    const html = await fetchHtml(`https://www.google.com/search?${params.toString()}`);
    return html ? extractGoogleResultUrls(html, publisher, domains) : [];
  });

  const duckDuckGoResults = queries.map(async (query) => {
    const params = new URLSearchParams({ q: query });
    const html = await fetchHtml(`https://duckduckgo.com/html/?${params.toString()}`);
    return html ? extractDuckDuckGoResultUrls(html, publisher, domains) : [];
  });

  const searchResults = await Promise.allSettled([...directSiteResults, ...googleResults, ...duckDuckGoResults]);

  const urls: string[] = [];
  for (const result of searchResults) {
    if (result.status !== 'fulfilled') continue;
    for (const url of result.value) {
      if (seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
      if (urls.length >= 8) return urls;
    }
  }

  return urls;
}

async function findPublisherBookUrlsFromSite(title: string, author: string | undefined, domain: string) {
  const domains = [domain];
  const seen = new Set<string>();
  const urls: string[] = [];

  const directSiteResults = await Promise.allSettled(
    publisherSiteSearchUrls(domain, title, author).map(async (url) => {
      const html = await fetchHtml(url);
      return html ? extractPublisherSiteUrls(html, url, title, author, domain, domains) : [];
    }),
  );

  for (const result of directSiteResults) {
    if (result.status !== 'fulfilled') continue;
    for (const url of result.value) {
      if (seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
      if (urls.length >= 6) return urls;
    }
  }

  return urls;
}

function quoteTerm(value?: string | null) {
  const cleaned = compact(value).replace(/"/g, '');
  return cleaned ? `"${cleaned}"` : '';
}

function findBookJsonLd(html: string, $: cheerio.CheerioAPI): any | null {
  const candidates: any[] = [];
  const visit = (value: any) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== 'object') return;
    if (value['@graph']) visit(value['@graph']);
    if (value.mainEntity) visit(value.mainEntity);
    if (value.workExample) visit(value.workExample);
    const types = asArray(value['@type']).map((type) => String(type).toLowerCase());
    if (types.includes('book') || types.includes('product')) candidates.push(value);
  };

  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      visit(JSON.parse($(element).html() || ''));
    } catch {}
  });

  return candidates[0] || null;
}

function jsonLdAuthor(value: any) {
  const author = asArray(value)[0];
  if (!author) return null;
  if (typeof author === 'string') return compact(author) || null;
  return compact(author.name) || null;
}

function jsonLdName(value: any) {
  const item = asArray(value)[0];
  if (!item) return null;
  if (typeof item === 'string') return compact(item) || null;
  return compact(item.name) || null;
}

function jsonLdImage(value: any) {
  const image = asArray(value)[0];
  if (!image) return null;
  if (typeof image === 'string') return image;
  return image.url || image.contentUrl || null;
}

function cleanDescription(value?: unknown) {
  const text = compact(value)
    .replace(/\b(pre-?order|buy now|add to cart|available now)\b/ig, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length < 40) return null;
  if (/(cookie|javascript|newsletter|sign up|privacy policy)/i.test(text)) return null;
  return text;
}

function extractAuthorFromTitle(value?: string | null) {
  const title = compact(value);
  if (!title) return null;
  const match = title.match(/\bby\s+([^:|]+?)(?:\s*[:|]|$)/i);
  return compact(match?.[1]).replace(/\s+books?$/i, '') || null;
}

function cleanPublisherTitle(value?: string | null) {
  let title = compact(value);
  if (!title) return null;
  title = title
    .replace(/\s*\|\s*[^|]*publisher[^|]*$/i, '')
    .replace(/\s*\|\s*PenguinRandomHouse\.com:\s*Books\s*$/i, '')
    .replace(/\s*:\s*(97[89][0-9x -]{8,})\b.*$/i, '')
    .replace(/\s+by\s+[^:|]+(?:\s*[:|].*)?$/i, '')
    .trim();
  return title || null;
}

function pageHostname(pageUrl: string) {
  try {
    return new URL(pageUrl).hostname.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

export function parsePublisherBookPage(
  html: string,
  pageUrl: string,
  targetTitle: string,
  targetAuthor: string | undefined,
  searchedPublisher: string,
): PublisherMetadataResult | null {
  if (isRejectedBookPageUrl(pageUrl)) return null;

  const $ = cheerio.load(html);
  const ld = findBookJsonLd(html, $);

  const rawTitle = compact(
    ld?.name
    || $('meta[property="og:title"]').attr('content')
    || $('meta[name="twitter:title"]').attr('content')
    || $('h1').first().text(),
  ) || null;

  const title = cleanPublisherTitle(rawTitle);

  const author = jsonLdAuthor(ld?.author)
    || extractAuthorFromTitle(rawTitle)
    || compact($('[itemprop="author"], [rel="author"], .author, .book-author').first().text())
    || null;

  if (scoreSource(targetTitle, targetAuthor, { title, author }) < 45) return null;

  const rawCover =
    jsonLdImage(ld?.image)
    || $('meta[property="og:image"]').attr('content')
    || $('meta[name="twitter:image"]').attr('content')
    || $('[itemprop="image"]').attr('src')
    || null;
  const cover = absoluteUrl(rawCover, pageUrl);

  const blurb = cleanDescription(
    ld?.description
    || $('meta[property="og:description"]').attr('content')
    || $('meta[name="description"]').attr('content')
    || $('[itemprop="description"], [class*="description"], [class*="synopsis"]').first().text(),
  );

  if (!cover && !blurb) return null;

  const pagePublisher = jsonLdName(ld?.publisherImprint)
    || compact($('meta[name="Tealium"]').attr('data-book-imprint'))
    || compact($('[imprint]').first().attr('imprint'))
    || jsonLdName(ld?.imprint)
    || jsonLdName(ld?.publisher)
    || compact($('[itemprop="publisher"], .publisher, .imprint').first().text())
    || null;

  return {
    id: pageUrl,
    title,
    author,
    cover: isUsefulCoverUrl(cover) ? cover : null,
    blurb,
    publisher: pagePublisher,
    searchedPublisher,
    publisherSite: pageHostname(pageUrl),
  };
}

export async function searchPublisherMetadata(
  title: string,
  author: string | undefined,
  publishers: string[],
  options: PublisherMetadataOptions = {},
): Promise<PublisherMetadataResult[]> {
  const publisherDomains = publishers
    .map((publisher) => ({ publisher: compact(publisher), domain: resolvePublisherDomain(publisher) }))
    .filter((item) => Boolean(item.publisher));

  const seenPublishers = new Set<string>();
  const uniquePublisherDomains = publisherDomains
    .filter((item) => {
      const key = normalizeToken(item.domain || item.publisher);
      if (!key || seenPublishers.has(key)) return false;
      seenPublishers.add(key);
      return true;
    })
    .slice(0, 3);

  const results: PublisherMetadataResult[] = [];
  const publisherResults = await Promise.allSettled(uniquePublisherDomains.map(async ({ publisher, domain }) => {
    options.onProgress?.({
      stage: 'publisherSearch',
      status: 'active',
      message: domain ? `Searching ${domain}` : `Searching for ${publisher}'s official site`,
    });
    const urls = await findPublisherBookUrls(title, author, publisher, domain);
    options.onProgress?.({
      stage: 'publisherSearch',
      status: urls.length ? 'active' : 'error',
      message: urls.length
        ? `Found ${urls.length} possible ${publisher} page${urls.length === 1 ? '' : 's'}; verifying content`
        : `No official ${publisher} page found`,
    });
    if (!urls.length) return [];

    options.onProgress?.({
      stage: 'publisherScrape',
      status: 'active',
      message: `Scraping ${publisher} page${urls.length === 1 ? '' : 's'}`,
    });
    const pages = await Promise.allSettled(urls.slice(0, 5).map(async (url) => {
      const html = await fetchHtml(url);
      return html ? parsePublisherBookPage(html, url, title, author, publisher) : null;
    }));

    const parsedPages = pages
      .filter((page): page is PromiseFulfilledResult<PublisherMetadataResult | null> => page.status === 'fulfilled')
      .map((page) => page.value)
      .filter((page): page is PublisherMetadataResult => page !== null);

    options.onProgress?.({
      stage: 'publisherScrape',
      status: parsedPages.length ? 'success' : 'error',
      message: parsedPages.length
        ? `Scraped ${parsedPages.length} ${publisher} result${parsedPages.length === 1 ? '' : 's'}`
        : `Publisher pages did not expose matching book metadata`,
    });

    return parsedPages;
  }));

  for (const result of publisherResults) {
    if (result.status === 'fulfilled') results.push(...result.value);
  }

  return results
    .sort((a, b) => scoreSource(title, author, b) - scoreSource(title, author, a))
    .slice(0, 4);
}

export async function searchKnownPublisherSites(
  title: string,
  author: string | undefined,
  options: PublisherMetadataOptions = {},
): Promise<PublisherMetadataResult[]> {
  const priorityDomains = [
    'penguinrandomhouse.com',
    'harpercollins.com',
    'simonandschuster.com',
    'hachettebookgroup.com',
    'us.macmillan.com',
    'scholastic.com',
    'bloomsbury.com',
    'wwnorton.com',
  ];
  const domains = [
    ...priorityDomains,
    ...knownPublisherDomains().filter((domain) => !priorityDomains.includes(domain)),
  ].slice(0, 12);

  const results: PublisherMetadataResult[] = [];

  for (const domain of domains) {
    options.onProgress?.({
      stage: 'publisherSearch',
      status: 'active',
      message: `No publisher name found; checking ${domain}`,
    });

    const urls = await findPublisherBookUrlsFromSite(title, author, domain);
    if (!urls.length) continue;

    options.onProgress?.({
      stage: 'publisherSearch',
      status: 'active',
      message: `Found ${urls.length} possible page${urls.length === 1 ? '' : 's'} on ${domain}; verifying content`,
    });
    options.onProgress?.({
      stage: 'publisherScrape',
      status: 'active',
      message: `Scraping ${domain} page${urls.length === 1 ? '' : 's'}`,
    });

    const pages = await Promise.allSettled(urls.slice(0, 4).map(async (url) => {
      const html = await fetchHtml(url);
      return html ? parsePublisherBookPage(html, url, title, author, domain) : null;
    }));
    const parsedPages = pages
      .filter((page): page is PromiseFulfilledResult<PublisherMetadataResult | null> => page.status === 'fulfilled')
      .map((page) => page.value)
      .filter((page): page is PublisherMetadataResult => page !== null);

    if (parsedPages.length) {
      options.onProgress?.({
        stage: 'publisherScrape',
        status: 'success',
        message: `Scraped ${parsedPages.length} result${parsedPages.length === 1 ? '' : 's'} from ${domain}`,
      });
      results.push(...parsedPages);
      break;
    }
  }

  return results
    .sort((a, b) => scoreSource(title, author, b) - scoreSource(title, author, a))
    .slice(0, 4);
}
