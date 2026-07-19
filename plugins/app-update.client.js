import { useAppUpdate } from '~/composables/useAppUpdate'
import { isNativeCapacitorPlatform } from '~/composables/useNativePlatform'

// Checks for a newer sideloaded APK shortly after launch. Native only — the web
// and desktop builds update themselves by reloading.
//
// The delay keeps the network call off the critical path to first paint, and
// lands after the device-library scan (2.5s) so the two don't compete.
export default defineNuxtPlugin((nuxtApp) => {
  if (!isNativeCapacitorPlatform()) return

  nuxtApp.hook('app:mounted', () => {
    // setTimeout drops the Nuxt context, and useAppUpdate is useState-backed —
    // restore the context or the composable throws.
    setTimeout(() => {
      nuxtApp.runWithContext(() => useAppUpdate().checkForUpdate())
    }, 4000)
  })
})
