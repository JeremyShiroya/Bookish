import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')

describe('mobile metadata modal and settings pages', () => {
  test('add and edit metadata modals expose mobile-safe progress actions', () => {
    for (const file of [
      'components/mobile/AddBookMobile.vue',
      'components/mobile/EditBookMobile.vue',
    ]) {
      const source = read(file)
      expect(source, file).toContain('metadata-modal-body')
      expect(source, file).toContain('metadata-progress-actions')
      expect(source, file).toMatch(/position:\s*sticky[\s\S]*metadata-progress-actions|metadata-progress-actions[\s\S]*position:\s*sticky/)
      expect(source, file).toMatch(/max-height:\s*calc\(100dvh - 24px\)/)
    }
  })

  test('mobile book form pages own their bodies instead of importing shared form shells', () => {
    const addMobile = read('components/mobile/AddBookMobile.vue')
    const editMobile = read('components/mobile/EditBookMobile.vue')

    expect(addMobile).not.toContain('AddBookComp')
    expect(editMobile).not.toContain('EditBookComp')

    for (const file of ['components/mobile/AddBookMobile.vue', 'components/mobile/EditBookMobile.vue']) {
      const source = read(file)
      expect(source, file).toContain('MobileSettingsNav')
      expect(source, file).toContain("import BookishSelect from '~/components/shared/BookishSelect.vue'")
      expect(source, file).toContain('Reading Status')
    }

    expect(editMobile).toContain("import SkeletonLoader from '~/components/shared/SkeletonLoader.vue'")
  })

  test('settings and requested detail pages import the mobile settings nav', () => {
    const settingsNav = read('components/mobile/MobileSettingsNav.vue')

    expect(existsSync(resolve(root, 'components/mobile/MobileSettingsNav.vue'))).toBe(true)
    expect(settingsNav).toContain(':aria-label="ariaLabel"')
    expect(settingsNav).toContain('formatLongTitle')
    expect(settingsNav).toContain('text-overflow: ellipsis')
    expect(settingsNav).toContain('router.push(props.backTo)')

    for (const file of [
      'components/mobile/SettingsMobile.vue',
      'pages/settings/storage.vue',
      'pages/settings/about.vue',
      'pages/settings/privacy.vue',
      'components/mobile/AddBookMobile.vue',
      'components/mobile/EditBookMobile.vue',
      'components/mobile/ProfileMobile.vue',
      'components/mobile/BookDetailMobile.vue',
      'components/mobile/SeriesDetailMobile.vue',
      'components/mobile/PlaylistDetailMobile.vue',
    ]) {
      const source = read(file)
      expect(source, file).toContain('MobileSettingsNav')
    }

  })

  test('main mobile library pages own their top and bottom navigation', () => {
    const layout = read('layouts/default.vue')
    expect(layout).not.toContain('MobileBottomNav')
    expect(layout).not.toContain('MobileTopNav')

    for (const file of [
      'components/mobile/HomeMobile.vue',
      'components/mobile/BooksMobile.vue',
      'components/mobile/SeriesMobile.vue',
      'components/mobile/PlaylistsMobile.vue',
      'components/mobile/FavouritesMobile.vue',
    ]) {
      const source = read(file)
      expect(source, file).toContain('<MobileTopNav')
      expect(source, file).toContain('<MobileBottomNav')
    }
  })
})
