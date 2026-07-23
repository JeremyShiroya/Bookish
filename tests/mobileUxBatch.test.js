import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')

describe('mobile UX batch', () => {
  test('books page uses a fixed floating add button instead of toolbar buttons', () => {
    const books = read('components/mobile/BooksMobile.vue')

    expect(books).toContain('class="add-book-fab"')
    expect(books).toMatch(/\.add-book-fab\s*\{[^}]*position:\s*fixed/)
    expect(books).not.toContain('mobile-add-book-btn"')
    // The reading-status Filter dropdown lives on the left; the view toggle is
    // pinned to the right end.
    const controlsLeft = books.slice(books.indexOf('class="controls-left"'), books.indexOf('class="controls-right"'))
    const controlsRight = books.slice(books.indexOf('class="controls-right"'), books.indexOf('Grid View'))
    expect(controlsLeft).toContain('filter-dropdown')
    expect(controlsLeft).not.toContain('view-chips')
    expect(controlsRight).toContain('view-chips')
  })

  test('mobile books page carries no desktop-only leftovers', () => {
    const books = read('components/mobile/BooksMobile.vue')
    // The Filter dropdown (filter-dropdown / sfp-pill) is now an intentional
    // mobile control, so it is no longer treated as a desktop-only leftover.
    for (const marker of ['data-table', 'pagination', 'isMobileViewport', 'metric-card', 'books-header']) {
      expect(books, marker).not.toContain(marker)
    }
  })

  test('device scan folders are configurable and filter the boot scan', () => {
    const sync = read('composables/useDeviceLibrarySync.js')
    expect(sync).toContain('readScanFolders')
    expect(sync).toContain('fileInScanFolders')
    expect(sync).toContain('Scanning your device for new books')
    expect(sync).toContain('no new books found')

    const storage = read('components/mobile/SettingsStorageMobile.vue')
    expect(storage).toContain('Scanned folders')
    expect(storage).toContain('removeScanFolder')
    expect(storage).toContain('addScanFolder')
    expect(storage).toContain('Scan device now')
  })

  test('mini playing bar shows only on tab roots and opens the narrated section', () => {
    const bar = read('components/mobile/MobilePlayingBar.vue')
    // Whitelisted to the main tab roots — hidden on detail/settings/reader pages.
    expect(bar).toContain('NAV_ROUTES.has(route.path)')
    // Tapping the mini bar opens the reader's Listen mode.
    expect(bar).toContain('router.push(`/reader/${ttsBook.value.id}?mode=listen`)')
    expect(bar).toContain('bar-progress-fill')
    // Swipe-to-close.
    expect(bar).toContain('onTouchEnd')
    expect(bar).toContain('stopTTS()')

    const layout = read('layouts/default.vue')
    expect(layout).toContain('MobilePlayingBar')

    const reader = read('pages/reader/[id].vue')
    expect(reader).toContain('sectionForChunk(ttsChunkIdx.value)')
    expect(reader).toContain('jumpToNarration()')
  })

  test('mini player is teleported to body with a themed blur backdrop', () => {
    const bar = read('components/mobile/MobilePlayingBar.vue')
    expect(bar).toContain('<Teleport to="body">')
    expect(bar).toContain('bar-backdrop')
    expect(bar).not.toContain('--color-surface-inverse')
    expect(bar).toContain("matchMedia('(max-width: 768px)')")
  })

  test('add FAB lifts above the mini player and sits above it in z-order', () => {
    const books = read('components/mobile/BooksMobile.vue')
    expect(books).toContain('miniPlayerVisible')
    expect(books).toContain('above-mini-player')
    expect(books).toMatch(/\.add-book-fab\s*\{[^}]*z-index:\s*1310/)
  })

  test('continue-reading card exposes a working play control', () => {
    const card = read('components/shared/HomeContinueReadingCard.vue')
    expect(card).toContain("$emit('play', book)")
    expect(card).toContain('@click.stop')
    expect(card).toContain('ri-pause-fill')

    const home = read('components/mobile/HomeMobile.vue')
    expect(home).toContain('handleContinuePlay')
    expect(home).toContain('@play="handleContinuePlay"')
  })

  test('currently-reading ordering favours real reading activity', () => {
    const useBooks = read('composables/useBooks.js')
    expect(useBooks).toContain('lastReadAt')
    expect(useBooks).toContain("a.status === 'Reading'")

    const reader = read('pages/reader/[id].vue')
    expect(reader).toContain('lastReadAt: new Date().toISOString()')
  })

  test('device import reads bytes through the native plugin', () => {
    const sync = read('composables/useDeviceLibrarySync.js')
    expect(sync).toContain('DeviceBooks.readFile')
    expect(sync).toContain('readDeviceFileBase64')

    const plugin = read('android/app/src/main/java/com/bookish/app/DeviceBooksPlugin.java')
    expect(plugin).toContain('public void readFile(PluginCall call)')
    expect(plugin).toContain('Base64.encodeToString')
  })

  test('series card blur paints a real cover image (series-detail hero technique)', () => {
    const seriesCard = read('components/shared/SeriesCollageCard.vue')
    // The opt-in blur paints a real <img> cover — the same technique as the
    // series-detail hero backdrop — so device cover URLs render and a dead cover
    // degrades via onCoverError, rather than a CSS background-image.
    expect(seriesCard).toContain('card-bg')
    expect(seriesCard).toMatch(/\.card-bg img\s*\{/)
    expect(seriesCard).toContain('filter: blur(25px) saturate(150%)')
    expect(seriesCard).toContain('onCoverError($event, series.name)')
    expect(seriesCard).not.toMatch(/\.card-bg\s*\{[^}]*background-size/)
    // The default background stays the original #e8e8f1 surface, not white.
    expect(seriesCard).toContain('#e8e8f1')
    expect(seriesCard).not.toContain('color-mix(in srgb, var(--color-surface-primary)')

    const cover = read('components/shared/CoverImageModal.vue')
    expect(cover).toContain('cover-modal-body')
    expect(cover).toMatch(/\.cover-modal-body\s*\{[^}]*overflow-y:\s*auto/)
  })

  test('preferences page shows visual previews for every option, cards and reading alike', () => {
    const prefs = read('components/mobile/PreferencesMobile.vue')
    expect(prefs).toContain('SeriesPreview')
    expect(prefs).toContain('ReadingPreview')
    expect(prefs).toContain('class="preview"')

    expect(existsSync(resolve(root, 'components/shared/previews/SeriesCardPreview.vue'))).toBe(true)
    expect(existsSync(resolve(root, 'components/shared/previews/ReadingPreview.vue'))).toBe(true)
  })

  test('reader uses comfortable book typography and PDF long-press', () => {
    const reader = read('components/mobile/ReaderMobile.vue')
    expect(reader).toMatch(/\.reader-mobile-text\s*\{[^}]*text-align:\s*var\(--mr-text-align, justify\)/)
    expect(reader).toMatch(/\.reader-mobile-text\s*\{[^}]*hyphens:\s*auto/)
    // PDF pane shares the reader's selection detection (the old bespoke
    // long-press bubble was replaced by native selection + an action menu).
    expect(reader).toMatch(/reader-mobile-pdf[\s\S]{0,160}onSelectionSettled/)

    const readerPage = read('pages/reader/[id].vue')
    expect(readerPage).toContain("closest?.('[data-page]')")
  })

  test('series and playlist detail pages use the hero redesign', () => {
    for (const path of ['components/mobile/SeriesDetailMobile.vue', 'components/mobile/PlaylistDetailMobile.vue']) {
      const source = read(path)
      expect(source, path).toContain('hero-backdrop')
      expect(source, path).toContain('@hide="handleHideBook"')
      // The hero is cover art + copy only: no read button, no progress bar.
      expect(source, path).not.toContain('hero-progress')
      expect(source, path).not.toContain('hero-play')
      // Books, filter, and view options match the Books page.
      expect(source, path).toContain('LibraryControlsRow')
      expect(source, path).toContain('books-grid')
      expect(source, path).toContain('mobile-list-book-card')
    }
  })

  test('the reader play button resumes a paused book instead of rewinding', () => {
    const reader = read('components/mobile/ReaderMobile.vue')
    // playFromHere must branch on "is this book loaded into the narrator"
    // (playing OR paused), not on "is it playing" — otherwise pressing play
    // after a pause re-reads from the first chunk of the visible page.
    expect(reader).toMatch(/const playFromHere = \(\) => \{[\s\S]{0,400}?if \(isThisBookNarrating\.value\) \{/)
    // Resuming in place stays the default…
    expect(reader).toMatch(/if \(movedAway\) \{[\s\S]{0,160}?\}\s*togglePlay\(\);/)
  })

  test('resuming after turning to another page asks instead of guessing', () => {
    const reader = read('components/mobile/ReaderMobile.vue')
    expect(reader).toContain('resumeChoice')
    expect(reader).toContain('playFromShownPage')
    expect(reader).toContain('resumeWhereLeftOff')
    // Only when PAUSED and genuinely elsewhere — scrolling around the passage
    // being narrated must not trigger it.
    expect(reader).toMatch(/const movedAway = paused/)
  })

  test('mobile library pages show a per-page empty-state illustration, not an icon', () => {
    const expected = {
      'components/mobile/HomeMobile.vue': 'illustration="library"',
      'components/mobile/BooksMobile.vue': 'illustration="books"',
      'components/mobile/SeriesMobile.vue': 'illustration="series"',
      'components/mobile/FavouritesMobile.vue': 'illustration="favourites"',
      'components/mobile/PlaylistsMobile.vue': 'illustration="playlists"',
    }
    for (const [path, marker] of Object.entries(expected)) {
      expect(read(path), path).toContain(marker)
    }

    // The illustrations are inline SVG so they recolour with the theme.
    const emptyState = read('components/shared/EmptyState.vue')
    expect(emptyState).toContain('empty-illustration')
    expect(emptyState).toContain('<svg')
  })

  test('home renders one hero empty state and hides sections with no content', () => {
    const home = read('components/mobile/HomeMobile.vue')
    // Empty library: a single welcome hero, not an empty state per section.
    expect(home).toContain('initialized && books.length === 0')
    // Currently Reading / Series only render when they have content.
    expect(home).toContain('<section v-if="currentReadingBook"')
    expect(home).toContain('<section v-if="mobileSeries.length > 0"')
    // No leftover per-section empty states anywhere on home.
    expect(home.match(/<EmptyState/g)).toHaveLength(2)
  })

  test('home search results come straight off the bound input', () => {
    const home = read('components/mobile/HomeMobile.vue')
    // No submit handler and no debounce: the computed re-runs on every keystroke.
    expect(home).toContain('v-model="homeSearch"')
    expect(home).toContain('searchLibrary(books.value, homeSearch.value)')
    expect(home).not.toContain('setTimeout')
  })

  test('book detail page cannot overflow horizontally', () => {
    const detail = read('components/mobile/BookDetailMobile.vue')
    expect(detail).toMatch(/\.book-detail-page\s*\{[^}]*overflow-x:\s*hidden/)
    expect(detail).toContain('overflow-wrap: anywhere')
  })

  test('list rows and book detail expose favourite, playlist, edit, hide, delete', () => {
    const card = read('components/shared/LibraryBookCard.vue')
    expect(card).toContain("'hide'")
    expect(card).toContain('ri-eye-off-line')

    const books = read('components/mobile/BooksMobile.vue')
    expect(books).toContain('@hide="handleHideBook"')

    const detail = read('components/mobile/BookDetailMobile.vue')
    for (const marker of ['ri-heart', 'ri-play-list-2-line', 'ri-edit-line', 'ri-eye-off-line', 'ri-delete-bin-line']) {
      expect(detail).toContain(marker)
    }
    expect(detail).toContain('AddToPlaylistModal')
    expect(detail).toContain('DeleteConfirmModal')
    expect(detail).not.toContain('ri-book-shelf-line')

    const useBooks = read('composables/useBooks.js')
    expect(useBooks).toContain('const hideBook')
    expect(useBooks).toContain('restoreHiddenBooks')
    expect(useBooks).toContain('!book.isHidden')
  })

  test('metadata fetch offers a keep-current-cover option in all four forms', () => {
    for (const path of [
      'components/shared/AddBookComp.vue',
      'components/shared/EditBookComp.vue',
      'components/mobile/AddBookMobile.vue',
      'components/mobile/EditBookMobile.vue',
    ]) {
      const source = read(path)
      expect(source, path).toContain('keepCurrentCover')
      expect(source, path).toContain('Keep my current book cover')
      expect(source, path).toMatch(/result\.cover && !\(keepCurrentCover\.value/)
    }
  })

  test('toasts render as tinted alert bars pinned to the top', () => {
    const toast = read('components/shared/ToastComp.vue')

    expect(toast).toMatch(/\.toast-container\s*\{[^}]*top:\s*calc\(env\(safe-area-inset-top\)/)
    expect(toast).not.toMatch(/\.toast-container[^}]*bottom:/)
    expect(toast).toContain('ri-close-circle-line')
    expect(toast).toMatch(/\.toast\.success\s*\{[^}]*background:\s*#e9f7ee/)
    expect(toast).toMatch(/\.toast\.error\s*\{[^}]*background:\s*#fdecec/)
  })

  test('storage page has a mobile design with metadata backfill and failure modal', () => {
    const page = read('pages/settings/storage.vue')
    expect(page).toContain('SettingsStorageMobile')
    expect(page).toContain('ResponsiveViewSwitch')

    const mobile = read('components/mobile/SettingsStorageMobile.vue')
    // The run lives in the composable so it survives navigation; the page
    // only starts it and observes shared progress.
    expect(mobile).toContain('useLibraryBackfill')
    expect(mobile).toContain('backfill-bar')
    expect(mobile).toContain('View {{ backfill.failures.length }} unsuccessful')
    expect(mobile).toContain('failures-modal')
    expect(mobile).toContain('restoreHiddenBooks')
    // Server connection, Backup and the manual "save covers offline" button
    // were removed: the first two are meaningless to most readers, and covers
    // are cached automatically on every library load.
    expect(mobile).not.toContain('Server connection')
    expect(mobile).not.toContain('Save covers for offline')
    expect(mobile).not.toMatch(/<h2>Backup<\/h2>/)

    const backfill = read('composables/useMetadataBackfill.js')
    expect(backfill).toContain('bookNeedsMetadata')
    expect(backfill).toContain('failures.push')
  })

  test('device file access uses a styled in-app modal instead of window.confirm', () => {
    const sync = read('composables/useDeviceLibrarySync.js')
    expect(sync).not.toContain('window.confirm')
    expect(sync).toContain('useDevicePermissionPrompt')

    const modal = read('components/shared/DevicePermissionModal.vue')
    expect(modal).toContain('All files access')
    expect(modal).toContain('Allow access')

    const app = read('app.vue')
    expect(app).toContain('DevicePermissionModal')

    const plugin = read('plugins/device-library-sync.client.js')
    expect(plugin).toContain('runWithContext')
  })

  test('hardware back button navigates instead of closing the app', () => {
    const pkg = JSON.parse(read('package.json'))
    expect(pkg.dependencies['@capacitor/app']).toBeTruthy()

    const backPlugin = read('plugins/android-back-button.client.js')
    expect(backPlugin).toContain("App.addListener('backButton'")
    expect(backPlugin).toContain('router.back()')
    expect(backPlugin).toContain('App.minimizeApp()')
  })

  test('android launcher uses the generated Bookish icons', () => {
    expect(existsSync(resolve(root, 'assets/icon-only.png'))).toBe(true)
    expect(existsSync(resolve(root, 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png'))).toBe(true)
    expect(existsSync(resolve(root, 'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml'))).toBe(true)
  })

  test('audio settings page is removed from mobile settings', () => {
    expect(existsSync(resolve(root, 'pages/settings/audio.vue'))).toBe(false)
    expect(read('components/mobile/SettingsMobile.vue')).not.toContain('/settings/audio')
  })

  test('mobile pages use mobile-shaped skeletons, not the wide-layout ones', () => {
    expect(existsSync(resolve(root, 'components/mobile/MobileSkeleton.vue'))).toBe(true)
    const skeleton = read('components/mobile/MobileSkeleton.vue')
    for (const page of ['home', 'books', 'series', 'favourites', 'playlists']) {
      expect(skeleton, page).toContain(`'${page}'`)
    }

    const pages = {
      'components/mobile/HomeMobile.vue': 'home',
      'components/mobile/BooksMobile.vue': 'books',
      'components/mobile/SeriesMobile.vue': 'series',
      'components/mobile/FavouritesMobile.vue': 'favourites',
      'components/mobile/PlaylistsMobile.vue': 'playlists',
    }
    for (const [file, page] of Object.entries(pages)) {
      const source = read(file)
      expect(source, file).toContain(`<MobileSkeleton page="${page}"`)
      expect(source, file).not.toContain('<SkeletonLoader')
    }
  })

  test('the mobile library has no personal rating anywhere', () => {
    for (const file of [
      'components/mobile/BooksMobile.vue',
      'components/mobile/BookDetailMobile.vue',
      'components/mobile/AddBookMobile.vue',
      'components/mobile/EditBookMobile.vue',
    ]) {
      const source = read(file)
      expect(source, file).not.toContain('Personal Rating')
      expect(source, file).not.toMatch(/\brating-star\b/)
    }

    // The shared card keeps the row for the wide layout, behind an opt-out prop.
    const card = read('components/shared/LibraryBookCard.vue')
    expect(card).toContain('showPersonalRating')
    expect(card).toContain('v-if="showPersonalRating"')
    for (const file of ['components/mobile/BooksMobile.vue', 'components/mobile/FavouritesMobile.vue']) {
      expect(read(file), file).toContain(':show-personal-rating="false"')
    }
  })

  test('deleting a book removes it for real, and the modal says so', () => {
    const books = read('composables/useBooks.js')
    // The record write is awaited and rethrown; cleanup of the cached cover and
    // the on-device document happens after, best-effort.
    expect(books).toContain('deleteDeviceImport')
    expect(books).toMatch(/remove\('covers', name\)/)

    const sync = read('composables/useDeviceLibrarySync.js')
    expect(sync).toContain('export async function deleteDeviceImport')
    // A tombstone keeps a deleted book deleted even if the file survived.
    expect(sync).toContain('deletedByUser')
    expect(sync).toContain('if (known.deletedByUser) return false')

    const plugin = read('android/app/src/main/java/com/bookish/app/DeviceBooksPlugin.java')
    expect(plugin).toContain('public void deleteFile(PluginCall call)')

    const modal = read('components/shared/DeleteConfirmModal.vue')
    expect(modal).toContain('permanently removes the book')
    expect(modal).toContain('removesDeviceFile')
    expect(modal).toContain('Delete permanently')
    // Points the user at Hide, the non-destructive neighbour.
    expect(modal).toContain('Hide')
  })

  test('reader thickness options map to weights the reader fonts actually ship', () => {
    const prefs = read('composables/useMobileReaderPrefs.js')
    // Georgia only has 400/700, so 300 and 500 collapsed onto 400 and the
    // thickness control did nothing. Literata is variable across 300-700.
    expect(prefs).toContain('Literata')
    expect(prefs).not.toMatch(/stack:\s*"Georgia/)
    expect(read('assets/css/main.css')).toContain('family=Literata')
  })

  // Regression: main.css applies `font-weight: 400 !important` to p/div/span for
  // the app chrome, which silently defeated the reader's Thickness control. The
  // book text must out-specify it, or Light/Normal/Medium/Bold all look the same.
  test('reader body text wins the global font-weight !important reset', () => {
    const globalCss = read('assets/css/main.css')
    expect(globalCss).toMatch(/font-weight:\s*400\s*!important/)

    const paged = read('components/mobile/ReaderPagedEpub.vue')
    expect(paged).toMatch(/\.paged-text\s*\{[\s\S]*?font-weight:\s*var\(--mr-font-weight,\s*400\)\s*!important/)
    expect(paged).toMatch(/\.paged-text\s*:where\([^)]*\bp\b[^)]*\)\s*\{[^}]*font-weight:\s*inherit\s*!important/)

    const scroll = read('components/mobile/ReaderMobile.vue')
    expect(scroll).toMatch(/\.reader-mobile-text\s*\{[\s\S]*?font-weight:\s*var\(--mr-font-weight,\s*400\)\s*!important/)
    expect(scroll).toMatch(/font-weight:\s*inherit\s*!important/)
  })

  test('page mode hides the app tab bar and reclaims its space', () => {
    const reader = read('components/mobile/ReaderMobile.vue')
    // Also gated on chrome visibility now: Read mode hides its own furniture
    // until a centre tap brings it back.
    expect(reader).toContain(`v-show="readerMode === 'read' && !usePagedReader && !chromeHidden"`)
    expect(reader).toMatch(/\.reader-mobile-page\.is-paged\s*\{[^}]*--bottom-nav-space:\s*env\(safe-area-inset-bottom\)/)
    // The paged viewport measures from that variable, not the raw nav height.
    expect(read('components/mobile/ReaderPagedEpub.vue')).toContain('var(--bottom-nav-space, 72px) + 66px')
  })

  test('reader mode pills are unobtrusive: glass over artwork, paper over the page', () => {
    const reader = read('components/mobile/ReaderMobile.vue')
    // Read mode: the active pill is the reader surface, never brand purple.
    expect(reader).toMatch(/\.reader-mode-toggle button\.active\s*\{[^}]*background:\s*var\(--mobile-reader-surface\)/)
    // Listen mode over the blurred cover: frosted glass, still not purple.
    expect(reader).toMatch(/listen-blur \.reader-mode-toggle\s*\{[^}]*backdrop-filter/)
    expect(reader).toMatch(/listen-blur \.reader-mode-toggle button\.active\s*\{[^}]*rgba\(255, 255, 255, 0\.24\)/)
    expect(reader).not.toMatch(/listen-blur \.reader-mode-toggle button\.active\s*\{[^}]*var\(--color-brand-primary\)/)

    // The media sheet's scrubber matches the Listen player's, not accent-color.
    expect(reader).not.toMatch(/\.media-progress-row input\s*\{[^}]*accent-color/)
    expect(reader).toMatch(/\.media-progress-row input::-webkit-slider-thumb/)
  })

  test('home search bar shows exactly one clear affordance', () => {
    const home = read('components/mobile/HomeMobile.vue')
    // Blink's native search clear button is suppressed…
    expect(home).toContain('::-webkit-search-cancel-button')
    // …and ours is a bare icon, with no circular chip behind it.
    expect(home).toMatch(/\.mobile-search-clear\s*\{[^}]*background:\s*transparent/)
    expect(home).not.toMatch(/\.mobile-search-clear\s*\{[^}]*border-radius:\s*50%/)
  })

  test('the Currently Reading card blurs the real cover, like the series card', () => {
    const card = read('components/shared/HomeContinueReadingCard.vue')
    // It used to blur a hardcoded gradient, so it could never match.
    expect(card).not.toContain('linear-gradient(100deg, #5b5965 0%, #7e475f 54%, #8a8990 100%);\n  background-size')
    expect(card).toMatch(/\.continue-bg\s*\{[^}]*filter:\s*blur\(25px\)\s*saturate\(150%\)/)
    expect(card).toMatch(/\.continue-bg\s*\{[^}]*transform:\s*scale\(1\.35\)/)
    expect(card).toMatch(/\.continue-overlay\s*\{[^}]*var\(--gradient-image-card-overlay\)/)

    // Same three declarations as the reference implementation.
    const series = read('components/shared/SeriesCollageCard.vue')
    expect(series).toMatch(/filter:\s*blur\(25px\)\s*saturate\(150%\)/)
    expect(series).toMatch(/transform:\s*scale\(1\.35\)/)
    expect(series).toContain('var(--gradient-image-card-overlay)')
  })

  test('mobile modals are reachable bottom sheets', () => {
    const del = read('components/shared/DeleteConfirmModal.vue')
    expect(del).toContain('delete-sheet')
    expect(del).toMatch(/align-items:\s*flex-end/)

    const playlist = read('components/shared/AddToPlaylistModal.vue')
    expect(playlist).toContain('playlist-sheet')
    expect(playlist).toMatch(/align-items:\s*flex-end/)
    // The book is already chosen when the sheet opens; a row tap toggles it in
    // or out and the sheet stays open, so one book can go into many playlists.
    expect(playlist).toContain('togglePlaylist')
    expect(playlist).toContain("@click=\"togglePlaylist(playlist)\"")
    expect(playlist).toContain('removeBookFromPlaylist')
    expect(playlist).not.toContain('save-button')
    // Playlists already holding the book render as selected, not hidden.
    expect(playlist).toContain('alreadyHas')
  })

  test('delete modal keeps the device path inside the sheet', () => {
    const del = read('components/shared/DeleteConfirmModal.vue')
    // The path column must be allowed to shrink and the path must wrap.
    expect(del).toMatch(/\.effect-copy\s*\{[^}]*min-width:\s*0/)
    expect(del).toMatch(/\.delete-effects em\s*\{[^}]*overflow-wrap:\s*anywhere/)
    expect(del).not.toMatch(/\.delete-effects em\s*\{[^}]*white-space:\s*nowrap/)
  })

  test('series card orders books by installment so home and series pages agree', () => {
    const card = read('components/shared/SeriesCollageCard.vue')
    // coverStack (which drives both the fan order AND the blur background) is
    // derived from an installment-sorted list inside the card, so the same
    // series can't show a different first cover on Home vs the Series page.
    expect(card).toContain('orderedBooks')
    expect(card).toMatch(/coverStack = computed\(\(\) =>\s*\n?\s*orderedBooks\.value/)
    expect(card).toContain('seriesInstallment')
  })

  test('playlists render through the shared series card component', () => {
    const playlists = read('components/mobile/PlaylistsMobile.vue')
    // Playlists ARE series cards now — same component, playlist variant — so the
    // box can never drift from the series card. No bespoke playlist-card CSS.
    expect(playlists).toContain('SeriesCollageCard')
    expect(playlists).toContain('variant="playlist"')
    expect(playlists).not.toContain('.playlist-card {')

    const card = read('components/shared/SeriesCollageCard.vue')
    expect(card).toContain("variant: { type: String")
    expect(card).toContain('playlistCardLayout')
    expect(card).toContain('playlistCardBackground')
  })

  test('listen mode hides the headphone icon and exposes speed + narrator', () => {
    const reader = read('components/mobile/ReaderMobile.vue')
    // Headphone (audio dock) is redundant when the player is already on screen.
    expect(reader).toContain('v-if="readerMode !== \'listen\'"')
    // Speed + narrator live in the listen controls; narrator opens a picker.
    expect(reader).toContain('listen-aux')
    expect(reader).toContain('narratorOpen = true')
    expect(reader).toContain('reader-narrator-sheet')
    expect(reader).toContain('chooseNarrator')
  })

  test('reader honours an explicit ?mode= entry point', () => {
    const reader = read('components/mobile/ReaderMobile.vue')
    expect(reader).toContain('route.query?.mode')
    expect(reader).toContain('setReaderMode(queryMode)')
    // The reader page forwards TOC entries for the jump modal.
    const readerPage = read('pages/reader/[id].vue')
    expect(readerPage).toContain(':toc-items="displayTocItems"')
    expect(readerPage).toContain('@jump-to-toc="goToTocItem"')
  })

  test('chapter pill opens a TOC modal that jumps through the book', () => {
    const reader = read('components/mobile/ReaderMobile.vue')
    // The pill opens the modal instead of a no-op event.
    expect(reader).toMatch(/class="chapter-pill-title"[\s\S]*?@click="tocModalOpen = true"/)
    expect(reader).toContain('reader-toc-sheet')
    expect(reader).toContain('chooseTocItem')
    expect(reader).toContain('jump-to-toc')
    expect(reader).toContain('isTocItemActive')
  })

  test('offline narrator picker lists real device voices, not Edge models', () => {
    const reader = read('components/mobile/ReaderMobile.vue')
    // Offline shows device voices from the OS engine, keyed "native:<index>".
    expect(reader).toContain('deviceVoiceOptions')
    expect(reader).toContain('loadDeviceVoices')
    expect(reader).toContain('applyVoiceChoice')
    expect(reader).toContain("voiceId.startsWith(\"native:\")")

    const tts = read('composables/useTTS.js')
    expect(tts).toContain('ttsNativeVoices')
    expect(tts).toContain('ttsNativeVoiceIdx')
    expect(tts).toContain('setNativeVoice')
    expect(tts).toContain('loadDeviceVoices')

    const native = read('composables/tts/nativeSpeech.js')
    // The engine honours an explicit device-voice index over the auto-mapping.
    expect(native).toContain('nativeVoiceIndex')
  })

  test('scroll reader reserves real measured section heights', () => {
    const reader = read('components/mobile/ReaderMobile.vue')
    expect(reader).toContain('scroll-height-measurer')
    expect(reader).toContain('placeholderHeight')
    expect(reader).toMatch(/heights\[index\]\s*=\s*Math\.max/)

    // The height rides in the page-map cache (v2).
    const map = read('composables/useEpubPageMap.js')
    expect(map).toContain('PAGE_MAP_VERSION = 2')
    expect(map).toContain('heights')
  })
})

// Read mode is a full-page book: nothing sits over the text until asked for.
describe('immersive read mode', () => {
  const readFile = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

  test('a centre tap toggles the reader chrome in both reading modes', () => {
    const reader = readFile('components/mobile/ReaderMobile.vue')
    expect(reader).toContain('chromeHidden')
    expect(reader).toContain('toggleChrome')
    // Entering Read mode starts immersive; leaving it must restore the chrome
    // so Listen mode is never left without controls.
    expect(reader).toMatch(/chromeHidden\.value = mode === "read"/)
    // Scroll mode has no page-turn zones, so it gets its own tap handler.
    expect(reader).toContain('onScrollTap')
    // …which must not fight text selection.
    expect(reader).toContain('selection.isCollapsed')

    // Paged mode routes its dead centre zone to the same toggle.
    const paged = readFile('components/mobile/ReaderPagedEpub.vue')
    expect(paged).toContain('emit("toggle-chrome")')
  })

  test('the Listen view opens on the page you were reading, not chapter one', () => {
    const reader = readFile('components/mobile/ReaderMobile.vue')
    // props.currentChapterIdx lags the paged reader's own position, so it must
    // not be the first choice when paged.
    expect(reader).toMatch(/usePagedReader\.value && Number\.isFinite\(pagedPos\.value\?\.section\)/)
  })
})
