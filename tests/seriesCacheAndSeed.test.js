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

// A seeded series is complete the moment the app opens: no network, no quota,
// works offline.
describe('bundled series seed', () => {
  const seed = JSON.parse(read('public/series-seed.json'))
  const composable = read('composables/useSeriesSuggestions.js')

  test('the shipped file is well formed', () => {
    expect(seed.version).toBe(1)
    expect(Object.keys(seed.series).length).toBeGreaterThan(0)
  })

  test('every shipped slot is actually displayable', () => {
    // A bare number with no title helps nobody — it would render as a blank
    // card that looks like a bug.
    for (const [key, series] of Object.entries(seed.series)) {
      for (const [number, entry] of Object.entries(series.installments)) {
        expect(/^\d+$/.test(number), `${key} #${number}`).toBe(true)
        expect(entry.title, `${key} #${number}`).toBeTruthy()
      }
    }
  })

  test('the seed never overwrites what the device already resolved', () => {
    // The device's own lookups are this reader's, and newer. A seed fills
    // blanks; it is not an authority.
    expect(composable).toContain('export const seedSeriesSuggestions')
    expect(composable).toContain('mergeInstallments(existing || {}, installments)')
    expect(composable).toMatch(/A seed only ever fills blanks/)
  })

  test('a missing or broken seed is survivable', () => {
    // The app must work with no seed shipped at all.
    expect(composable).toMatch(/if \(!response\.ok\) return 0/)
    expect(composable).toMatch(/catch \{[\s\S]*?return 0/)
  })

  test('it is applied at app start, not only when a series page opens', () => {
    // Seeding from the series page alone would leave the FIRST series a reader
    // opens still doing a live lookup — the one case the seed exists to avoid.
    expect(composable).toContain('seedSeriesSuggestions().catch(() => {})')
    const plugin = read('plugins/device-library-sync.client.js')
    expect(plugin).toContain('seedSeriesSuggestions')
    expect(plugin).toMatch(/runWithContext\(\(\) => seedSeriesSuggestions\(\)/)
  })
})
