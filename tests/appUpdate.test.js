import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  isSafeApkUrl,
  normalizeUpdateManifest,
  shouldPromptForUpdate,
  toVersionCode,
} from '../composables/appUpdateManifest.js'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')

// These files explain in comments WHY they avoid v-html and window.open, so a
// bare substring match would hit the prose rather than the code. Strip comments
// first and assert against what actually runs. Line comments are only stripped
// when they start a line, so mid-line urls survive.
const readCode = (path) => read(path)
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

const manifest = (overrides = {}) => normalizeUpdateManifest({
  versionCode: 200,
  versionName: '1.3.0',
  apkUrl: 'https://github.com/JeremyShiroya/Bookish/releases/download/v1.3.0/bookish.apk',
  ...overrides,
})

describe('update manifest validation', () => {
  test('accepts a well-formed manifest', () => {
    expect(manifest()).toEqual({
      versionCode: 200,
      versionName: '1.3.0',
      apkUrl: 'https://github.com/JeremyShiroya/Bookish/releases/download/v1.3.0/bookish.apk',
      notes: '',
      mandatory: false,
    })
  })

  test('versionCode must be a whole positive number in Android range', () => {
    expect(toVersionCode(191)).toBe(191)
    expect(toVersionCode('191')).toBe(191)
    expect(toVersionCode(' 191 ')).toBe(191)

    expect(toVersionCode('191abc')).toBeNull()
    expect(toVersionCode(1.5)).toBeNull()
    expect(toVersionCode(0)).toBeNull()
    expect(toVersionCode(-1)).toBeNull()
    expect(toVersionCode('')).toBeNull()
    expect(toVersionCode(null)).toBeNull()
    expect(toVersionCode(Infinity)).toBeNull()
    // Android's ceiling.
    expect(toVersionCode(2_100_000_001)).toBeNull()
  })

  // The manifest is remote content naming a url the app hands to the OS. A
  // non-https scheme would turn the update prompt into an attack surface.
  test('rejects any APK url that is not https', () => {
    expect(isSafeApkUrl('https://example.com/a.apk')).toBe(true)

    expect(isSafeApkUrl('http://example.com/a.apk')).toBe(false)
    expect(isSafeApkUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeApkUrl('intent://scan/#Intent;scheme=x;end')).toBe(false)
    expect(isSafeApkUrl('file:///sdcard/evil.apk')).toBe(false)
    expect(isSafeApkUrl('')).toBe(false)
    expect(isSafeApkUrl(null)).toBe(false)

    expect(normalizeUpdateManifest({ versionCode: 200, apkUrl: 'http://x/a.apk' })).toBeNull()
  })

  test('rejects malformed manifests outright', () => {
    expect(normalizeUpdateManifest(null)).toBeNull()
    expect(normalizeUpdateManifest([])).toBeNull()
    expect(normalizeUpdateManifest('nope')).toBeNull()
    expect(normalizeUpdateManifest({})).toBeNull()
    expect(normalizeUpdateManifest({ versionCode: 200 })).toBeNull()
  })

  // A malformed `mandatory` must not trap the user in an undismissable dialog.
  test('only an explicit true makes an update mandatory', () => {
    expect(manifest({ mandatory: true }).mandatory).toBe(true)
    expect(manifest({ mandatory: 'yes' }).mandatory).toBe(false)
    expect(manifest({ mandatory: 1 }).mandatory).toBe(false)
    expect(manifest().mandatory).toBe(false)
  })

  test('notes are clamped so a huge payload cannot blow up the dialog', () => {
    expect(manifest({ notes: 'x'.repeat(5000) }).notes).toHaveLength(2000)
    expect(manifest({ notes: 42 }).notes).toBe('')
  })
})

