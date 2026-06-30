import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')

describe('mobile metadata modal and settings pages', () => {
  test('add and edit metadata modals expose mobile-safe progress actions', () => {
    for (const file of ['components/shared/AddBookComp.vue', 'components/shared/EditBookComp.vue']) {
      const source = read(file)
      expect(source, file).toContain('metadata-modal-body')
      expect(source, file).toContain('metadata-progress-actions')
      expect(source, file).toMatch(/position:\s*sticky[\s\S]*metadata-progress-actions|metadata-progress-actions[\s\S]*position:\s*sticky/)
      expect(source, file).toMatch(/max-height:\s*calc\(100dvh - 24px\)/)
    }
  })

  test('settings detail pages import the mobile-only Najibudget-style settings nav', () => {
    const nav = read('components/mobile/MobileSettingsNav.vue')

    expect(existsSync(resolve(root, 'components/mobile/MobileSettingsNav.vue'))).toBe(true)
    expect(nav).toContain('class="nav"')
    expect(nav).toContain('class="left"')
    expect(nav).toContain('class="center"')
    expect(nav).toContain('class="right"')
    expect(nav).toContain('@media (width <= 768px)')
    expect(nav).toMatch(/\.nav\s*\{[\s\S]*display:\s*none/)

    for (const file of [
      'pages/settings/audio.vue',
      'pages/settings/storage.vue',
      'pages/settings/about.vue',
      'pages/settings/privacy.vue',
    ]) {
      const source = read(file)
      expect(source, file).toContain('<MobileSettingsNav')
      expect(source, file).toContain("from '~/components/mobile/MobileSettingsNav.vue'")
    }
  })
})
