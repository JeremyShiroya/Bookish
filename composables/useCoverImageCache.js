import { CapacitorHttp } from '@capacitor/core'
import { useApiEndpoint } from '~/composables/useApiEndpoint'
import { assetsAvailable, useDeviceAssets } from '~/composables/useDeviceAssets'

export function isRemoteCoverUrl(value) {
  return typeof value === 'string'
    && /^https?:\/\//i.test(value)
    // The Capacitor WebView serves on-device files from https://localhost via
    // the _capacitor_file_ path — those are local, not remote, and must never
    // be treated as a downloadable source (that's how a dead local URL used to
    // loop back through the cache).
    && !/^https?:\/\/localhost\//i.test(value)
    && !value.includes('_capacitor_file_')
}

// A cover that already points at an on-device asset file (the Capacitor local
// server). May be live or stale — callers verify the file still exists.
export function isLocalAssetCover(value) {
  return typeof value === 'string'
    && (value.includes('_capacitor_file_') || /^capacitor:\/\//i.test(value))
}

// Pull the stored filename out of a local asset cover URL (…/covers/<name>).
export function coverAssetName(value) {
  return /\/covers\/([^/?#]+)/.exec(String(value || ''))?.[1] || null
}

// A stable, filesystem-safe filename derived from the cover URL, so the same
// remote cover always maps to the same cached file.
function coverFileName(url) {
  let hash = 5381
  const str = String(url)
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0
  }
  const ext = /\.(png|webp|gif)(?:[?#]|$)/i.exec(str)?.[1]?.toLowerCase() || 'jpg'
  return `${hash.toString(36)}.${ext}`
}

export const useCoverImageCache = () => {
  const { apiUrl } = useApiEndpoint()
  const { saveBase64, getUri, exists } = useDeviceAssets()

  // Native: download the cover through the native HTTP stack (bypasses CORS,
  // works offline once cached) and store it as a file — no server needed, and
  // the bytes never sit in IndexedDB or the JS heap. Returns a convertFileSrc
  // URL the WebView loads straight from disk.
  const cacheOnDevice = async (coverUrl) => {
    const name = coverFileName(coverUrl)

    // Reuse only if the file is genuinely on disk. Filesystem.getUri resolves a
    // path *without* checking existence, so gating on it alone handed back a
    // convertFileSrc URL for a cover that was never downloaded — a phantom 404.
    // Stat first; only skip the download when the bytes are really there.
    if (await exists('covers', name)) {
      const uri = await getUri('covers', name)
      const { assetWebSrc } = await import('~/composables/useDeviceAssets')
      return assetWebSrc(uri)
    }

    try {
      const response = await CapacitorHttp.get({ url: coverUrl, responseType: 'blob' })
      const data = response?.data
      if (!data || response.status >= 400) return coverUrl
      const saved = await saveBase64('covers', name, data)
      return saved?.webSrc || coverUrl
    } catch (error) {
      console.warn('[Pages] On-device cover cache failed:', error)
      return coverUrl
    }
  }

  const cacheCoverImage = async (coverUrl) => {
    if (!isRemoteCoverUrl(coverUrl)) return coverUrl

    // Native: always cache to the device filesystem. Covers must never depend
    // on a server being reachable — only TTS, AI, and metadata lookups do.
    if (assetsAvailable()) {
      return cacheOnDevice(coverUrl)
    }

    // Web: convert to a data URL via the server endpoint.
    try {
      const result = await $fetch(apiUrl('/api/books/cache-cover'), {
        method: 'POST',
        body: { url: coverUrl },
      })
      return result?.dataUrl || coverUrl
    } catch (error) {
      console.warn('[Pages] Failed to cache remote cover image:', error)
      return coverUrl
    }
  }

  return { cacheCoverImage }
}
