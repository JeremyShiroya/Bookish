import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')

describe('settings pages wiring', () => {
  test('settings links route to storage, about, and privacy pages (audio removed)', () => {
    const settings = read('components/mobile/SettingsMobile.vue')

    expect(existsSync(resolve(root, 'pages/settings/index.vue'))).toBe(true)
    expect(existsSync(resolve(root, 'pages/settings.vue'))).toBe(false)
    expect(existsSync(resolve(root, 'pages/settings/audio.vue'))).toBe(false)
    expect(existsSync(resolve(root, 'pages/settings/storage.vue'))).toBe(true)
    expect(existsSync(resolve(root, 'pages/settings/about.vue'))).toBe(true)
    expect(existsSync(resolve(root, 'pages/settings/privacy.vue'))).toBe(true)

    expect(settings).not.toContain("to: '/settings/audio'")
    expect(settings).toContain("to: '/settings/storage'")
    expect(settings).toContain("to: '/settings/about'")
    expect(settings).toContain("to: '/settings/privacy'")
    expect(settings).toContain('navigate(row.to)')
  })

  test('theme row uses a light and dark toggle without a trailing arrow', () => {
    const settings = read('components/mobile/SettingsMobile.vue')

    expect(settings).toContain('theme-toggle')
    expect(settings).toContain("aria-label=\"Toggle dark mode\"")
    expect(settings).toContain("setReaderTheme(settings.value.readerTheme === 'dark' ? 'light' : 'dark')")
    expect(settings).not.toMatch(/label: 'Theme'[\s\S]*?ri-arrow-right-s-line/)
  })

  test('mobile settings mirrors Najibudget list structure with settings nav and no row buttons', () => {
    const settings = read('components/mobile/SettingsMobile.vue')

    expect(settings).toContain('class="profile"')
    expect(settings).toContain('<MobileSettingsNav title="Settings"')
    expect(settings).toContain('class="profile-container"')
    expect(settings).toContain('class="section"')
    expect(settings).toContain('class="setting-item"')
    expect(settings).toContain('class="setting-info"')
    expect(settings).toContain('grid-template-columns: minmax(0, 1fr) auto')
    expect(settings).not.toContain('<button')
    expect(settings).not.toContain('mobile-settings-header')
    expect(settings).not.toContain('mobile-settings-list')
  })

  test('settings version comes from runtime config instead of hardcoded text', () => {
    const settings = read('components/mobile/SettingsMobile.vue')

    expect(settings).toContain('runtimeConfig.public.appVersion')
    expect(settings).toContain('Version {{ appVersion }}')
    expect(settings).not.toContain('Version 1.2.0')
  })

  test('mobile pages no longer carry hidden desktop page headers', () => {
    expect(read('components/mobile/SeriesMobile.vue')).not.toContain('series-header')
    expect(read('components/mobile/PlaylistsMobile.vue')).not.toContain('playlists-header')
    expect(read('components/mobile/FavouritesMobile.vue')).not.toContain('favourites-header')
    expect(read('components/mobile/BooksMobile.vue')).not.toContain('data-table')
    expect(read('components/mobile/BooksMobile.vue')).not.toContain('pagination')
  })

  test('mobile books page filters reading status via a Filter dropdown (All default)', () => {
    const books = read('components/mobile/BooksMobile.vue')

    // Reading status is chosen from a Filter dropdown (styled after the desktop
    // Filter panel), replacing the old inline status chips.
    expect(books).toContain('filter-dropdown')
    expect(books).toContain('filter-panel')
    expect(books).toContain("setStatus('all')")
    expect(books).toContain('readingStatuses')
    // All is the default selection.
    expect(books).toContain('ref("all")')
    // The old sliding-chip status selector is gone.
    expect(books).not.toContain('status-chips')
  })

  test('every library filter panel offers the shared Format pills', () => {
    // The Books page still owns its inline filter; Favourites now delegates to
    // the shared controls row, so it is checked for the delegation instead.
    expect(read('components/mobile/FavouritesMobile.vue')).toContain('LibraryControlsRow')

    for (const path of [
      'components/mobile/BooksMobile.vue',
      'components/shared/LibraryControlsRow.vue',
    ]) {
      const source = read(path)
      expect(source, path).toContain('FORMAT_FILTER_CHOICES')
      expect(source, path).toContain('Format')
      // LibraryControlsRow renders its pills from a section list rather than a
      // hand-written block, so it writes the setting through one `select`.
      expect(source, path).toMatch(/setFormat|formatFilter: value/)
    }

    // Format is a single library-wide setting, so choosing it anywhere applies
    // to the Books, Favourites, series-detail and playlist-detail lists alike.
    for (const path of [
      'components/mobile/BooksMobile.vue',
      'components/mobile/FavouritesMobile.vue',
      'components/mobile/SeriesDetailMobile.vue',
      'components/mobile/PlaylistDetailMobile.vue',
    ]) {
      expect(read(path), path).toContain('matchesFormatFilter')
    }
  })
})

