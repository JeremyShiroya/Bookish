import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  countPendingTargets,
  needsGoodreads,
  nextCooldownMs,
  pickAutoTargets,
} from '../composables/useAutoMetadata.js'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')

const complete = {
  title: 'A Book', author: 'An Author', blurb: 'words', genre: 'Fiction',
  publishYear: 2020, cover: 'https://x/cover.jpg', webReview: { rating: 4.2 },
}

describe('adaptive cooldown', () => {
  test('an empty queue means rest, not spin', () => {
    expect(nextCooldownMs({ pending: 0 })).toBeGreaterThanOrEqual(60_000)
  })

  test('a backlog with healthy lookups hurries', () => {
    const busy = nextCooldownMs({ pending: 120, attempted: 3, failed: 0 })
    expect(busy).toBeLessThanOrEqual(30_000)
    // ...and is far shorter than the old fixed four-minute rest.
    expect(busy).toBeLessThan(nextCooldownMs({ pending: 0 }))
  })

  test('a backlog where most lookups threw backs off instead', () => {
    const failing = nextCooldownMs({ pending: 120, attempted: 4, failed: 3 })
    const healthy = nextCooldownMs({ pending: 120, attempted: 4, failed: 0 })
    expect(failing).toBeGreaterThan(healthy)
  })

  test('a backgrounded app is gentle even with a backlog', () => {
    const hidden = nextCooldownMs({ pending: 120, attempted: 3, failed: 0, isForeground: false })
    const shown = nextCooldownMs({ pending: 120, attempted: 3, failed: 0, isForeground: true })
    expect(hidden).toBeGreaterThan(shown)
  })
})

describe('skipping the slow source when it has nothing to add', () => {
  test('Goodreads is needed for the rating', () => {
    expect(needsGoodreads({ ...complete, webReview: null })).toBe(true)
  })

  test('Goodreads is needed for a series position', () => {
    expect(needsGoodreads({ ...complete, series: 'The Saga' })).toBe(true)
    expect(needsGoodreads({
      ...complete, series: 'The Saga', seriesInstallment: 2, seriesTotal: 5,
    })).toBe(false)
  })

  test('a book missing only a cover or blurb does not need it', () => {
    // Every other source can supply these, and Goodreads is the 25s tail on
    // the lookup — the other providers cap at 9s.
    expect(needsGoodreads({ ...complete, cover: '' })).toBe(false)
    expect(needsGoodreads({ ...complete, blurb: '' })).toBe(false)
    expect(needsGoodreads({ ...complete, genre: '', publishYear: 0 })).toBe(false)
  })

  test('the pipeline actually drops it when asked', () => {
    const device = read('composables/useDeviceMetadataSearch.js')
    expect(device).toContain('const skipGoodreads = options.skipGoodreads === true')
    expect(device).toContain('skipGoodreads ? Promise.resolve([]) : getGoodreadsSources(title, author)')
    // The runner decides per book.
    expect(read('composables/useAutoMetadata.js'))
      .toContain('skipGoodreads: !needsGoodreads(book)')
  })
})

describe('what gets looked up first', () => {
  const base = { author: '', blurb: '', genre: '', publishYear: 0, cover: '' }

  test('the book being read comes before the rest', () => {
    const picked = pickAutoTargets([
      { ...base, id: 'old', title: 'Old', createdAt: '2020-01-01' },
      { ...base, id: 'reading', title: 'Reading', status: 'Reading', createdAt: '2019-01-01' },
    ], { limit: 2 })
    expect(picked[0].id).toBe('reading')
  })

  test('otherwise the most recently added', () => {
    const picked = pickAutoTargets([
      { ...base, id: 'old', title: 'Old', createdAt: '2020-01-01' },
      { ...base, id: 'new', title: 'New', createdAt: '2026-01-01' },
    ], { limit: 2 })
    expect(picked.map((b) => b.id)).toEqual(['new', 'old'])
  })

  test('the batch is still capped', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ ...base, id: String(i), title: `T${i}` }))
    expect(pickAutoTargets(many, { limit: 3 })).toHaveLength(3)
  })
})

describe('backlog counting', () => {
  test('counts every book still carrying a gap, not just this batch', () => {
    const books = [
      { title: 'a', author: '' },
      { title: 'b', author: '' },
      complete,
    ]
    expect(countPendingTargets(books)).toBe(2)
  })

  test('a book inside its 24h backoff is not pending', () => {
    const now = Date.now()
    expect(countPendingTargets(
      [{ title: 'a', author: '', metaCheckedAt: now - 1000 }],
      { now, cooldownMs: 10_000 },
    )).toBe(0)
  })
})

describe('one shared scheduler', () => {
  test('the batch runs concurrently rather than in single file', () => {
    const auto = read('composables/useAutoMetadata.js')
    expect(auto).toContain('CONCURRENCY')
    expect(auto).toContain('Promise.all(Array.from({ length: lanes }, worker))')
    // The old fixed 4s gap between books is gone.
    expect(auto).not.toContain('BETWEEN_BOOKS_MS')
  })

  test('the series sweep takes its turn in the same loop', () => {
    const auto = read('composables/useAutoMetadata.js')
    const plugin = read('plugins/auto-metadata.client.js')
    expect(auto).toContain('runSeriesSweep')
    expect(plugin).toContain('runSeriesSuggestionSweep')
    // Injected, not imported, so the two composables avoid a cycle.
    expect(auto).not.toContain("from '~/composables/useSeriesSuggestions'")
    // And it no longer has an independent timer of its own.
    expect(read('plugins/device-library-sync.client.js')).not.toContain('startSeriesSuggestionSweep')
  })

  test('the loop keeps turning with the book fill switched off', () => {
    // Otherwise turning off metadataAutoFill would silently stop the series
    // sweep too, since they now share the scheduler.
    const auto = read('composables/useAutoMetadata.js')
    expect(auto).toContain('isFillEnabled')
    expect(read('plugins/auto-metadata.client.js')).toContain('isFillEnabled')
  })
})

describe('change-cover affordance', () => {
  test('an existing cover carries a centred, always-on call to action', () => {
    for (const path of [
      'components/mobile/AddBookMobile.vue',
      'components/mobile/EditBookMobile.vue',
    ]) {
      const source = read(path)
      expect(source, path).toContain('Tap to change cover')

      // Visible whenever there IS a cover, not only on hover — a touch screen
      // never hovers, so hover-gating meant no affordance at all on a phone.
      expect(source, path).toMatch(/\.cover-overlay\.active\s*\{[^}]*opacity:\s*1/s)
      expect(source, path).not.toMatch(/\.cover-container:hover \.cover-overlay\.active\s*\{[^}]*opacity:\s*1/s)

      // A large icon in the middle of the artwork, not a small strip.
      expect(source, path).toMatch(/\.cover-overlay\s*\{[^}]*justify-content:\s*center/s)
      expect(source, path).toMatch(/\.cover-overlay i\s*\{[^}]*border-radius:\s*50%/s)

      // Signage only: the container underneath owns the tap.
      expect(source, path).toMatch(/\.cover-overlay\s*\{[^}]*pointer-events:\s*none/s)

      // The old bottom strip is gone.
      expect(source, path).not.toContain('cover-change-hint')
    }
  })
})
