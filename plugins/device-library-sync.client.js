import { syncDeviceLibrary } from '~/composables/useDeviceLibrarySync'
import { hydrateSeriesSuggestions, seedSeriesSuggestions } from '~/composables/useSeriesSuggestions'
import { isNativeCapacitorPlatform } from '~/composables/useNativePlatform'

// Repeating background scans keep the library current without reopening the
// app — new files land in the library, and series gaps resolve on their own.
export const DEVICE_RESCAN_INTERVAL_MS = 3 * 60 * 1000

// Kicks off the ReadERA-style device scan on every native app open, shortly
// after startup so the first paint isn't competing with storage work. The
// first scan narrates with toasts as before; after that a silent rescan runs
// every few minutes so books added to the device mid-session are picked up
// without any chatter. The series-suggestion sweep rides the same lifecycle.
export default defineNuxtPlugin((nuxtApp) => {
  if (!isNativeCapacitorPlatform()) return

  nuxtApp.hook('app:mounted', () => {
    // Suggestions already on the device go into the shared store immediately,
    // so a series page paints its missing books on first render instead of
    // waiting on its own lookup.
    nuxtApp.runWithContext(() => hydrateSeriesSuggestions())

    // Then the rosters bundled with the app, for series this device has never
    // resolved. At app start rather than on a series page, so the very first
    // series a reader opens is already complete — the whole point is that a
    // common series costs no lookup, no quota and no wait.
    nuxtApp.runWithContext(() => seedSeriesSuggestions().catch(() => {}))

    // setTimeout drops the Nuxt context, and the sync uses useState-backed
    // composables — restore the context or every composable call throws.
    setTimeout(() => {
      // The series-suggestion sweep used to get its own interval here. It now
      // shares the background scheduler in auto-metadata.client.js, so the two
      // jobs take turns on the same metadata sources rather than colliding.
      nuxtApp.runWithContext(() => syncDeviceLibrary())
    }, 2500)

    setInterval(() => {
      // Skip while backgrounded — Android throttles the WebView's timers there
      // anyway, and a hidden app doesn't need a fresh scan.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      nuxtApp.runWithContext(() => syncDeviceLibrary({ silent: true }))
    }, DEVICE_RESCAN_INTERVAL_MS)
  })
})
