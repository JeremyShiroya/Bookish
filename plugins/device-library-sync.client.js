import { syncDeviceLibrary } from '~/composables/useDeviceLibrarySync'
import { isNativeCapacitorPlatform } from '~/composables/useNativePlatform'

// Kicks off the ReadERA-style device scan on every native app open, shortly
// after startup so the first paint isn't competing with storage work.
export default defineNuxtPlugin((nuxtApp) => {
  if (!isNativeCapacitorPlatform()) return

  nuxtApp.hook('app:mounted', () => {
    // setTimeout drops the Nuxt context, and the sync uses useState-backed
    // composables — restore the context or every composable call throws.
    setTimeout(() => {
      nuxtApp.runWithContext(() => syncDeviceLibrary())
    }, 2500)
  })
})
