import { startAutoMetadata } from '~/composables/useAutoMetadata'
import { useLibraryBackfill } from '~/composables/useMetadataBackfill'
import { runSeriesSuggestionSweep } from '~/composables/useSeriesSuggestions'
import { useBookishSettings } from '~/composables/useBookishSettings'
import { useBooks } from '~/composables/useBooks'

// The app's single background-work scheduler.
//
// Each turn it tops up a batch of books missing a cover, author, blurb, genre,
// year, Goodreads rating or series details, then gives the series-suggestion
// sweep its turn, then rests for as long as the backlog and the sources
// warrant. Both jobs draw on the same handful of metadata providers, so running
// them from one loop makes them take turns instead of colliding on two
// independent timers.
//
// The book fill is controlled by "metadataAutoFill" and the sweep by
// "seriesSuggestions"; each checks its own setting, so either can be off
// without stopping the other.
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => {
    nuxtApp.runWithContext(() => {
      const { settings } = useBookishSettings()
      const { books, seriesList, updateBook } = useBooks()
      const { state: backfill } = useLibraryBackfill()

      const deps = {
        getBooks: () => books.value,
        updateBook,
        isBackfillRunning: () => backfill.running,
        // Toggling this off pauses the book fill without stopping the loop, so
        // the series sweep keeps its turn.
        isFillEnabled: () => settings.value.metadataAutoFill === true,
        isOnline: () => typeof navigator === 'undefined' || navigator.onLine !== false,
        // Injected rather than imported so the two composables stay free of a
        // circular dependency — the suggestions module already imports this
        // one's result-verification guard.
        runSeriesSweep: () => nuxtApp.runWithContext(
          () => runSeriesSuggestionSweep({ seriesList, settings }),
        ),
      }

      // One loop, started once. Each phase reads its own setting every cycle,
      // so toggling either takes effect without an app restart.
      startAutoMetadata(deps)
    })
  })
})
