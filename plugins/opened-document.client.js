import { consumeOpenedDocument } from '~/composables/useOpenedDocument'
import { isNativeCapacitorPlatform } from '~/composables/useNativePlatform'

// Imports and opens the document Bookish was launched with from the system
// "Open with" sheet. Cold starts consume the parked document once the app is
// mounted; warm starts (app already running, launchMode singleTask) are
// nudged by MainActivity through the bookishOpenedDocument window event.
export default defineNuxtPlugin((nuxtApp) => {
  if (!isNativeCapacitorPlatform()) return

  nuxtApp.hook('app:mounted', () => {
    nuxtApp.runWithContext(() => consumeOpenedDocument())
  })

  window.addEventListener('bookishOpenedDocument', () => {
    nuxtApp.runWithContext(() => consumeOpenedDocument())
  })
})
