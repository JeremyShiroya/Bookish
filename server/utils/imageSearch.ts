export type GoogleImageResult = {
  url: string;
  title: string | null;
  thumbnail: string | null;
  context: string | null;
  width: number | null;
  height: number | null;
};

type GoogleImageOptions = {
  num?: number;
  imageType?: string;
  rights?: string;
  scrape?: boolean;
};

const googleImageHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const trackingParams = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
];

function targetResultCount(num?: number) {
  return Math.min(Math.max(num || 20, 1), 50);
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function decodeJsEscapes(value: string) {
  return value
    .replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/\\x([0-9a-f]{2})/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/\\\//g, '/');
}

export function normalizeImageUrl(url?: string | null) {
  if (!url) return null;
  const normalized = decodeHtmlEntities(decodeJsEscapes(String(url)))
    .replace(/^http:\/\//i, 'https://')
    .replace(/^\/\//, 'https://')
    .replace(/#.*$/, '')
    .trim();
  return normalized;
}

function cleanForDedupe(url?: string | null) {
  const normalized = normalizeImageUrl(url);
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    trackingParams.forEach((key) => parsed.searchParams.delete(key));
    const wikimediaThumb = parsed.pathname.match(/^\/wikipedia\/commons\/thumb\/(.+)\/\d+px-[^/]+$/);
    if (wikimediaThumb) {
      parsed.pathname = `/wikipedia/commons/${wikimediaThumb[1]}`;
    }
    return parsed.toString();
  } catch {
    return normalized.replace(/[?#].*$/, '');
  }
}

function hasImageExtension(url: string) {
  const lower = url.toLowerCase();
  const path = lower.split('?')[0];
  return /\.(jpe?g|png|webp)$/i.test(path);
}

function isGoogleImageProxyUrl(url: string) {
  return /https:\/\/encrypted-tbn\d?\.gstatic\.com\/images/i.test(url)
    || url.includes('gstatic.com/images?q=tbn')
    || url.includes('googleusercontent.com');
}

function isKnownBookCoverCdnUrl(url: string) {
  return url.includes('images.penguinrandomhouse.com/cover')
    || url.includes('images.randomhouse.com/cover')
    || url.includes('prodimage.images-bn.com')
    || url.includes('dynamic.indigoimages.ca/books')
    || url.includes('covers.harpercollins.com')
    || url.includes('d28hgpri8am2if.cloudfront.net/book_images')
    || url.includes('d1w7fb2mkkr3kw.cloudfront.net/assets/images/book');
}

function isKnownAuthorImageCdnUrl(url: string) {
  return url.includes('images.penguinrandomhouse.com/author/')
    || url.includes('images.randomhouse.com/author/')
    || url.includes('images.macmillan.com/')
    || url.includes('authorimages.harpercollins.com')
    || url.includes('simonandschusterpublishing.com/')
    || url.includes('media.bloomsbury.com/');
}

function isLikelyImageSearchUrl(url?: string | null) {
  const normalized = normalizeImageUrl(url);
  if (!normalized || normalized.startsWith('data:')) return false;
  const lower = normalized.toLowerCase();
  return (
    (
      hasImageExtension(lower)
      || isGoogleImageProxyUrl(lower)
      || lower.includes('books.google.com/books/content')
      || lower.includes('covers.openlibrary.org')
      || lower.includes('images.gr-assets.com')
      || lower.includes('i.gr-assets.com')
      || lower.includes('wikimedia.org')
      || lower.includes('kbimages')
      || isKnownBookCoverCdnUrl(lower)
    )
    && !/(favicon|sprite|spacer|pixel|blank|placeholder|default|logo|icon)/i.test(lower)
  );
}

export function isUsefulCoverUrl(url?: string | null) {
  const normalized = normalizeImageUrl(url);
  if (!normalized) return false;
  const lower = normalized.toLowerCase();
  return (
    (
      hasImageExtension(lower)
      || lower.includes('books.google.com/books/content')
      || isGoogleImageProxyUrl(lower)
      || lower.includes('covers.openlibrary.org')
      || lower.includes('kbimages')
      || isKnownBookCoverCdnUrl(lower)
    )
    && !/(nophoto|no_cover|nocover|placeholder|default|sprite|icon|logo|avatar|profile|author)/i.test(lower)
  );
}

export function isUsefulAuthorImageUrl(url?: string | null) {
  const normalized = normalizeImageUrl(url);
  if (!normalized) return false;
  const lower = normalized.toLowerCase();
  const isOpenLibraryAuthorImage = lower.includes('covers.openlibrary.org/a/');
  const rejectionText = isOpenLibraryAuthorImage
    ? lower.replace(/https:\/\/covers\.openlibrary\.org\/a\//, '')
    : lower;
  return (
    (
      hasImageExtension(lower)
      || lower.includes('wikimedia.org')
      || isGoogleImageProxyUrl(lower)
      || lower.includes('images.gr-assets.com')
      || lower.includes('i.gr-assets.com')
      || isOpenLibraryAuthorImage
      || isKnownAuthorImageCdnUrl(lower)
    )
    && !/(svg|icon|logo|stub|symbol|book[_-]?cover|cover[_-]?(art|image|photo)|novel|book[_-]|book%20|magnify|signature|map|badge|sprite|placeholder|nophoto|no[_-]?image)/i.test(rejectionText)
  );
}

export function addUniqueImage(target: string[], seen: Set<string>, url?: string | null, predicate = isUsefulCoverUrl) {
  if (!predicate(url)) return;
  const normalized = normalizeImageUrl(url);
  const key = cleanForDedupe(normalized);
  if (!normalized || !key || seen.has(key)) return;
  seen.add(key);
  target.push(normalized);
}

export function rankCoverResult(result: GoogleImageResult, title: string, author?: string) {
  const haystack = `${result.title || ''} ${result.context || ''} ${result.url}`.toLowerCase();
  const normalizedTitle = title.toLowerCase();
  const normalizedAuthor = (author || '').toLowerCase();
  let score = 0;
  if (haystack.includes(normalizedTitle)) score += 8;
  if (normalizedAuthor && haystack.includes(normalizedAuthor)) score += 4;
  if (/\b(book|cover|novel|edition|paperback|hardcover)\b/i.test(haystack)) score += 4;
  if (result.width && result.height) {
    const ratio = result.width / result.height;
    if (ratio > 0.55 && ratio < 0.85) score += 5;
    if (result.width >= 300 && result.height >= 450) score += 2;
  }
  if (/covers\.openlibrary\.org|books\.google\.com\/books\/content|kbimages/i.test(haystack)) score += 2;
  if (/encrypted-tbn\d?\.gstatic\.com\/images/i.test(haystack)) score -= 1;
  if (/(logo|icon|banner|wallpaper|fanart)/i.test(haystack)) score -= 6;
  return score;
}

export function rankAuthorResult(result: GoogleImageResult, name: string) {
  const haystack = `${result.title || ''} ${result.context || ''} ${result.url}`.toLowerCase();
  let score = 0;
  if (haystack.includes(name.toLowerCase())) score += 8;
  if (/\b(author|writer|portrait|headshot|photo|profile)\b/i.test(haystack)) score += 5;
  if (result.width && result.height) {
    const ratio = result.width / result.height;
    if (ratio > 0.65 && ratio < 1.35) score += 4;
    if (result.width >= 250 && result.height >= 250) score += 2;
  }
  if (/wikimedia\.org|images\.gr-assets\.com|i\.gr-assets\.com|covers\.openlibrary\.org\/a\//i.test(haystack)) score += 2;
  if (/(book[_ -]?cover|novel|logo|icon|signature|map)/i.test(haystack)) score -= 8;
  return score;
}

function cleanExtractedUrl(raw?: string | null) {
  if (!raw) return null;
  let value = decodeHtmlEntities(decodeJsEscapes(String(raw))).trim();
  try {
    value = decodeURIComponent(value);
  } catch {}
  value = value
    .replace(/^[\s"'([]+/, '')
    .replace(/[\s"'),;\]}<>]+$/, '');
  return normalizeImageUrl(value);
}

function addGoogleImageResult(target: GoogleImageResult[], seen: Set<string>, rawUrl?: string | null, query?: string) {
  const url = cleanExtractedUrl(rawUrl);
  if (!isLikelyImageSearchUrl(url)) return;
  const key = cleanForDedupe(url);
  if (!url || !key || seen.has(key)) return;
  seen.add(key);
  target.push({
    url,
    title: query || null,
    thumbnail: null,
    context: 'Google Images',
    width: null,
    height: null,
  });
}

export function parseGoogleImageSearchHtml(html: string, query?: string): GoogleImageResult[] {
  const text = decodeHtmlEntities(decodeJsEscapes(html));
  const results: GoogleImageResult[] = [];
  const seen = new Set<string>();

  const imgUrlPattern = /[?&]imgurl=([^&"'<>]+)/gi;
  for (const match of text.matchAll(imgUrlPattern)) {
    addGoogleImageResult(results, seen, match[1], query);
  }

  const metaPattern = /"(?:ou|tu|isu)":"(https?:\\?\/\\?\/[^"]+)"/gi;
  for (const match of text.matchAll(metaPattern)) {
    addGoogleImageResult(results, seen, match[1], query);
  }

  const urlPattern = /https?:\/\/[^"'<>\\\s]+/gi;
  for (const match of text.matchAll(urlPattern)) {
    addGoogleImageResult(results, seen, match[0], query);
  }

  return results;
}

export function parseBingImageSearchHtml(html: string): string[] {
  const text = decodeHtmlEntities(decodeJsEscapes(html));
  const results: string[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(/"murl"\s*:\s*"([^"]+)"/gi)) {
    const url = cleanExtractedUrl(match[1]);
    const key = cleanForDedupe(url);
    if (!url || !key || seen.has(key) || !isLikelyImageSearchUrl(url)) continue;
    seen.add(key);
    results.push(url);
  }

  return results;
}

export async function searchBingImages(query: string, num = 20): Promise<string[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      form: 'HDRSC2',
      first: '1',
      cw: '1177',
      ch: '748',
    });
    const response = await fetch(`https://www.bing.com/images/search?${params.toString()}`, {
      headers: googleImageHeaders,
    });
    if (!response.ok) return [];
    return parseBingImageSearchHtml(await response.text()).slice(0, targetResultCount(num));
  } catch (error) {
    console.error('Bing image search failed:', error);
    return [];
  }
}

function dedupeGoogleResults(results: GoogleImageResult[]) {
  const output: GoogleImageResult[] = [];
  const seen = new Set<string>();
  for (const result of results) {
    const url = normalizeImageUrl(result.url);
    const key = cleanForDedupe(url);
    if (!url || !key || seen.has(key)) continue;
    seen.add(key);
    output.push({ ...result, url });
  }
  return output;
}

async function searchGoogleProgrammableImages(query: string, options: GoogleImageOptions, target: number): Promise<GoogleImageResult[]> {
  const key = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;
  if (!key || !cx) return [];

  try {
    const results: GoogleImageResult[] = [];
    for (let start = 1; results.length < target && start <= 91; start += 10) {
      const params = new URLSearchParams({
        key,
        cx,
        q: query,
        searchType: 'image',
        safe: 'active',
        num: String(Math.min(10, target - results.length)),
        start: String(start),
      });
      if (options.imageType) params.set('imgType', options.imageType);
      if (options.rights) params.set('rights', options.rights);

      const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`);
      if (!response.ok) break;
      const data: any = await response.json();
      const items = (data.items || [])
        .map((item: any) => ({
          url: item.link,
          title: item.title || null,
          thumbnail: item.image?.thumbnailLink || null,
          context: item.image?.contextLink || item.displayLink || null,
          width: item.image?.width ? Number(item.image.width) : null,
          height: item.image?.height ? Number(item.image.height) : null,
        }))
        .filter((item: GoogleImageResult) => item.url);
      results.push(...items);
      if (items.length < 10) break;
    }
    return dedupeGoogleResults(results).slice(0, target);
  } catch (error) {
    console.error('Google image search failed:', error);
    return [];
  }
}

export async function scrapeGoogleImageSearch(query: string, options: GoogleImageOptions = {}): Promise<GoogleImageResult[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      tbm: 'isch',
      udm: '2',
      safe: 'active',
      hl: 'en',
      gl: 'us',
    });
    if (options.imageType === 'face') params.set('tbs', 'itp:face');
    if (options.imageType === 'photo') params.set('tbs', 'itp:photo');

    const response = await fetch(`https://www.google.com/search?${params.toString()}`, {
      headers: googleImageHeaders,
    });
    if (!response.ok) return [];
    return parseGoogleImageSearchHtml(await response.text(), query).slice(0, targetResultCount(options.num));
  } catch (error) {
    console.error('Google image scrape failed:', error);
    return [];
  }
}

export async function searchGoogleImages(query: string, options: GoogleImageOptions = {}): Promise<GoogleImageResult[]> {
  const target = targetResultCount(options.num);
  const apiResults = await searchGoogleProgrammableImages(query, options, target);
  if (options.scrape === false || apiResults.length >= target) return apiResults.slice(0, target);

  const scrapedResults = await scrapeGoogleImageSearch(query, { ...options, num: target });
  return dedupeGoogleResults([...apiResults, ...scrapedResults]).slice(0, target);
}
