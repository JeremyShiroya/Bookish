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
    // Status chips live on the left; the view toggle is pinned to the right end.
    const controlsLeft = books.slice(books.indexOf('class="controls-left"'), books.indexOf('class="controls-right"'))
    const controlsRight = books.slice(books.indexOf('class="controls-right"'), books.indexOf('Grid View'))
    expect(controlsLeft).toContain('status-chips')
    expect(controlsLeft).not.toContain('view-chips')
    expect(controlsRight).toContain('view-chips')
  })

  test('mobile books page carries no desktop-only leftovers', () => {
    const books = read('components/mobile/BooksMobile.vue')
    for (const marker of ['data-table', 'pagination', 'isMobileViewport', 'filter-dropdown', 'sfp-pill', 'metric-card', 'books-header']) {
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

  test('mini playing bar shows outside the reader and opens the narrated section', () => {
    const bar = read('components/mobile/MobilePlayingBar.vue')
    expect(bar).toContain("route.path.startsWith('/reader')")
    expect(bar).toContain('router.push(`/reader/${ttsBook.value.id}`)')
    expect(bar).toContain('bar-progress-fill')

    const layout = read('layouts/default.vue')
    expect(layout).toContain('MobilePlayingBar')

    const reader = read('pages/reader/[id].vue')
    expect(reader).toContain('sectionForChunk(ttsChunkIdx.value)')
    expect(reader).toContain('jumpToNarration()')
  })

  test('series and playlist detail pages use the hero redesign', () => {
    for (const path of ['components/mobile/SeriesDetailMobile.vue', 'components/mobile/PlaylistDetailMobile.vue']) {
      const source = read(path)
      expect(source, path).toContain('hero-backdrop')
      expect(source, path).toContain('hero-progress-fill')
      expect(source, path).toContain('hero-play')
      expect(source, path).toContain('@hide="handleHideBook"')
    }
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
    expect(mobile).toContain('backfillLibraryMetadata')
    expect(mobile).toContain('backfill-bar')
    expect(mobile).toContain('View {{ backfill.failures.length }} unsuccessful')
    expect(mobile).toContain('failures-modal')
    expect(mobile).toContain('restoreHiddenBooks')
    expect(mobile).toContain('Server connection')

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
})
