// Shared cache for merged book metadata results across deployment users.
// Prevents redundant requests across 10 metadata providers when the same book or ISBN
// is looked up repeatedly.

const NAMESPACE = 'metadata';
const HIT_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
const MISS_TTL_MS = 1000 * 60 * 15;      // 15 minutes

type CacheEntry<T> = { savedAt: number; empty: boolean; value: T };

const normalizeKey = (value: string) =>
  String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export function metadataCacheKey(title: string, author?: string, isbn?: string) {
  if (isbn) {
    const cleanIsbn = isbn.replace(/[^0-9X]/gi, '').toUpperCase();
    if (cleanIsbn) return `${NAMESPACE}:isbn:${cleanIsbn}`;
  }
  const titlePart = normalizeKey(title);
  const authorPart = author ? normalizeKey(author) : 'noauthor';
  return `${NAMESPACE}:query:${titlePart}:${authorPart}`;
}

/**
 * Run `resolve` unless a fresh cached metadata answer already exists in Nitro storage.
 */
export async function withMetadataCache<T>(
  key: string,
  isEmpty: (value: T) => boolean,
  resolve: () => Promise<T>,
): Promise<{ value: T; cached: boolean }> {
  let storage: any = null;
  try {
    storage = typeof useStorage === 'function' ? useStorage('cache') : null;
  } catch {
    storage = null;
  }

  if (storage) {
    try {
      const hit = (await storage.getItem(key)) as CacheEntry<T> | null;
      if (hit && typeof hit === 'object') {
        const ttl = hit.empty ? MISS_TTL_MS : HIT_TTL_MS;
        if (Date.now() - (hit.savedAt || 0) < ttl) {
          return { value: hit.value, cached: true };
        }
      }
    } catch {
      // Storage read failures should never break requests
    }
  }

  const value = await resolve();

  if (storage) {
    try {
      await storage.setItem(key, {
        savedAt: Date.now(),
        empty: isEmpty(value),
        value,
      } as CacheEntry<T>);
    } catch {
      // Handle storage write issues silently
    }
  }

  return { value, cached: false };
}
