import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')

describe('settings pages wiring', () => {
  test('settings links route to audio, storage, about, and privacy pages', () => {
    const settings = read('components/mobile/SettingsMobile.vue')

    expect(existsSync(resolve(root, 'pages/settings/index.vue'))).toBe(true)
    expect(existsSync(resolve(root, 'pages/settings.vue'))).toBe(false)
    expect(existsSync(resolve(root, 'pages/settings/audio.vue'))).toBe(true)
    expect(existsSync(resolve(root, 'pages/settings/storage.vue'))).toBe(true)
    expect(existsSync(resolve(root, 'pages/settings/about.vue'))).toBe(true)
    expect(existsSync(resolve(root, 'pages/settings/privacy.vue'))).toBe(true)

    expect(settings).toContain("to: '/settings/audio'")
    expect(settings).toContain("to: '/settings/storage'")
    expect(settings).toContain("to: '/settings/about'")
    expect(settings).toContain("to: '/settings/privacy'")
    expect(settings).toContain('router.push(row.to)')
  })

  test('audio settings page excludes track splitting controls', () => {
    const audioPage = read('pages/settings/audio.vue')
    const audioPanel = read('components/shared/SettingsAudioPanel.vue')

    expect(audioPage).toContain('<SettingsAudioPanel')
    expect(audioPanel).toContain('Narrator voice')
    expect(audioPanel).toContain('Playback speed')
    expect(audioPanel).toContain('Volume')
    expect(audioPanel).not.toMatch(/Track splitting|trackSplitting|setTrackSplitting/)
  })

  test('theme row uses a light and dark toggle without a trailing arrow', () => {
    const settings = read('components/mobile/SettingsMobile.vue')

    expect(settings).toContain('theme-toggle')
    expect(settings).toContain("aria-label=\"Toggle dark mode\"")
    expect(settings).toContain("setReaderTheme(settings.value.readerTheme === 'dark' ? 'light' : 'dark')")
    expect(settings).not.toMatch(/label: 'Theme'[\s\S]*?ri-arrow-right-s-line/)
  })

  test('mobile page titles are hidden for series, playlists, and favourites', () => {
    expect(read('components/mobile/SeriesMobile.vue')).toMatch(/@media \(max-width: 768px\)[\s\S]*\.series-header\s*\{[\s\S]*display:\s*none/)
    expect(read('components/mobile/PlaylistsMobile.vue')).toMatch(/@media \(max-width: 768px\)[\s\S]*\.playlists-header\s*\{[\s\S]*display:\s*none/)
    expect(read('components/mobile/FavouritesMobile.vue')).toMatch(/@media \(max-width: 768px\)[\s\S]*\.favourites-header\s*\{[\s\S]*display:\s*none/)
  })
})
