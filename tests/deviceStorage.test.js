import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { ASSET_WRITE_CHUNK_CHARS, assetsAvailable } from '../composables/useDeviceAssets.js'
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

// Regression: Capacitor rebuilds every plugin-call argument as a Java String on
// the bridge's MAIN thread. Passing a whole book's base64 to Filesystem.writeFile
// in one call meant a ~54MB String allocation, which exhausted a 256MB heap and
// killed the app inside Capacitor's own Bridge (FATAL EXCEPTION: main).
describe('large assets are written in bridge-sized slices', () => {
  test('writes chunked, and every chunk is base64-aligned', () => {
    const source = read('composables/useDeviceAssets.js')
    expect(source).toContain('Filesystem.appendFile')
    // 4 base64 chars = 3 bytes; an off-boundary split silently corrupts the file.
    expect(ASSET_WRITE_CHUNK_CHARS % 4).toBe(0)
    expect(ASSET_WRITE_CHUNK_CHARS).toBeLessThanOrEqual(8 * 1024 * 1024)
  })

  test('slicing base64 on the chunk size round-trips byte-identically', () => {
    const bytes = Buffer.alloc(9_000_003)
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = i % 251
    const b64 = bytes.toString('base64')

    let out = Buffer.alloc(0)
    for (let o = 0; o < b64.length; o += ASSET_WRITE_CHUNK_CHARS) {
      out = Buffer.concat([out, Buffer.from(b64.slice(o, o + ASSET_WRITE_CHUNK_CHARS), 'base64')])
    }
    expect(out.equals(bytes)).toBe(true)
  })
})
