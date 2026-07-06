import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { assetsAvailable } from '../composables/useDeviceAssets.js'
import { isRemoteCoverUrl } from '../composables/useCoverImageCache.js'
import { pdfSourceToBytes } from '../composables/usePdfExtractor.js'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')

describe('device storage layer', () => {
  test('asset storage and SQLite are inert on the web/test build', () => {
    // No Capacitor native platform in node → filesystem assets unavailable, so
    // the web build keeps using IndexedDB + the server cover cache.
    expect(assetsAvailable()).toBe(false)
  })

  test('remote cover detection', () => {
    expect(isRemoteCoverUrl('https://covers.example/x.jpg')).toBe(true)
    expect(isRemoteCoverUrl('http://covers.example/x.jpg')).toBe(true)
    expect(isRemoteCoverUrl('data:image/png;base64,AAAA')).toBe(false)
    expect(isRemoteCoverUrl('capacitor://localhost/_capacitor_file_/x.jpg')).toBe(false)
    expect(isRemoteCoverUrl(null)).toBe(false)
  })

  test('pdfSourceToBytes still decodes inline base64', async () => {
    // "PDF" bytes as base64 — the non-URL path must be untouched.
    const bytes = await pdfSourceToBytes('data:application/pdf;base64,JVBERi0=')
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x25, 0x50, 0x44, 0x46]) // %PDF
  })

  test('cover cache prefers the on-device filesystem path when native', () => {
    const cache = read('composables/useCoverImageCache.js')
    expect(cache).toContain('CapacitorHttp')
    expect(cache).toContain('assetsAvailable()')
    expect(cache).toContain("saveBase64('covers'")

    const assets = read('composables/useDeviceAssets.js')
    expect(assets).toContain('convertFileSrc')
    expect(assets).toContain('Directory.Data')
  })

  test('PDF sources are stored as device files and streamed by pdf.js', () => {
    const storage = read('composables/useBookStorage.js')
    expect(storage).toContain('saveArrayBuffer')
    expect(storage).toContain("deviceAssets.exists('pdfs'")
    expect(storage).toContain('DEVICE_FILE_MARKER')

    const viewer = read('components/shared/PdfViewer.vue')
    expect(viewer).toContain('isStreamableUrl')
    expect(viewer).toContain('getDocument({ url: props.src })')
  })

  test('library metadata stays on IndexedDB (SQLite removed after boot crash)', () => {
    // SQLite was pulled: its native plugin registered at app-init and its
    // wrapper left the on-device library empty / unstable. IndexedDB is the
    // proven metadata store on both platforms.
    expect(existsSync(resolve(root, 'composables/useSqliteLibrary.js'))).toBe(false)

    const store = read('composables/useLibraryStore.js')
    expect(store).not.toContain('useSqliteLibrary')
    expect(store).not.toContain('SQLite')

    const pkg = JSON.parse(read('package.json'))
    expect(pkg.dependencies['@capacitor-community/sqlite']).toBeFalsy()
  })

  test('native app disables the PWA service worker to avoid stale-update bundles', () => {
    expect(existsSync(resolve(root, 'plugins/disable-sw-native.client.js'))).toBe(true)
    const plugin = read('plugins/disable-sw-native.client.js')
    expect(plugin).toContain('isNativeCapacitorPlatform')
    expect(plugin).toContain('unregister()')
    expect(plugin).toContain('caches.delete')
  })
})
