import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8')

// Pages is sideloaded, so there is no store page to send anyone — passing it on
// means handing over the APK itself.
describe('sharing the app', () => {
  const plugin = read('android/app/src/main/java/com/bookish/app/ApkInstallerPlugin.java')
  const composable = read('composables/useShareApp.js')
  const settings = read('components/mobile/SettingsMobile.vue')

  test('the APK is copied out before sharing, not shared in place', () => {
    // The installed APK sits under /data/app in a directory no other app can
    // read, so a uri to it would be useless to the recipient.
    expect(plugin).toContain('getCacheDir(), "shared-apk"')
    expect(plugin).toContain('FileProvider.getUriForFile')
    expect(plugin).toContain('FLAG_GRANT_READ_URI_PERMISSION')
  })

  test('the copy is named for the app, not "base.apk"', () => {
    // That filename is what the recipient is asked to trust and install.
    expect(plugin).toMatch(/String label = "Pages"/)
  })

  test('the chooser gets its own uri grant', () => {
    // Bluetooth and some mail clients read the stream from the chooser intent
    // rather than the inner one, and fail with a SecurityException without it.
    expect(plugin).toMatch(/createChooser[\s\S]*?addFlags\(Intent\.FLAG_GRANT_READ_URI_PERMISSION\)/)
  })

  test('a split install is refused rather than half-shared', () => {
    // Sharing only the base of a split install produces a file that fails to
    // install on the far side with no useful explanation.
    expect(plugin).toContain('splitSourceDirs')
    expect(plugin).toContain('SPLIT_APK')
    expect(composable).toContain('cannot be shared directly')
  })

  test('the recipient is told why Android will warn them', () => {
    // Without that line the install warning reads as "this app is unsafe"
    // rather than "Android needs permission once".
    expect(composable).toMatch(/allow your browser or messaging app to install apps/)
    expect(composable).toMatch(/outside the Play Store/)
  })

  test('nothing personal travels with the app', () => {
    // Only the installer file is shared — no library, settings or history.
    expect(composable).toMatch(/no books, no reading\n\/\/ history, no settings travel with it/)
  })

  test('the row only appears where sharing can actually work', () => {
    expect(settings).toContain("canShareApp() ? [{ label: 'Share Pages'")
    expect(composable).toContain("isPluginAvailable?.('ApkInstaller')")
  })

  test('a shareable build must not carry the AI key', () => {
    // The app shares its own APK, so anything public in it is handed to every
    // recipient — one quota between all of them, and a leaked credential.
    const config = read('nuxt.config.ts')
    expect(config).toMatch(/LEAVE THESE EMPTY for any build that will be shared/)
    expect(config).toMatch(/the key server-side as GEMINI_API_KEY/)
  })
})
