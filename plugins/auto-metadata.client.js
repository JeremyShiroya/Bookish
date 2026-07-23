import { startAutoMetadata, stopAutoMetadata } from '~/composables/useAutoMetadata'
import { useLibraryBackfill } from '~/composables/useMetadataBackfill'
import { useBookishSettings } from '~/composables/useBookishSettings'
import { useBooks } from '~/composables/useBooks'

// Starts the background book-details backfill on app open. It scans the library
// for books missing a cover, author, blurb, genre, year, Goodreads rating or
// series details, fills them from the web (cross-checking sources), then rests
// and repeats — all without the user asking. Controlled by the
// "metadataAutoFill" setting, so it can be turned off in Settings → Storage.
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => {
    nuxtApp.runWithContext(() => {
      const { settings } = useBookishSettings()
      const { books, updateBook } = useBooks()
      const { state: backfill } = useLibraryBackfill()

      const deps = {
        getBooks: () => books.value,
        updateBook,
        isBackfillRunning: () => backfill.running,
        isOnline: () => typeof navigator === 'undefined' || navigator.onLine !== false,
      }

      const sync = () => {
        if (settings.value.metadataAutoFill) startAutoMetadata(deps)
        else stopAutoMetadata()
      }

      sync()
      // React to the toggle without needing an app restart.
      watch(() => settings.value.metadataAutoFill, sync)
    })
  })
})
