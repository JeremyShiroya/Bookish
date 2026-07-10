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
    for (const path of [
      'components/mobile/BooksMobile.vue',
      'components/mobile/FavouritesMobile.vue',
      'components/shared/LibraryControlsRow.vue',
    ]) {
      const source = read(path)
      expect(source, path).toContain('FORMAT_FILTER_CHOICES')
      expect(source, path).toContain('Format')
      expect(source, path).toContain('setFormat')
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
