import { App } from '@capacitor/app'
import { isNativeCapacitorPlatform } from '~/composables/useNativePlatform'

// Makes the hardware back button behave like a normal Android app: navigate
// back through the router history, and only minimize the app from a root
// screen. Without this listener Capacitor closes the app on every press.
const ROOT_PATHS = new Set(['/', '/books', '/series', '/favourites', '/playlists'])

export default defineNuxtPlugin((nuxtApp) => {
  if (!isNativeCapacitorPlatform()) return

  const router = useRouter()

  App.addListener('backButton', () => {
    const path = router.currentRoute.value.path

    // From a tab root there is nothing to go back to — hand over to Android
    // (minimize rather than destroy, like most reading apps).
    if (path === '/' ) {
      App.minimizeApp()
      return
    }

    if (window.history.length > 1) {
      router.back()
      return
    }

    // Deep link with no in-app history: fall back to the closest root.
    if (ROOT_PATHS.has(path)) App.minimizeApp()
    else router.replace('/')
  })
})
