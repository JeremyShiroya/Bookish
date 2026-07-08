import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const exists = (path) => existsSync(resolve(root, path))

describe('mobile native app configuration', () => {
  test('Nuxt is configured as an installable PWA with app shell caching', () => {
    const pkg = JSON.parse(read('package.json'))
    const nuxtConfig = read('nuxt.config.ts')

    expect(pkg.dependencies['@vite-pwa/nuxt']).toBeTruthy()
    expect(nuxtConfig).toContain("'@vite-pwa/nuxt'")
    expect(nuxtConfig).toContain('registerType: \'autoUpdate\'')
    expect(nuxtConfig).toContain('manifest:')
    expect(nuxtConfig).toContain('name: \'Bookish\'')
    expect(nuxtConfig).toContain('short_name: \'Bookish\'')
    expect(nuxtConfig).toContain('display: \'standalone\'')
    expect(nuxtConfig).toContain('navigateFallback: \'/\'')
    expect(nuxtConfig).toContain('runtimeCaching')
    expect(nuxtConfig).not.toContain('ico,woff2')
    expect(nuxtConfig).toContain('NetworkFirst')
    expect(nuxtConfig).toContain('CacheFirst')
  })

  test('Capacitor is configured for generated Nuxt mobile shells', () => {
    const pkg = JSON.parse(read('package.json'))

    expect(pkg.dependencies['@capacitor/core']).toBeTruthy()
    expect(pkg.dependencies['@capacitor/android']).toBeTruthy()
    expect(pkg.dependencies['@capacitor/ios']).toBeTruthy()
    expect(pkg.dependencies['@capacitor/filesystem']).toBeTruthy()
    expect(pkg.dependencies['@capacitor/preferences']).toBeTruthy()
    expect(pkg.devDependencies['@capacitor/cli']).toBeTruthy()
    expect(pkg.scripts['cap:sync']).toBe('npm run generate && npx cap sync')
    expect(pkg.scripts['cap:open:android']).toBe('npx cap open android')
    expect(pkg.scripts['cap:open:ios']).toBe('npx cap open ios')

    expect(exists('capacitor.config.ts')).toBe(true)
    const capacitorConfig = read('capacitor.config.ts')
    expect(capacitorConfig).toContain("appId: 'com.bookish.app'")
    expect(capacitorConfig).toContain("appName: 'Bookish'")
    expect(capacitorConfig).toContain("webDir: '.output/public'")
    expect(capacitorConfig).toContain('bundledWebRuntime: false')
    expect(capacitorConfig).toContain('server: {')
    expect(capacitorConfig).toContain("androidScheme: 'https'")
  })

  test('native WebView advertises Edge so on-device Read Aloud synthesis works', () => {
    const capacitorConfig = read('capacitor.config.ts')
    const ttsComposable = read('composables/useTTS.js')
    const mobileDriver = read('composables/tts/mobileTtsDriver.js')

    expect(capacitorConfig).toContain("appendUserAgent: 'EdgA/143.0.0.0'")
    // Edge on-device synthesis now lives in the isolated mobile driver…
    expect(mobileDriver).toContain('synthesizeEdgeSpeechInBrowser')
    // …and the shared engine routes native playback through it.
    expect(ttsComposable).toContain('synthesizeMobileSpeech')
    expect(ttsComposable).toContain('isNativeCapacitorPlatform')
  })

  test('TTS is split into independent desktop and mobile drivers', () => {
    const desktopDriver = read('composables/tts/desktopTtsDriver.js')
    const mobileDriver = read('composables/tts/mobileTtsDriver.js')
    const nativeSpeech = read('composables/tts/nativeSpeech.js')
    const ttsComposable = read('composables/useTTS.js')

    // Desktop synth talks to the server endpoint.
    expect(desktopDriver).toContain('/api/tts')
    expect(desktopDriver).toContain('synthesizeDesktopSpeech')

    // Mobile falls back to the phone's built-in voice when Edge fails, via the
    // native TTS plugin (the Android WebView has no window.speechSynthesis).
    expect(mobileDriver).toContain('nativeSpeechSupported')
    expect(mobileDriver).toContain('native: true')
    expect(nativeSpeech).toContain('@capacitor-community/text-to-speech')
    expect(nativeSpeech).toContain('createNativeSpeechAudio')

    // The shared engine selects the driver by platform.
    expect(ttsComposable).toContain('synthesizeDesktopSpeech')
    expect(ttsComposable).toContain('synthesizeMobileSpeech')
  })

  test('native builds can reach a real Nuxt backend for server-backed features', () => {
    const nuxtConfig = read('nuxt.config.ts')
    const manifest = read('android/app/src/main/AndroidManifest.xml')

    expect(nuxtConfig).toContain('apiBaseUrl')
    expect(nuxtConfig).toContain('NUXT_PUBLIC_API_BASE_URL')
    expect(nuxtConfig).toContain("'/api/**'")
    expect(nuxtConfig).toContain('cors: true')
    expect(manifest).toContain('android:usesCleartextTraffic="true"')
  })

  test('native builds run the metadata provider pipeline on-device', () => {
    const capacitorConfig = read('capacitor.config.ts')
    const metadataSearch = read('composables/useBookMetadataSearch.js')
    const deviceSearch = read('composables/useDeviceMetadataSearch.js')

    // CapacitorHttp bypasses WebView CORS so device-side scraping works.
    expect(capacitorConfig).toContain('CapacitorHttp')
    expect(capacitorConfig).toMatch(/CapacitorHttp:\s*\{\s*enabled:\s*true/)

    expect(metadataSearch).toContain('isNativeCapacitorPlatform')
    expect(metadataSearch).toContain('fetchBookMetadataOnDevice')
    expect(metadataSearch).toContain('fetchSeriesTotalOnDevice')

    expect(deviceSearch).toContain("from '~/server/utils/goodreadsScraper'")
    expect(deviceSearch).toContain("from '~/server/utils/koboScraper'")
    expect(deviceSearch).toContain("from '~/server/utils/googleBooksApi'")
    expect(deviceSearch).toContain('buildMetadataResults')

    // Publisher-site stage runs on the device too (steps 2-4 of the loader).
    expect(deviceSearch).toContain("from '~/server/utils/publisherMetadata'")
    expect(deviceSearch).toContain('searchPublisherMetadata')
    expect(deviceSearch).toContain('searchKnownPublisherSites')
    expect(deviceSearch).toContain('uniquePublishers')
  })

  test('cover and author image search run on-device in native builds', () => {
    const coverSearch = read('composables/useCoverSearch.js')
    const authorSearch = read('composables/useAuthorImageSearch.js')
    const coverUtil = read('server/utils/coverSearch.ts')
    const authorUtil = read('server/utils/authorImagesWeb.ts')

    expect(coverSearch).toContain('isNativeCapacitorPlatform')
    expect(coverSearch).toContain("import('~/server/utils/coverSearch')")
    expect(authorSearch).toContain("import('~/server/utils/authorImagesWeb')")
    expect(coverUtil).toContain('export async function searchBookCovers')
    expect(authorUtil).toContain('export async function searchAuthorImagesWeb')

    // The four book forms all go through the shared composable.
    for (const path of [
      'components/shared/AddBookComp.vue',
      'components/shared/EditBookComp.vue',
      'components/mobile/AddBookMobile.vue',
      'components/mobile/EditBookMobile.vue',
    ]) {
      const component = read(path)
      expect(component).toContain('fetchCoverImageResults')
      expect(component).not.toContain('/api/books/search-covers')
    }
  })

  test('narration drives a native media session (notification + lock screen)', () => {
    const javaPlugin = read('android/app/src/main/java/com/bookish/app/MediaSessionPlugin.java')
    const mainActivity = read('android/app/src/main/java/com/bookish/app/MainActivity.java')
    const manifest = read('android/app/src/main/AndroidManifest.xml')
    const gradle = read('android/app/build.gradle')
    const bridge = read('plugins/media-session.client.js')

    // Native side: MediaSession + MediaStyle notification with transport controls.
    expect(javaPlugin).toContain('name = "BookishMediaSession"')
    expect(javaPlugin).toContain('MediaSessionCompat')
    expect(javaPlugin).toContain('MediaStyle')
    expect(javaPlugin).toContain('PlaybackStateCompat.ACTION_SEEK_TO')
    expect(javaPlugin).toContain('notifyListeners("mediaAction"')
    expect(mainActivity).toContain('registerPlugin(MediaSessionPlugin.class)')
    expect(manifest).toContain('android.permission.POST_NOTIFICATIONS')
    expect(gradle).toContain('androidx.media:media')

    // Web side: TTS state is mirrored into the session, controls come back.
    expect(bridge).toContain("registerPlugin('BookishMediaSession')")
    expect(bridge).toContain("addListener('mediaAction'")
    expect(bridge).toContain('requestNotificationPermission')
    expect(bridge).toContain('isNativeCapacitorPlatform')
  })

  test('native builds do not inject web-only analytics scripts', () => {
    const analyticsPlugin = read('plugins/vercel-analytics.client.js')

    expect(analyticsPlugin).toContain('isNativeCapacitor')
    expect(analyticsPlugin).toContain('window.Capacitor')
    expect(analyticsPlugin).toContain('if (isNativeCapacitor()) return')
  })
})
