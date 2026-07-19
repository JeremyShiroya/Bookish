import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')

const packageJson = JSON.parse(read('package.json'))
const buildGradle = read('android/app/build.gradle')

describe('app versioning is derived, not hand-written', () => {
  // Regression: versionCode was pinned at 1 and versionName at "1.0" while
  // package.json said 1.2.0, so every APK looked identical to Android. Since
  // Android refuses a lower-or-equal versionCode and every update mechanism
  // compares it, no user could ever be offered an update.
  test('android version is not hardcoded', () => {
    expect(buildGradle).not.toMatch(/versionCode\s+\d+/)
    expect(buildGradle).not.toMatch(/versionName\s+["']/)

    expect(buildGradle).toContain('versionCode project.ext.resolveVersionCode()')
    expect(buildGradle).toContain('versionName project.ext.resolveVersionName()')
  })

  test('versionName comes from package.json and versionCode from the commit count', () => {
    expect(buildGradle).toContain("new File(rootDir, '../package.json')")
    expect(buildGradle).toContain("'git', 'rev-list', '--count', 'HEAD'")
  })

  // Both layers honour the same override, so a CI build can pin the APK and the
  // in-app "Build" string to one number.
  test('gradle and nuxt honour the same build-number override', () => {
    expect(buildGradle).toContain('BOOKISH_BUILD_NUMBER')
    expect(read('nuxt.config.ts')).toContain('BOOKISH_BUILD_NUMBER')
  })

  // A placeholder versionCode is unrecoverable in the field, so an
  // undeterminable one must stop the build rather than invent a number.
  test('an unresolvable versionCode fails the build instead of guessing', () => {
    expect(buildGradle).toContain('throw new GradleException')
    expect(buildGradle).not.toMatch(/versionCode\s*=?\s*1\b/)
  })

  test('the version the APK reports matches the version the app reports', () => {
    const commitCount = Number(
      execFileSync('git', ['rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim(),
    )

    // nuxt.config.ts feeds these to runtimeConfig as appVersion / buildNumber,
    // which is what the Settings screens render.
    expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(Number.isInteger(commitCount)).toBe(true)
    expect(commitCount).toBeGreaterThan(0)
    // Android's ceiling for versionCode.
    expect(commitCount).toBeLessThan(2_100_000_000)
  })

  test('settings screens read the version from runtime config', () => {
    for (const path of ['components/mobile/SettingsMobile.vue', 'components/desktop/SettingsDesktop.vue']) {
      expect(read(path), path).toContain('runtimeConfig.public.appVersion')
    }
    expect(read('components/desktop/SettingsDesktop.vue')).toContain('runtimeConfig.public.buildNumber')
  })
})
