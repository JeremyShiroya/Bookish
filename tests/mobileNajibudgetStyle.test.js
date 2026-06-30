import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')

describe('mobile Najibudget style transfer', () => {
  test('global mobile tokens mirror the Najibudget sizing system', () => {
    const css = read('assets/css/main.css')

    expect(css).toMatch(/--mobile-font-family:\s*"General Sans"/)
    expect(css).toContain('--mobile-page-padding-inline: 10px')
    expect(css).toContain('--mobile-title-size: 20px')
    expect(css).toContain('--mobile-section-title-size: 18px')
    expect(css).toContain('--mobile-body-size: 16px')
    expect(css).toContain('--mobile-subtext-size: 14px')
    expect(css).toContain('--mobile-caption-size: 12px')
    expect(css).toContain('--mobile-icon-size: 24px')
    expect(css).toContain('--mobile-list-icon-size: 44px')
    expect(css).toContain('--mobile-bottom-nav-height: 70px')
    expect(css).toContain('--mobile-card-radius: 20px')
  })

  test('mobile shell components consume the shared mobile tokens', () => {
    const topNav = read('components/mobile/MobileTopNav.vue')
    const bottomNav = read('components/mobile/MobileBottomNav.vue')
    const home = read('components/mobile/HomeMobile.vue')
    const settings = read('components/mobile/SettingsMobile.vue')
    const profile = read('components/mobile/ProfileMobile.vue')

    expect(topNav).toContain('var(--mobile-top-avatar-size)')
    expect(topNav).toContain('var(--mobile-icon-size)')
    expect(bottomNav).toContain('height: var(--mobile-bottom-nav-height)')
    expect(bottomNav).toContain('@media (width <= 768px)')
    expect(bottomNav).toContain('font-size: var(--mobile-caption-size)')
    expect(home).toContain('font-size: var(--mobile-section-title-size)')
    expect(home).toContain('padding: 0 var(--mobile-page-padding-inline)')
    expect(settings).toContain('class="profile"')
    expect(settings).toContain('class="profile-container"')
    expect(settings).toContain('padding: 14px 0')
    expect(settings).toContain('grid-template-columns: minmax(0, 1fr) auto')
    expect(settings).toContain('grid-template-columns: 20px minmax(0, 1fr)')
    expect(settings).toContain('padding-left: 16px')
    expect(settings).toContain('padding-right: 16px')
    expect(settings).toContain('font-size: 18px')
    expect(settings).toContain('font-size: 20px')
    expect(settings).not.toContain('<button')
    expect(profile).toContain('var(--mobile-card-radius)')
    expect(profile).toContain('var(--mobile-section-title-size)')
  })
})
