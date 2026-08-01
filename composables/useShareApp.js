// Share the app itself — the installer file, not a link.
//
// Pages is sideloaded, so there is no store page to point anyone at. The way a
// reader passes it to a friend is to hand over the APK, and every route they
// would use for that (WhatsApp, Gmail, Bluetooth, Nearby Share) is already in
// the system share sheet. This puts the app's own APK into it.
//
// The recipient gets a complete app: the library is built from books on their
// own device, so nothing here is personal to the sender — no books, no reading
// history, no settings travel with it.

import { useRuntimeConfig } from '#app'
import { isNativeCapacitorPlatform } from '~/composables/useNativePlatform'

// Android still gates installing files from outside a store, and a recipient
// who is not told that reads the resulting warning as "this app is unsafe"
// rather than "Android needs permission once". Saying it up front is the
// difference between an install and a delete.
const SHARE_TEXT = [
  'Pages — a private reading and listening library for EPUB and PDF.',
  '',
  'To install: open the file and allow your browser or messaging app to install apps this once.',
  'Android asks because the app comes from outside the Play Store.',
].join('\n')

export const useShareApp = () => {
  const config = useRuntimeConfig()

  const canShareApp = () => {
    if (!isNativeCapacitorPlatform()) return false
    try {
      // eslint-disable-next-line no-undef
      return !!window.Capacitor?.isPluginAvailable?.('ApkInstaller')
    } catch {
      return false
    }
  }

  /** Returns { ok } or { ok: false, reason } — reason is already readable. */
  const shareApp = async () => {
    if (!canShareApp()) {
      return { ok: false, reason: 'Sharing the app is only available in the Android app.' }
    }

    try {
      const { Capacitor } = await import('@capacitor/core')
      const version = config.public?.appVersion || ''
      await Capacitor.Plugins.ApkInstaller.shareApk({
        version,
        subject: `Pages${version ? ` ${version}` : ''}`,
        title: 'Share Pages',
        text: SHARE_TEXT,
      })
      return { ok: true }
    } catch (error) {
      const raw = String(error?.message || error || '')
      if (/SPLIT_APK/.test(raw)) {
        // A store-style split install cannot be handed over as one file, and
        // sharing only the base part would produce a file that fails to install.
        return { ok: false, reason: 'This build is split into several files and cannot be shared directly.' }
      }
      return { ok: false, reason: raw.trim() || 'The app could not be shared.' }
    }
  }

  return { canShareApp, shareApp }
}