describe('update prompt decision', () => {
  test('prompts only when the manifest is genuinely newer', () => {
    expect(shouldPromptForUpdate({ installedCode: 191, manifest: manifest() })).toBe(true)
    expect(shouldPromptForUpdate({ installedCode: 200, manifest: manifest() })).toBe(false)
    expect(shouldPromptForUpdate({ installedCode: 201, manifest: manifest() })).toBe(false)
  })

  // App.getInfo() returns build as a string on Android.
  test('handles the string versionCode the native shell reports', () => {
    expect(shouldPromptForUpdate({ installedCode: '191', manifest: manifest() })).toBe(true)
    expect(shouldPromptForUpdate({ installedCode: '200', manifest: manifest() })).toBe(false)
  })

  test('stays silent when the installed version is unknown', () => {
    expect(shouldPromptForUpdate({ installedCode: null, manifest: manifest() })).toBe(false)
    expect(shouldPromptForUpdate({ installedCode: 'unknown', manifest: manifest() })).toBe(false)
  })

  test('never prompts on a rejected manifest', () => {
    expect(shouldPromptForUpdate({ installedCode: 191, manifest: null })).toBe(false)
  })

  test('a skipped version stays skipped until something newer ships', () => {
    const m = manifest()
    expect(shouldPromptForUpdate({ installedCode: 191, manifest: m, skippedCode: 200 })).toBe(false)
    // A newer build than the skipped one prompts again.
    expect(shouldPromptForUpdate({ installedCode: 191, manifest: m, skippedCode: 199 })).toBe(true)
    expect(shouldPromptForUpdate({ installedCode: 191, manifest: m, skippedCode: null })).toBe(true)
  })

  test('a mandatory update ignores an earlier skip', () => {
    const m = manifest({ mandatory: true })
    expect(shouldPromptForUpdate({ installedCode: 191, manifest: m, skippedCode: 200 })).toBe(true)
    // ...but still never offers a downgrade.
    expect(shouldPromptForUpdate({ installedCode: 200, manifest: m, skippedCode: null })).toBe(false)
  })
})

describe('update checker wiring', () => {
  test('the check is native-only and silent without a configured manifest url', () => {
    const composable = read('composables/useAppUpdate.js')
    expect(composable).toContain('isNativeCapacitorPlatform')
    expect(composable).toContain('updateManifestUrl')
    expect(read('nuxt.config.ts')).toContain('BOOKISH_UPDATE_MANIFEST_URL')

    const plugin = read('plugins/app-update.client.js')
    expect(plugin).toContain('isNativeCapacitorPlatform')
    expect(plugin).toContain('runWithContext')
  })

  // Remote-controlled text must never reach v-html.
  test('release notes render as text, not markup', () => {
    const modal = readCode('components/shared/AppUpdateModal.vue')
    expect(modal).not.toContain('v-html')
    expect(modal).toContain('{{ available.notes }}')
  })

  // window.open is a no-op in the Capacitor WebView (no onCreateWindow), so the
  // download must be a real navigation for Android to raise an ACTION_VIEW.
  test('the download is a real link so the WebView hands off to the OS', () => {
    const modal = readCode('components/shared/AppUpdateModal.vue')
    expect(modal).toContain(':href="available.apkUrl"')
    expect(modal).not.toContain('window.open')
  })

  test('a mandatory update hides the skip control', () => {
    const modal = read('components/shared/AppUpdateModal.vue')
    expect(modal).toContain('v-if="!available.mandatory"')
  })

  test('the modal is mounted app-wide', () => {
    expect(read('app.vue')).toContain('<AppUpdateModal />')
  })

  test('the manifest generator shares the app\'s validation rules', () => {
    const script = read('scripts/generate-version-manifest.mjs')
    expect(script).toContain("from '../composables/appUpdateManifest.js'")
    expect(script).toContain('normalizeUpdateManifest')
    // Same version sources as the APK and the About screen.
    expect(script).toContain("'rev-list', '--count', 'HEAD'")
    expect(script).toContain('BOOKISH_BUILD_NUMBER')
  })
})
