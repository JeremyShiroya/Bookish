// Shared cache for series lookups, so the same question is only ever paid for
// once across ALL users of a deployment.
//
// Both things this fronts are expensive in ways that get worse with more
// readers, not better:
//   - the Goodreads roster scrape, which is rate-limited per network and starts
//     answering 202 anti-bot stubs when it is hit too often — so caching here
//     directly reduces how often anyone gets walled;
//   - the AI ordering, which is billed per call and drawn from one shared quota.
//
// A series' book list barely changes, so the same roster serves every reader who
// owns that series. The hundredth person to ask about Will Trent costs nothing.
//
// Storage is Nitro's unstorage layer rather than a plain Map, so a single
// instance works out of the box (memory) and a deployment can point the `cache`
// mount at Redis/KV in nitro.storage without touching this file. Memory alone
// still helps: serverless instances are reused across many requests.

const NAMESPACE = 'series'

// A resolved roster is stable for a long time. An EMPTY result is not a fact —
// it usually means Goodreads refused or the model declined — so it is kept only
// briefly, purely to stop a hammering loop, and retried soon after.
const HIT_TTL_MS = 1000 * 60 * 60 * 24 * 30
const MISS_TTL_MS = 1000 * 60 * 15

type CacheEntry<T> = { savedAt: number; empty: boolean; value: T }

const normalizeKey = (value: string) => String(value || '')
  .normalize('NFKD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '')

export function seriesCacheKey(kind: string, ...parts: Array<string | undefined>) {
  const tail = parts.filter(Boolean).map((part) => normalizeKey(part as string)).join(':')
  return `${NAMESPACE}:${kind}:${tail}`
}

/**
 * Run `resolve` unless a fresh cached answer already exists.
 *
 * `isEmpty` decides which TTL applies: a lookup that found nothing must not be
 * remembered for a month, or a single bad day would blank a series until the
 * cache expired.
 */
export async function withSeriesCache<T>(
  key: string,
  isEmpty: (value: T) => boolean,
  resolve: () => Promise<T>,
): Promise<{ value: T; cached: boolean }> {
  let storage: any = null
  try {
    // useStorage is auto-imported in Nitro; guard so this module stays usable
    // (and testable) outside a server context.
    storage = typeof useStorage === 'function' ? useStorage('cache') : null
  } catch {
    storage = null
  }

  if (storage) {
    try {
      const hit = (await storage.getItem(key)) as CacheEntry<T> | null
      if (hit && typeof hit === 'object') {
        const ttl = hit.empty ? MISS_TTL_MS : HIT_TTL_MS
        if (Date.now() - (hit.savedAt || 0) < ttl) return { value: hit.value, cached: true }
      }
    } catch {
      // A cache read must never break the request it was meant to speed up.
    }
  }

  const value = await resolve()

  if (storage) {
    try {
      await storage.setItem(key, { savedAt: Date.now(), empty: isEmpty(value), value } as CacheEntry<T>)
    } catch {
      // Full or read-only storage — serve the fresh value anyway.
    }
  }

  return { value, cached: false }
}
