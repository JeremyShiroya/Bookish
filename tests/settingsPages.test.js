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
    expect(settings).toContain('navigate(row.to)')
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

  test('mobile page titles are hidden for series, playlists, and favourites', () => {
    expect(read('components/mobile/SeriesMobile.vue')).toMatch(/\.series-header\s*\{[\s\S]*display:\s*none/)
    expect(read('components/mobile/PlaylistsMobile.vue')).toMatch(/\.playlists-header\s*\{[\s\S]*display:\s*none/)
    expect(read('components/mobile/FavouritesMobile.vue')).toMatch(/\.favourites-header\s*\{[\s\S]*display:\s*none/)
  })
})
