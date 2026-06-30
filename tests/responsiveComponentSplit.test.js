import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const exists = (path) => existsSync(resolve(root, path))

describe('responsive mobile component split', () => {
  test('major responsive surfaces have separate mobile and desktop components', () => {
    const surfaces = [
      ['Home', 'components/shared/HomeComp.vue', 'components/mobile/HomeMobile.vue', 'components/desktop/HomeDesktop.vue'],
      ['Settings', 'components/shared/SettingsComp.vue', 'components/mobile/SettingsMobile.vue', 'components/desktop/SettingsDesktop.vue'],
      ['Books', 'components/shared/BooksComp.vue', 'components/mobile/BooksMobile.vue', 'components/desktop/BooksDesktop.vue'],
      ['Series', 'components/shared/SeriesComp.vue', 'components/mobile/SeriesMobile.vue', 'components/desktop/SeriesDesktop.vue'],
      ['Playlists', 'components/shared/PlaylistComp.vue', 'components/mobile/PlaylistsMobile.vue', 'components/desktop/PlaylistsDesktop.vue'],
      ['Favourites', 'components/shared/FavouritesComp.vue', 'components/mobile/FavouritesMobile.vue', 'components/desktop/FavouritesDesktop.vue'],
      ['Profile', 'pages/profile.vue', 'components/mobile/ProfileMobile.vue', 'components/desktop/ProfileDesktop.vue'],
    ]

    expect(exists('components/shared/ResponsiveViewSwitch.vue')).toBe(true)
    expect(exists('components/mobile')).toBe(true)
    expect(exists('components/desktop')).toBe(true)
    expect(exists('components/shared')).toBe(true)

    for (const [name, wrapperPath, mobilePath, desktopPath] of surfaces) {
      expect(exists(mobilePath), `${name} mobile component`).toBe(true)
      expect(exists(desktopPath), `${name} desktop component`).toBe(true)

      const wrapper = read(wrapperPath)
      expect(wrapper, `${name} wrapper uses responsive switch`).toContain('<ResponsiveViewSwitch')
      expect(wrapper, `${name} wrapper mounts mobile view`).toContain(`<${name}Mobile />`)
      expect(wrapper, `${name} wrapper mounts desktop view`).toContain(`<${name}Desktop />`)
    }

    expect(exists('components/home')).toBe(false)
    expect(exists('components/settings')).toBe(false)
    expect(exists('components/books')).toBe(false)
    expect(exists('components/series')).toBe(false)
    expect(exists('components/playlists')).toBe(false)
    expect(exists('components/favourites')).toBe(false)
    expect(exists('components/profile')).toBe(false)

    const rootVueFiles = readdirSync(resolve(root, 'components'))
      .filter((entry) => entry.endsWith('.vue'))
    expect(rootVueFiles).toEqual([])
  })
})
