import { syncDeviceLibrary } from '~/composables/useDeviceLibrarySync'
import { startSeriesSuggestionSweep } from '~/composables/useSeriesSuggestions'
import { useBooks } from '~/composables/useBooks'
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
    // setTimeout drops the Nuxt context, and the sync uses useState-backed
    // composables — restore the context or every composable call throws.
    setTimeout(() => {
      nuxtApp.runWithContext(() => {
        syncDeviceLibrary()

        const { seriesList } = useBooks()
        startSeriesSuggestionSweep({ seriesList })
      })
    }, 2500)

    setInterval(() => {
      // Skip while backgrounded — Android throttles the WebView's timers there
      // anyway, and a hidden app doesn't need a fresh scan.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      nuxtApp.runWithContext(() => syncDeviceLibrary({ silent: true }))
    }, DEVICE_RESCAN_INTERVAL_MS)
  })
})
