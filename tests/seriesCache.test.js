import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test, vi } from 'vitest'
import { seriesCacheKey, withSeriesCache } from '../server/utils/seriesCache.ts'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')

// Two costs scale with readers rather than shrinking: the Goodreads scrape is
// rate-limited per network, and the AI call is billed from one shared quota.
// Every reader who owns a series asks the same question and gets the same
// unchanging answer, so it should only ever be paid for once.
describe('server-side series cache', () => {
  test('the key ignores case, spacing and punctuation', () => {
    expect(seriesCacheKey('roster', 'Lucas Davenport')).toBe(seriesCacheKey('roster', 'lucas  davenport!'))
    expect(seriesCacheKey('order', 'Prey', 'John Sandford')).toContain('order')
  })

  test('different kinds never collide', () => {
    expect(seriesCacheKey('roster', 'Prey')).not.toBe(seriesCacheKey('order', 'Prey'))
  })

  test('with no storage available it simply resolves, never throws', async () => {
    // Outside Nitro (tests, prerender) there is no useStorage — the request it
    // was meant to speed up must still work.
    const resolver = vi.fn(async () => ({ books: [1] }))
    const { value, cached } = await withSeriesCache('k', (v) => !v.books.length, resolver)
    expect(value).toEqual({ books: [1] })
    expect(cached).toBe(false)
    expect(resolver).toHaveBeenCalledTimes(1)
  })

  test('an empty answer is held only briefly, a real one for a month', () => {
    const source = read('server/utils/seriesCache.ts')
    // An empty result is not a fact — usually Goodreads refusing — so caching it
    // for a month would blank a series until it expired.
    expect(source).toContain('MISS_TTL_MS = 1000 * 60 * 15')
    expect(source).toContain('HIT_TTL_MS = 1000 * 60 * 60 * 24 * 30')
    expect(source).toMatch(/hit\.empty \? MISS_TTL_MS : HIT_TTL_MS/)
  })

  test('the AI endpoint keys on the series, not on one reader\'s gaps', () => {
    // Anchors and the missing list differ per reader; the answer does not.
    // Keying on them would give everyone their own miss.
    const source = read('server/api/books/series-order.get.ts')
    expect(source).toContain("seriesCacheKey('order', series, author)")
    expect(source).not.toMatch(/seriesCacheKey\('order'[^)]*anchors/)
  })

  test('the roster endpoint keys on the series, not the seed book', () => {
    const source = read('server/api/books/series-books.get.ts')
    expect(source).toContain("seriesCacheKey('roster', series || title")
  })
})