// A user-facing connection test: the point is that someone who does not read
// stack traces can still tell us WHICH service is failing and why.
describe('connection test page', () => {
  const readFile = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

  test('the page exists and is reachable from settings', () => {
    expect(existsSync(resolve(process.cwd(), 'pages/settings/connection.vue'))).toBe(true)
    expect(readFile('components/mobile/SettingsMobile.vue')).toContain("to: '/settings/connection'")
    // Desktop settings shows the same panel rather than hiding the feature.
    expect(readFile('components/desktop/SettingsDesktop.vue')).toContain('ConnectionTestPanel')
  })

  test('every online capability is covered by a check', () => {
    const checks = readFile('composables/useConnectionChecks.js')
    for (const id of ['internet', 'googleKey', 'googleSearch', 'openLibrary', 'archive', 'goodreads', 'metadata', 'series']) {
      expect(checks, id).toContain(`id: '${id}'`)
    }
    // The headline check must run the REAL pipeline, not a simplified probe,
    // or a pass would not mean the feature works.
    expect(checks).toContain('fetchBookMetadataOnDevice')
    expect(checks).toContain('/api/books/metadata')
  })

  test('failures are explained in plain language and stay reportable', () => {
    const checks = readFile('composables/useConnectionChecks.js')
    // Quota and key-restriction errors are the ones a user can act on.
    expect(checks).toMatch(/per day/i)
    expect(checks).toContain('Application restrictions')
    expect(checks).toContain('buildDiagnosticsReport')

    const panel = readFile('components/shared/ConnectionTestPanel.vue')
    // Clipboard access is refused in some webviews, so there must be a
    // fallback or the results cannot be got out at all.
    expect(panel).toContain('showReportText')
    expect(panel).toContain('textarea')
  })
})

// Hidden books get their own screen: restoring them one at a time is the
// common case, and "Restore all" alone made that impossible.
describe('hidden books screen', () => {
  const readFile = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

  test('the page exists and Storage links to it', () => {
    expect(existsSync(resolve(process.cwd(), 'pages/settings/hidden.vue'))).toBe(true)
    const storage = readFile('components/mobile/SettingsStorageMobile.vue')
    expect(storage).toContain("/settings/hidden")
    expect(storage).toContain('View hidden books')
  })

  test('it reads hidden books from storage, not the in-memory library', () => {
    // Hidden books are filtered out of books.value by design, so the screen
    // cannot be built from it.
    const books = readFile('composables/useBooks.js')
    expect(books).toContain('listHiddenBooks')
    expect(books).toContain('restoreHiddenBook')

    const page = readFile('components/mobile/HiddenBooksMobile.vue')
    expect(page).toContain('listHiddenBooks')
    expect(page).toContain('grid')
    expect(page).toContain('list')
  })

  test('a hidden book offers restore and nothing else', () => {
    const card = readFile('components/shared/LibraryBookCard.vue')
    expect(card).toContain('restoreOnly')
    expect(card).toContain("emit('restore', book)")
    const page = readFile('components/mobile/HiddenBooksMobile.vue')
    expect(page).toContain('restore-only')
    // Favourite/playlist/edit/delete would act on something not visible.
    expect(page).not.toContain('@favourite=')
    expect(page).not.toContain('@delete=')
  })

  test('the device summary counts books, not file types', () => {
    const storage = readFile('components/mobile/SettingsStorageMobile.vue')
    expect(storage).toContain('Total books')
    expect(storage).toContain('Hidden books')
    expect(storage).toContain('Space used')
    expect(storage).not.toContain('Readable books')
    expect(storage).not.toContain('PDF files')
  })
})
