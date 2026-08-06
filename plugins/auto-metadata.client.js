import { App } from '@capacitor/app'
import { startAutoMetadata, wakeAutoMetadata } from '~/composables/useAutoMetadata'
import { useLibraryBackfill, unmarkFalseStandalones } from '~/composables/useMetadataBackfill'
import { runSeriesSuggestionSweep, realignEntireLibrarySeries } from '~/composables/useSeriesSuggestions'
import { useBookishSettings } from '~/composables/useBookishSettings'
import { useBooks } from '~/composables/useBooks'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => {
    nuxtApp.runWithContext(async () => {
      const { settings } = useBookishSettings()
      const { books, seriesList, updateBook, initialized, fetchAllData } = useBooks()
      const { state: backfill, unmarkFalseStandalones } = useLibraryBackfill()

      if (!initialized.value) {
        try {
          await fetchAllData()
        } catch {}
      }

      const REALIGN_KEY = 'bookish:migration:v2.0-instant-series-realign'
      if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function' && !localStorage.getItem(REALIGN_KEY)) {
        try {
          const list = books.value || []
          if (list.length > 0) {
            await unmarkFalseStandalones(list, updateBook)
            await realignEntireLibrarySeries({ books: list, seriesList: seriesList?.value || [], updateBook })
            localStorage.setItem?.(REALIGN_KEY, 'true')
          }
        } catch {}
      }

      const deps = {
        getBooks: () => books.value,
        updateBook,
        isBackfillRunning: () => backfill.running,
        isFillEnabled: () => settings.value.metadataAutoFill === true,
        isOnline: () => typeof navigator === 'undefined' || navigator.onLine !== false,
        runSeriesSweep: () => nuxtApp.runWithContext(
          () => runSeriesSuggestionSweep({ seriesList, settings }),
        ),
      }

      startAutoMetadata(deps)

      const handleAppResume = () => {
        nuxtApp.runWithContext(async () => {
          try {
            const list = books.value || []
            if (list.length > 0) {
              await realignEntireLibrarySeries({ books: list, seriesList: seriesList?.value || [], updateBook })
            }
          } catch {}
          wakeAutoMetadata()
        })
      }

      if (typeof App !== 'undefined' && typeof App.addListener === 'function') {
        try {
          App.addListener('appStateChange', ({ isActive }) => {
            if (isActive) handleAppResume()
          })
        } catch {}
      }

      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') handleAppResume()
        })
      }
    })
  })
})
