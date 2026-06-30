import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')

describe('mobile Najibudget style transfer', () => {
  test('global mobile tokens mirror the Najibudget sizing system', () => {
    const css = read('assets/css/main.css')

    expect(css).toContain('--mobile-font-family: "General Sans"')
    expect(css).toContain('--mobile-page-padding-inline: 16px')
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
    expect(bottomNav).toContain('font-size: var(--mobile-caption-size)')
    expect(home).toContain('font-size: var(--mobile-section-title-size)')
    expect(home).toContain('padding: 0 var(--mobile-page-padding-inline)')
    expect(settings).toContain('font-size: var(--mobile-body-size)')
    expect(settings).toContain('var(--mobile-touch-target)')
    expect(profile).toContain('var(--mobile-card-radius)')
    expect(profile).toContain('var(--mobile-section-title-size)')
  })
})
