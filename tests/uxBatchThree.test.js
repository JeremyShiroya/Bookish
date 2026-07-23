import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')

describe('edge-to-edge system bars', () => {
  test('the viewport opts into the safe-area insets', () => {
    // Without viewport-fit=cover, env(safe-area-inset-*) resolves to 0 and the
    // app cannot draw under the transparent bars.
    expect(read('nuxt.config.ts')).toContain('viewport-fit=cover')
  })

  test('the Android activity draws edge-to-edge with transparent bars', () => {
    const activity = read('android/app/src/main/java/com/bookish/app/MainActivity.java')
    expect(activity).toContain('setDecorFitsSystemWindows(getWindow(), false)')
    expect(activity).toContain('setStatusBarColor(Color.TRANSPARENT)')
    expect(activity).toContain('setNavigationBarColor(Color.TRANSPARENT)')
  })
})

describe('books sort filter', () => {
  const books = read('components/mobile/BooksMobile.vue')

  test('date-added and name sort options exist', () => {
    expect(books).toContain('Date added')
    expect(books).toContain('Newest first')
    expect(books).toContain('Oldest first')
    expect(books).toContain('setSort')
    // Date added sorts on createdAt.
    expect(books).toContain("sortBy.value === \"added\"")
  })

  test('changing the sort is remembered', () => {
    expect(books).toContain("updateSettings({ librarySort: field, librarySortDirection: direction })")
  })
})

describe('favourites consistency', () => {
  const fav = read('components/mobile/FavouritesMobile.vue')

  test('it uses the shared controls row like every other shelf', () => {
    expect(fav).toContain('LibraryControlsRow')
    // The bespoke bordered view-chip box is gone.
    expect(fav).not.toContain('class="view-chips"')
    expect(fav).not.toContain('.filter-button {')
  })

  test('padding lives on the inner rows, not doubled on the container', () => {
    // The container pads only top/bottom; the controls row and grid own the
    // inline padding, so favourites is no longer inset further than the rest.
    expect(fav).toMatch(/\.favourites-container\s*\{[^}]*padding-top:/s)
    expect(fav).not.toMatch(/\.favourites-container\s*\{[^}]*padding:\s*calc\([^)]*\)\s+var\(--mobile-page-padding-inline\)/s)
    expect(fav).toMatch(/\.favourites-controls\s*\{[^}]*padding:\s*0 var\(--mobile-page-padding-inline\)/s)
  })
})

describe('selection styling', () => {
  test('no radio tick anywhere; a thick purple ring instead', () => {
    const card = read('components/shared/LibraryBookCard.vue')
    const series = read('components/shared/SeriesCollageCard.vue')
    expect(card).not.toContain('select-tick')
    expect(series).not.toContain('select-tick')

    // Grid: the ring hugs the cover.
    expect(card).toMatch(/\.library-book-card\.selected \.card-cover\s*\{[^}]*outline:\s*3px solid var\(--color-brand-primary\)/s)
    // List: the ring wraps the whole card.
    expect(card).toMatch(/\.mobile-list-book-card\.selected\s*\{[^}]*outline:\s*3px solid var\(--color-brand-primary\)/s)
    // Series/playlist card: an inset ring following the rounded corners.
    expect(series).toMatch(/\.series-card\.selected\s*\{[^}]*box-shadow:\s*0 0 0 3px var\(--color-brand-primary\) inset/s)
  })
})

describe('series suggestion covers', () => {
  test('a missing installment uses the same corner radius as a real cover', () => {
    // Real covers (LibraryBookCard .card-cover) are 8px; the placeholder used
    // to be var(--mobile-card-radius) ~20px and stuck out.
    expect(read('components/mobile/SeriesDetailMobile.vue'))
      .toMatch(/\.missing-cover\s*\{[^}]*border-radius:\s*8px/s)
  })
})

describe('note badge placement', () => {
  test('the note flag sits at the top-left of the word', () => {
    const reader = read('components/mobile/ReaderMobile.vue')
    const rule = reader.slice(
      reader.indexOf('.annotation-mark[data-has-note="true"])::before'),
      reader.indexOf('.annotation-mark[data-has-note="true"])::before') + 300,
    )
    expect(rule).toMatch(/top:\s*-0\.35em/)
    expect(rule).toMatch(/left:\s*-0\.15em/)
    // No trailing ::after badge on the right any more.
    expect(reader).not.toContain('data-has-note="true"])::after')
  })
})

describe('open-in-book lands on the annotation', () => {
  test('the reader page passes the chunk down, and the paged reader honours it', () => {
    const page = read('pages/reader/[id].vue')
    expect(page).toContain('openToChunk')
    expect(page).toContain(':open-to-chunk="openToChunk"')

    const paged = read('components/mobile/ReaderPagedEpub.vue')
    expect(paged).toContain('goToChunk')
    // The open-jump wins over the restored position.
    expect(paged).toContain('_openJumpPending')
    // And it lands instantly rather than animating a page-turn across the book.
    expect(paged).toMatch(/animate\.value = false;\s*\n\s*page\.value = Math\.max/)
  })
})

describe('active playlist icon', () => {
  test('uses ri-play-list-2-fill, not ri-play-list-fill', () => {
    expect(read('components/shared/LibraryBookCard.vue')).toContain('ri-play-list-2-fill')
    expect(read('components/shared/LibraryBookCard.vue')).not.toContain("'ri-play-list-fill'")
    expect(read('components/shared/AddToPlaylistModal.vue')).not.toContain("'ri-play-list-fill'")
  })
})

describe('playlist overflow menu', () => {
  test('a top-right menu button replaces the long-press modal, hidden while selecting', () => {
    const card = read('components/shared/SeriesCollageCard.vue')
    expect(card).toContain('card-menu-btn')
    expect(card).toContain("$emit('menu'")
    // Only when not selecting.
    expect(card).toContain('v-if="showMenu && !selectable"')

    const playlists = read('components/mobile/PlaylistsMobile.vue')
    expect(playlists).toContain('show-menu')
    expect(playlists).toContain('@menu=')
    // The card no longer opens the edit/delete menu from a long-press contextmenu.
    expect(playlists).not.toContain('@contextmenu="(e) => openContextMenu(e, playlist)"')
  })
})
