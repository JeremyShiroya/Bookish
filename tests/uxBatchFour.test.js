import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { installmentNeedsDetails } from '../composables/useSeriesSuggestions.js'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')

describe('selection ring parity', () => {
  test('a playlist card wears the same ring as a book on the Books page', () => {
    const card = read('components/shared/LibraryBookCard.vue')
    const series = read('components/shared/SeriesCollageCard.vue')

    const bookRing = card.match(/\.library-book-card\.selected \.card-cover\s*\{([^}]*)\}/s)?.[1] || ''
    const cardRing = series.match(/\.series-card\.selected\s*\{([^}]*)\}/s)?.[1] || ''

    // Same width, same colour, and the same outward offset — an inset ring read
    // differently from the Books page.
    for (const rule of ['outline: 3px solid var(--color-brand-primary)', 'outline-offset: 2px']) {
      expect(bookRing, `book ${rule}`).toContain(rule)
      expect(cardRing, `playlist ${rule}`).toContain(rule)
    }
  })
})

describe('playlist card overflow button is reachable', () => {
  const series = read('components/shared/SeriesCollageCard.vue')

  test('it stacks above the title block that covers the card top', () => {
    // .series-meta is absolutely positioned across the whole top edge at
    // z-index 40, so at z-index 5 every tap on the button hit the title block
    // and bubbled to the card — opening the playlist instead of the menu.
    const meta = series.match(/\.series-meta\s*\{([^}]*)\}/s)?.[1] || ''
    const btn = series.match(/\.card-menu-btn\s*\{([^}]*)\}/s)?.[1] || ''

    const metaZ = Number(meta.match(/z-index:\s*(\d+)/)?.[1])
    const btnZ = Number(btn.match(/z-index:\s*(\d+)/)?.[1])
    expect(btnZ).toBeGreaterThan(metaZ)

    // And the title block never intercepts a tap of its own.
    expect(meta).toContain('pointer-events: none')
  })

  test('it is a comfortable tap target', () => {
    const btn = series.match(/\.card-menu-btn\s*\{([^}]*)\}/s)?.[1] || ''
    expect(Number(btn.match(/width:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(40)
    expect(Number(btn.match(/height:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(40)
  })
})

describe('playlist detail overflow icon', () => {
  test('bare icon in the back arrow’s colour, no border or fill', () => {
    const detail = read('components/mobile/PlaylistDetailMobile.vue')
    const rule = detail.match(/\.title-action\s*\{([^}]*)\}/s)?.[1] || ''
    expect(rule).toContain('border: 0')
    expect(rule).toContain('background: transparent')
    // MobileSettingsNav paints its back arrow with --color-text-primary.
    expect(rule).toContain('color: var(--color-text-primary)')
    expect(read('components/mobile/MobileSettingsNav.vue')).toContain('color: var(--color-text-primary)')
  })
})

describe('system bar icons follow the theme', () => {
  test('a native plugin flips the bar appearance', () => {
    const plugin = read('android/app/src/main/java/com/bookish/app/SystemBarsPlugin.java')
    expect(plugin).toContain('setAppearanceLightStatusBars(!dark)')
    expect(plugin).toContain('setAppearanceLightNavigationBars(!dark)')
    expect(read('android/app/src/main/java/com/bookish/app/MainActivity.java'))
      .toContain('registerPlugin(SystemBarsPlugin.class)')
  })

  test('the theme switch is what calls it', () => {
    const settings = read('composables/useBookishSettings.js')
    expect(settings).toContain('syncSystemBarAppearance')
    // Called from the single place the theme is applied, with dark = dark theme.
    expect(settings).toMatch(/syncSystemBarAppearance\(normalizedTheme === 'dark'\)/)
    expect(settings).toContain("SystemBars?.setAppearance")
  })
})

describe('series suggestions persist and keep filling in', () => {
  test('an installment is only finished with a cover, author and year', () => {
    expect(installmentNeedsDetails({ title: 'X' })).toBe(true)
    expect(installmentNeedsDetails({ title: 'X', cover: 'c', author: 'a' })).toBe(true)
    expect(installmentNeedsDetails({ title: 'X', cover: 'c', author: 'a', year: 2001 })).toBe(false)
    expect(installmentNeedsDetails(null)).toBe(true)
  })

  test('cached suggestions are hydrated into the store up front', () => {
    const suggestions = read('composables/useSeriesSuggestions.js')
    expect(suggestions).toContain('export const hydrateSeriesSuggestions')
    // Both on app open (native plugin) and lazily on first use elsewhere.
    expect(read('plugins/device-library-sync.client.js')).toContain('hydrateSeriesSuggestions()')
    expect(suggestions).toContain('_hydrated')
  })

  test('the sweep tops up under-detailed suggestions and writes them back', () => {
    const suggestions = read('composables/useSeriesSuggestions.js')
    expect(suggestions).toContain('topUpSuggestionDetails')
    expect(suggestions).toContain('fetchBookMetadataResults')
    // Same verification guard as the automatic book-details backfill.
    expect(suggestions).toContain('metadataResultMatchesBook')
    // Persisted, so the next open already has them.
    expect(suggestions).toMatch(/writeCache\(series\.name, cached\)/)
    // Bounded per cycle so it does not monopolise the shared sources.
    expect(suggestions).toContain('DETAIL_BATCH')
  })
})
