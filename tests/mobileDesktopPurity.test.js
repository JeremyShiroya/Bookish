import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const lineCount = (path) => read(path).split(/\r?\n/).length
const vueFiles = (dir) => readdirSync(resolve(root, dir))
  .filter((entry) => entry.endsWith('.vue'))
  .map((entry) => `${dir}/${entry}`)

describe('mobile and desktop component split purity', () => {
  test('mobile components do not carry desktop branches or desktop selectors', () => {
    for (const file of vueFiles('components/mobile')) {
      const source = read(file)
      expect(source, file).not.toMatch(/desktop-|desktop[A-Z]|Desktop|@media \(min-width:\s*769px\)/)
      expect(source, file).not.toMatch(/@media \(max-width:\s*(?:768|760|1024|1100|1180)px\)/)
    }
  })

  test('desktop components do not carry mobile branches or mobile selectors', () => {
    for (const file of vueFiles('components/desktop')) {
      const source = read(file)
      expect(source, file).not.toMatch(/mobile-|mobile[A-Z]|Mobile|--mobile-|@media \(max-width:\s*(?:768|760|480|430|375|360)px\)/)
    }
  })

  test('mobile home and settings stay focused on their rendered mobile UI', () => {
    const home = read('components/mobile/HomeMobile.vue')
    const settings = read('components/mobile/SettingsMobile.vue')

    expect(lineCount('components/mobile/HomeMobile.vue')).toBeLessThanOrEqual(420)
    expect(lineCount('components/mobile/SettingsMobile.vue')).toBeLessThanOrEqual(280)

    expect(home).not.toMatch(/recent-card|popular-card|authors-list-card|main-content-row|popular-grid|recent-grid|author-list-|popular-/)
    expect(settings).not.toMatch(/settings-hero|settings-grid|settings-panel|stat-item|metadata-snapshot|format-strip|hero-cover|storage-grid|about-section|segmented-control|chip-group|range-control|switch-control|data-action|theme-mode-toggle/)
  })
})
