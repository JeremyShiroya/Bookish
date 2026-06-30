import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')

describe('mobile home and profile refinements', () => {
  test('mobile home shows two series cards', () => {
    const home = read('components/mobile/HomeMobile.vue')

    expect(home).toContain('const mobileSeries = computed(() => seriesList.value.slice(0, 2));')
    expect(home).not.toContain('const mobileSeries = computed(() => seriesList.value.slice(0, 3));')
  })

  test('mobile home currently reading uses the active reader book, not recently added fallback', () => {
    const home = read('components/mobile/HomeMobile.vue')

    expect(home).toContain('const currentReadingBook = computed(() => ttsBook.value || recentlyReadBooks.value[0] || null)')
    expect(home).toContain(':book="currentReadingBook"')
    expect(home).not.toContain('const continueReadingBooks = computed')
    expect(home).not.toContain(':book="continueReadingBooks[0]"')
  })

  test('profile page has the redesigned layout structure', () => {
    const profile = read('components/mobile/ProfileMobile.vue')

    expect(profile).toContain('profile-hero')
    expect(profile).toContain('profile-avatar-ring')
    expect(profile).toContain('profile-actions')
    expect(profile).toContain('profile-preview-card')
    expect(profile).toContain('avatar-option-name')
    expect(profile).toContain('appearance-panel')
  })
})
