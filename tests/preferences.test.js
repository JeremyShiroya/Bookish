import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  DEFAULT_BOOKISH_SETTINGS,
  normalizeBookishSettings,
} from '../composables/useBookishSettings.js'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')

describe('appearance preferences', () => {
  test('new preference keys have sane defaults', () => {
    expect(DEFAULT_BOOKISH_SETTINGS.seriesCardBackground).toBe('blank')
    expect(DEFAULT_BOOKISH_SETTINGS.seriesCardLayout).toBe('fan')
    expect(DEFAULT_BOOKISH_SETTINGS.favouritesCardBackground).toBe('blur')
    expect(DEFAULT_BOOKISH_SETTINGS.favouritesCardLayout).toBe('grid')
    expect(DEFAULT_BOOKISH_SETTINGS.playlistCardBackground).toBe('blur')
    expect(DEFAULT_BOOKISH_SETTINGS.playlistCardLayout).toBe('cover')
    expect(DEFAULT_BOOKISH_SETTINGS.readerHighlight).toBe(true)
    expect(DEFAULT_BOOKISH_SETTINGS.listenCoverBlur).toBe(true)
    expect(DEFAULT_BOOKISH_SETTINGS.showStreak).toBe(true)
    expect(DEFAULT_BOOKISH_SETTINGS.formatFilter).toBe('all')
  })

  test('normalize validates preference values and rejects junk', () => {
    const ok = normalizeBookishSettings({
      seriesCardBackground: 'blur',
      seriesCardLayout: 'cover',
      favouritesCardBackground: 'blank',
      favouritesCardLayout: 'list',
      readerHighlight: false,
      showStreak: false,
      formatFilter: 'epub',
    })
    expect(ok.seriesCardBackground).toBe('blur')
    expect(ok.seriesCardLayout).toBe('cover')
    expect(ok.favouritesCardBackground).toBe('blank')
    expect(ok.favouritesCardLayout).toBe('list')
    expect(ok.readerHighlight).toBe(false)
    expect(ok.showStreak).toBe(false)
    expect(ok.formatFilter).toBe('epub')

    const junk = normalizeBookishSettings({
      seriesCardLayout: 'nonsense',
      favouritesCardLayout: 'nope',
      playlistCardLayout: 'spiral',
      playlistCardBackground: 'rainbow',
      formatFilter: 'mobi',
    })
    expect(junk.seriesCardLayout).toBe('fan')
    expect(junk.favouritesCardLayout).toBe('grid')
    expect(junk.playlistCardLayout).toBe('cover')
    expect(junk.playlistCardBackground).toBe('blur')
    expect(junk.formatFilter).toBe('all')
  })

  test('preferences page and route exist and are wired from settings', () => {
    expect(existsSync(resolve(root, 'pages/settings/preferences.vue'))).toBe(true)
    expect(existsSync(resolve(root, 'components/mobile/PreferencesMobile.vue'))).toBe(true)

    const settings = read('components/mobile/SettingsMobile.vue')
    expect(settings).toContain("to: '/settings/preferences'")
    expect(settings).not.toMatch(/Preferences[^}]*comingSoon/)

    const prefs = read('components/mobile/PreferencesMobile.vue')
    for (const key of ['seriesCardBackground', 'seriesCardLayout', 'playlistCardBackground', 'playlistCardLayout', 'readerHighlight', 'listenCoverBlur', 'showStreak', 'formatFilter']) {
      expect(prefs, key).toContain(key)
    }

    // The Favourites card section moved out of Preferences: its layout is now
    // chosen from the grid/list toggle in the Favourites page's controls row.
    expect(prefs).not.toContain('favouritesCardLayout')
    expect(prefs).not.toContain('favouritesCardBackground')

    // Every Reading option is illustrated, like the card sections above it.
    expect(prefs).toContain('ReadingPreview')
    expect(existsSync(resolve(root, 'components/shared/previews/ReadingPreview.vue'))).toBe(true)
  })

  test('components consume the appearance preferences', () => {
    const seriesCard = read('components/shared/SeriesCollageCard.vue')
    expect(seriesCard).toContain('seriesCardLayout')
    expect(seriesCard).toContain('seriesCardBackground')
    expect(seriesCard).toContain("layout === 'cover'")

    const fav = read('components/mobile/FavouritesMobile.vue')
    expect(fav).toContain('favouritesCardLayout')
    expect(fav).toContain(':card-background="favouritesBackground"')
    // Controls row (mirrors the Books page) owns the grid/list choice.
    expect(fav).toContain('controls-row')
    expect(fav).toContain('setLayout')

    const playlists = read('components/mobile/PlaylistsMobile.vue')
    expect(playlists).toContain('playlistCardLayout')
    expect(playlists).toContain('playlistCardBackground')

    const card = read('components/shared/LibraryBookCard.vue')
    expect(card).toContain('cardBackground')
    expect(card).toContain('no-backdrop')

    const topNav = read('components/mobile/MobileTopNav.vue')
    expect(topNav).toContain('v-if="showStreak"')

    const books = read('components/mobile/BooksMobile.vue')
    expect(books).toContain('settings.value.formatFilter')

    const reader = read('pages/reader/[id].vue')
    expect(reader).toContain('highlightEnabled')
    expect(reader).toContain('settings.value.readerHighlight')
  })
})
