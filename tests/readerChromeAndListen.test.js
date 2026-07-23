import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')

describe('immersive reader layout', () => {
  test('the book is full-bleed: chrome floats over it instead of carving space out', () => {
    const reader = read('components/mobile/ReaderMobile.vue')
    const paged = read('components/mobile/ReaderPagedEpub.vue')

    // The old padding reserved a top bar (60px) and a dock (150px) that are
    // hidden by default, leaving a dead band above and below the page.
    expect(reader).not.toMatch(/\.reader-mobile-content\s*\{[^}]*padding:\s*calc\(60px/)
    expect(reader).toMatch(/\.reader-mobile-content\s*\{[^}]*padding:\s*calc\(env\(safe-area-inset-top\)/)

    expect(paged).toMatch(/\.paged-viewport\s*\{[^}]*top:\s*calc\(env\(safe-area-inset-top\)/s)
    expect(paged).toMatch(/\.paged-viewport\s*\{[^}]*bottom:\s*calc\(env\(safe-area-inset-bottom\)/s)
    // Reserving dock space here is what pushed the text off the bottom.
    expect(paged).not.toContain('bottom: calc(var(--bottom-nav-space, 72px) + 66px)')
  })

  test('the page-map measurer shares the live viewport geometry', () => {
    // They used to differ deliberately, to keep page counts stable across
    // reading modes. Both are full-bleed now, so an override would only make
    // the printed page numbers disagree with what is on screen.
    expect(read('components/mobile/ReaderMobile.vue'))
      .not.toMatch(/\.page-map-measurer\s*:deep\(\.paged-viewport\)/)
  })

  test('read mode renders no app tab bar, in scroll mode or page mode', () => {
    const reader = read('components/mobile/ReaderMobile.vue')
    expect(reader).not.toContain('MobileBottomNav')
    expect(reader).not.toContain('mobile-bottom-nav-wrap')
    expect(reader).not.toContain('replaceBottomNav')
    // So the chapter dock and play button sit at the screen edge in both modes.
    expect(reader).toMatch(/--bottom-nav-space:\s*env\(safe-area-inset-bottom\)/)
  })

  test('hiding the chrome does not restyle the whole page', () => {
    const reader = read('components/mobile/ReaderMobile.vue')
    // A class on the page root meant every toggle recalculated styles for the
    // entire book subtree — a visible stall on a long book. v-show alone.
    expect(reader).not.toContain("'chrome-hidden': chromeHidden")
    expect(reader).not.toContain('.chrome-hidden')
    expect(reader).toContain('v-show="!chromeHidden"')
  })

  test('listen mode carries no reading controls in its top-right corner', () => {
    const reader = read('components/mobile/ReaderMobile.vue')
    const header = reader.slice(
      reader.indexOf('<header'),
      reader.indexOf('</header>'),
    )
    // Both buttons hang off ONE guard, so Listen shows neither.
    expect(header).toMatch(/v-if="readerMode !== 'listen'" class="reader-top-actions"/)
    expect(header).toContain('Audio and voice options')
    expect(header).toContain('Display settings')
  })
})

describe('listen view follows the reading position', () => {
  const reader = read('components/mobile/ReaderMobile.vue')

  test('the text shown is the page, not the whole chapter it sits in', () => {
    expect(reader).toContain('listenEpubPageRange')
    expect(reader).toContain('firstChunkAtOrAfterPage')
    // Binary search, because chunkPages is a book-length array and this is
    // recomputed whenever the position moves.
    expect(reader).toMatch(/const mid = \(lo \+ hi\) >> 1/)
  })

  test('scroll mode reports where the reader actually is, not the chapter top', () => {
    expect(reader).toContain('scrollChunkIdx')
    expect(reader).toContain('sampleScrollChunk')
    // Sampled on entering Listen rather than tracked per scroll event: it is a
    // DOM probe and only the Listen view reads it.
    expect(reader).toMatch(/if \(mode === "listen"\) sampleScrollChunk\(\);/)
  })
})

describe('reader responsiveness', () => {
  const reader = read('components/mobile/ReaderMobile.vue')

  test('the page-map measurer stands down while the reader is being touched', () => {
    // Each slice lays out a whole chapter and forces layout to read it back.
    // requestIdleCallback's `timeout` ran it anyway on a busy thread — which is
    // exactly when the reader is under a finger.
    expect(reader).toContain('INTERACTION_QUIET_MS')
    expect(reader).toContain('noteInteraction')
    expect(reader).toMatch(/requestIdleCallback\(run, \{ timeout: \d+ \}\)/)
    expect(reader).not.toMatch(/requestIdleCallback\(\(\) => resolve\(\), \{ timeout: 500 \}\)/)
  })

  test('highlights are tinted, never blended', () => {
    // A blend mode forces its stacking context off the compositor, repainting
    // the book column on the CPU every scroll tick and every page turn.
    expect(reader).not.toMatch(/^\s*mix-blend-mode:/m)
    expect(reader).toContain('--annotation-tint')
  })

  test('a selection that never fires touchend still opens the menu', () => {
    expect(reader).toContain('selectionchange')
    expect(reader).toContain('SELECTION_SETTLE_MS')
  })
})

describe('hidden books and playlist screens', () => {
  test('the two hidden-books buttons do not touch', () => {
    const storage = read('components/mobile/SettingsStorageMobile.vue')
    expect(storage).toMatch(/\.hidden-actions\s*\{[^}]*gap:/s)
  })

  test('the hidden books page browses like every other shelf', () => {
    const hidden = read('components/mobile/HiddenBooksMobile.vue')
    // It used to roll its own view chips with different icons, so it looked
    // like a different app from the Books, Playlist and Series pages.
    expect(hidden).toContain('LibraryControlsRow')
    expect(hidden).not.toContain('ri-layout-grid-fill')
    expect(hidden).not.toContain('class="view-chip"')
  })

  test('restore is a labelled button, not a squashed icon', () => {
    const card = read('components/shared/LibraryBookCard.vue')
    // `display: grid` stacked the icon on top of the word, and the list-mode
    // rule squared it off to the icon touch target so the label overflowed.
    expect(card).toMatch(/\.action-button\.restore\s*\{[^}]*display:\s*inline-flex/s)
    expect(card).toMatch(/mobile-list-book-card \.action-button\.restore\s*\{[^}]*width:\s*auto/s)
  })

  test('the playlist page names itself once, and its actions clear the title', () => {
    const playlist = read('components/mobile/PlaylistDetailMobile.vue')
    // The hero already carries the name; repeating it in the bar and then
    // parking edit/delete beside it shoved the title off centre.
    expect(playlist).toContain(':show-title="false"')
    expect(playlist).toContain('#actions')
    expect(playlist).not.toContain('title-row')
    expect(playlist).not.toContain('playlistNavTitle')

    expect(read('components/mobile/MobileSettingsNav.vue')).toContain('<slot name="actions">')
  })

  test('the playlist detail route is not shadowed by the playlists list page', () => {
    // `pages/playlists.vue` plus `pages/playlists/[id].vue` makes Nuxt treat
    // the list as a parent route, so the detail page could never render. The
    // reachable route has always been the singular one.
    expect(existsSync(resolve(root, 'pages/playlists/[id].vue'))).toBe(false)
    expect(existsSync(resolve(root, 'pages/playlist/[id].vue'))).toBe(true)
  })
})

describe('note editor and the on-screen keyboard', () => {
  test('the sheet is anchored to the visual viewport', () => {
    const editor = read('components/mobile/ReaderNoteEditor.vue')
    // `inset: 0` resolves against the layout viewport, which the Android
    // WebView does not always shrink for the keyboard — the sheet ended up
    // behind it, or left a dead band once the keyboard closed.
    expect(editor).toContain('visualViewport')
    expect(editor).toContain('overlayStyle')
    expect(editor).not.toMatch(/\.note-overlay\s*\{[^}]*inset:\s*0/)
    // And it can always be scrolled to its buttons on a short viewport.
    expect(editor).toMatch(/\.note-sheet\s*\{[^}]*max-height:\s*100%/s)
  })
})
