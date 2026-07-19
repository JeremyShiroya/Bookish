// Sideloaded-APK update checker.
//
// Bookish APKs are installed outside the Play Store, so nothing tells a user a
// newer build exists. On native startup this fetches a small manifest
// (version.json — see scripts/generate-version-manifest.mjs), compares its
// versionCode against the installed one, and offers the download.
//
// It only ever OPENS the APK url; it never downloads or installs anything
// itself. That keeps Bookish free of the REQUEST_INSTALL_PACKAGES permission —
// the browser handles the download and Android's own installer takes over.
//
// The manifest is remote content, so it is treated as untrusted: the validation
// rules live in composables/appUpdateManifest.js and are shared with the script
// that generates it.

import { useState } from '#app'
import { normalizeUpdateManifest, shouldPromptForUpdate } from '~/composables/appUpdateManifest'
import { isNativeCapacitorPlatform } from '~/composables/useNativePlatform'

export const SKIPPED_VERSION_KEY = 'bookish:update-skipped-code'

const readSkippedCode = () => {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(SKIPPED_VERSION_KEY)
  } catch {
    return null
  }
}

const writeSkippedCode = (versionCode) => {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(SKIPPED_VERSION_KEY, String(versionCode))
  } catch {
    // Private browsing / quota — skipping simply won't persist.
  }
}

// Reads the installed versionCode from the native shell. `build` is the
// versionCode on Android (see @capacitor/app AppInfo).
export async function readInstalledVersion() {
  if (!isNativeCapacitorPlatform()) return null
  try {
    const { App } = await import('@capacitor/app')
    const info = await App.getInfo()
    return { code: info?.build ?? null, name: info?.version ?? '' }
  } catch {
    return null
  }
}

export const useAppUpdate = () => {
  const available = useState('app-update:available', () => null)
  const installed = useState('app-update:installed', () => null)
  const checking = useState('app-update:checking', () => false)

  const config = useRuntimeConfig()
  const manifestUrl = config.public?.updateManifestUrl || ''

  // Background check: every failure path is silent. A user who opens the app on
  // a train should never see an error because a manifest fetch timed out.
  const checkForUpdate = async ({ force = false } = {}) => {
    if (checking.value) return null
    if (!isNativeCapacitorPlatform() || !manifestUrl) return null

    checking.value = true
    try {
      const current = await readInstalledVersion()
      if (!current) return null
      installed.value = current

      // cache: 'no-store' so a CDN-cached manifest can't hide a fresh release.
      const response = await fetch(manifestUrl, { cache: 'no-store' })
      if (!response.ok) return null

      const manifest = normalizeUpdateManifest(await response.json())
      const prompt = shouldPromptForUpdate({
        installedCode: current.code,
        manifest,
        // A manual "check now" ignores an earlier skip.
        skippedCode: force ? null : readSkippedCode(),
      })

      available.value = prompt ? manifest : null
      return available.value
    } catch {
      return null
    } finally {
      checking.value = false
    }
  }

  // Hide until a newer build than this one ships.
  const skip = () => {
    if (available.value && !available.value.mandatory) {
      writeSkippedCode(available.value.versionCode)
    }
    available.value = null
  }

  // Hide for now; the next launch offers it again.
  const dismiss = () => {
    available.value = null
  }

  return { available, installed, checking, checkForUpdate, skip, dismiss }
}
