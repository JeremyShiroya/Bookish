import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { isNativeCapacitorPlatform } from '~/composables/useNativePlatform'

// On-device binary asset store for the native app. Large binaries — book
// covers and PDF source files — live as real files in the app's private data
// directory instead of inside IndexedDB. That keeps them out of the JS heap
// (the WebView loads them straight from disk via convertFileSrc), works fully
// offline, and avoids the memory pressure of IndexedDB blob reads.
//
// Every method is a no-op / null on the web build, where IndexedDB + the
// server cover cache remain the source of truth.

const ASSET_ROOT = 'bookish-assets'

export function assetsAvailable() {
  return isNativeCapacitorPlatform()
}

function fullPath(subdir, name) {
  return `${ASSET_ROOT}/${subdir}/${name}`
}

async function ensureDir(subdir) {
  try {
    await Filesystem.mkdir({
      path: `${ASSET_ROOT}/${subdir}`,
      directory: Directory.Data,
      recursive: true,
    })
  } catch {
    // Already exists — Filesystem.mkdir rejects on an existing directory.
  }
}

// Turn a stored file URI into a URL the WebView <img>/pdf.js can load directly.
export function assetWebSrc(uri) {
  if (!uri) return null
  try {
    return Capacitor.convertFileSrc(uri)
  } catch {
    return uri
  }
}

function stripBase64Prefix(value) {
  return String(value || '').replace(/^data:[^,]*,/, '')
}

function arrayBufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64) {
  const clean = stripBase64Prefix(base64)
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export const useDeviceAssets = () => {
  // Returns { uri, webSrc } or null on failure / web.
  const saveBase64 = async (subdir, name, base64) => {
    if (!assetsAvailable()) return null
    try {
      await ensureDir(subdir)
      const path = fullPath(subdir, name)
      await Filesystem.writeFile({
        path,
        data: stripBase64Prefix(base64),
        directory: Directory.Data,
      })
      const { uri } = await Filesystem.getUri({ path, directory: Directory.Data })
      return { uri, webSrc: assetWebSrc(uri) }
    } catch (error) {
      console.warn('[DeviceAssets] saveBase64 failed:', error)
      return null
    }
  }

  const saveArrayBuffer = async (subdir, name, buffer) => {
    if (!buffer) return null
    return saveBase64(subdir, name, arrayBufferToBase64(buffer))
  }

  const readArrayBuffer = async (subdir, name) => {
    if (!assetsAvailable()) return null
    try {
      const { data } = await Filesystem.readFile({ path: fullPath(subdir, name), directory: Directory.Data })
      return base64ToArrayBuffer(data)
    } catch {
      return null
    }
  }

  const getUri = async (subdir, name) => {
    if (!assetsAvailable()) return null
    try {
      const { uri } = await Filesystem.getUri({ path: fullPath(subdir, name), directory: Directory.Data })
      return uri
    } catch {
      return null
    }
  }

  const exists = async (subdir, name) => {
    if (!assetsAvailable()) return false
    try {
      await Filesystem.stat({ path: fullPath(subdir, name), directory: Directory.Data })
      return true
    } catch {
      return false
    }
  }

  const remove = async (subdir, name) => {
    if (!assetsAvailable()) return
    try {
      await Filesystem.deleteFile({ path: fullPath(subdir, name), directory: Directory.Data })
    } catch {
      // Already gone.
    }
  }

  return { saveBase64, saveArrayBuffer, readArrayBuffer, getUri, exists, remove }
}
