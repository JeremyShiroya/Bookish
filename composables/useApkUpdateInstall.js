// Downloads an update APK inside the app and opens Android's installer for it.
//
// The previous flow handed the apk url to the browser. That worked, but it left
// the app: the progress lived in Chrome's notification shade, the file landed in
// Downloads, and the user had to find and tap it. It also produced downloads
// that sat at "100%" indefinitely while Chrome held the file for verification,
// with nothing in the app able to report or retry.
//
// Doing the transfer ourselves puts the progress in our own modal and puts the
// finished file straight in front of the installer.
//
// WHAT IS NOT POSSIBLE, so the UI never pretends otherwise: Android does not let
// a normal app install a package silently, or relaunch itself afterwards. The
// system installer dialog always appears and the user taps Install there, then
// Open — the app's own process is killed when its package is replaced, and
// background activity launches are blocked from Android 10, so there is no way
// to bring the user back automatically. One system dialog is the floor.

import { useState } from '#app'
import { isNativeCapacitorPlatform } from '~/composables/useNativePlatform'

// Cache, not Documents: an update APK is disposable the moment it is installed,
// and the OS may reclaim it. It is also already covered by the app's existing
// FileProvider cache-path, which is what lets the installer read it.
const APK_DIRECTORY = 'CACHE'
const APK_FILENAME = 'bookish-update.apk'

// status:
//   idle              — nothing happening
//   downloading       — transfer in flight, `percent` is meaningful
//   opening           — handing the file to the system installer
//   needs-permission  — user must allow "install unknown apps" first
//   error             — `message` explains it
export const useApkUpdateInstall = () => {
  const state = useState('app-update:install', () => ({
    status: 'idle',
    percent: 0,
    receivedBytes: 0,
    totalBytes: 0,
    message: '',
  }))

  const reset = () => {
    Object.assign(state.value, {
      status: 'idle', percent: 0, receivedBytes: 0, totalBytes: 0, message: '',
    })
    state.value = { ...state.value }
  }

  const fail = (message) => {
    state.value = { ...state.value, status: 'error', message }
    return false
  }

  // Can this build install at all? Web and any platform without the plugin
  // fall back to the browser hand-off rather than showing a broken button.
  const canInstallInApp = async () => {
    if (!isNativeCapacitorPlatform()) return false
    try {
      const { Capacitor } = await import('@capacitor/core')
      return Capacitor.isPluginAvailable('ApkInstaller')
    } catch {
      return false
    }
  }

  const openInstallSettings = async () => {
    try {
      const { Capacitor } = await import('@capacitor/core')
      await Capacitor.Plugins.ApkInstaller.openInstallSettings()
    } catch {
      // The screen could not be opened; the message in the modal still tells
      // the user what to turn on.
    }
  }

  // Download the APK, reporting progress, then open the installer.
  // Returns true when the installer was launched.
  const downloadAndInstall = async (manifest) => {
    const url = manifest?.apkUrl
    if (!url) return fail('This update has no download link.')

    let Capacitor
    let Filesystem
    let listener = null
    try {
      ({ Capacitor } = await import('@capacitor/core'));
      ({ Filesystem } = await import('@capacitor/filesystem'))
    } catch {
      return fail('The updater is unavailable in this build.')
    }

    const installer = Capacitor?.Plugins?.ApkInstaller
    if (!installer) return fail('The updater is unavailable in this build.')

    // Ask BEFORE downloading 11MB: being sent to a settings screen after a long
    // transfer, with the download then thrown away, is the worse order.
    try {
      const { granted } = await installer.canInstall()
      if (!granted) {
        state.value = {
          ...state.value,
          status: 'needs-permission',
          message: 'Android needs permission to install app updates from Pages.',
        }
        return false
      }
    } catch {
      // Older Android, or the check itself failed — carry on and let the
      // install attempt report the real problem.
    }

    state.value = {
      ...state.value, status: 'downloading', percent: 0, receivedBytes: 0, totalBytes: 0, message: '',
    }

    try {
      listener = await Filesystem.addListener('progress', ({ bytes, contentLength }) => {
        const total = Number(contentLength) || 0
        const received = Number(bytes) || 0
        state.value = {
          ...state.value,
          receivedBytes: received,
          totalBytes: total,
          // A server that sends no content-length leaves the bar indeterminate
          // rather than showing a fake percentage.
          percent: total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0,
        }
      })

      const result = await Filesystem.downloadFile({
        url,
        path: APK_FILENAME,
        directory: APK_DIRECTORY,
        progress: true,
        recursive: true,
      })

      const path = result?.path
      if (!path) return fail('The update finished downloading but could not be saved.')

      state.value = { ...state.value, status: 'opening', percent: 100 }
      await installer.install({ path })
      return true
    } catch (error) {
      const raw = String(error?.message || error || '')
      if (/PERMISSION_REQUIRED/i.test(raw)) {
        state.value = {
          ...state.value,
          status: 'needs-permission',
          message: 'Android needs permission to install app updates from Pages.',
        }
        return false
      }
      if (/network|failed to connect|unable to resolve|timeout|timed out/i.test(raw)) {
        return fail('The download could not be completed. Check your connection and try again.')
      }
      return fail(raw.trim() || 'The update could not be installed.')
    } finally {
      // Leaving this attached would keep reporting into a closed modal on the
      // next download.
      try { await listener?.remove() } catch { /* already gone */ }
    }
  }

  return { state, canInstallInApp, downloadAndInstall, openInstallSettings, reset }
}
