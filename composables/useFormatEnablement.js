import { computed } from 'vue'
import {
  SUPPORTED_FORMATS,
  enabledFormatsForMode,
  formatModeFor,
  normalizeEnabledFormats,
  useBookishSettings,
} from '~/composables/useBookishSettings'
import { useBooks } from '~/composables/useBooks'
import { useBookStorage } from '~/composables/useBookStorage'
import { useLibraryStore } from '~/composables/useLibraryStore'
import { coverAssetName, isLocalAssetCover } from '~/composables/useCoverImageCache'
import { useDeviceAssets } from '~/composables/useDeviceAssets'

// Turning a format OFF is not a filter. The app stops handling that format
// entirely: its books leave the library, and the device scanner stops detecting
// the extension (see selectNewDeviceFiles), so dropping one onto the phone later
// does not bring it back.
//
// The FILES ARE NEVER TOUCHED. This is the whole reason the purge cannot go
// through useBooks().deleteBook: that path deletes the device file and
// tombstones the import registry, which is right for "delete this book" and
// wrong here. Re-enabling a format has to let the next scan re-import from the
// files still sitting on disk.

export const formatLabel = (format) => (format === 'pdf' ? 'PDF' : 'EPUB')

export const booksOfFormat = (books, format) => (
  (books || []).filter((book) => String(book?.format || '').toLowerCase() === format)
)

// Formats that are on now and would be off after the change.
export const formatsRemovedBy = (currentFormats, nextFormats) => {
  const next = normalizeEnabledFormats(nextFormats)
  return normalizeEnabledFormats(currentFormats).filter((format) => !next.includes(format))
}

export const useFormatEnablement = () => {
  const { settings, updateSettings } = useBookishSettings()
  const { books, fetchAllData } = useBooks()

  const enabledFormats = computed(() => normalizeEnabledFormats(settings.value.enabledFormats))
  const formatMode = computed(() => formatModeFor(enabledFormats.value))

  // How many books a mode change would remove, so the confirmation can say the
  // number out loud rather than asking the user to guess.
  const countAffected = (nextFormats) => formatsRemovedBy(enabledFormats.value, nextFormats)
    .reduce((total, format) => total + booksOfFormat(books.value, format).length, 0)

  // Record + cached content + cached cover. Not the file.
  const purgeBook = async (book) => {
    const store = useLibraryStore()
    const { deleteBookContent } = useBookStorage()

    await Promise.all([
      store.deleteBook(book.id),
      import.meta.client ? deleteBookContent(book.id) : Promise.resolve(),
    ])

    if (!import.meta.client) return
    try {
      const name = coverAssetName(book.cover)
      if (name && isLocalAssetCover(book.cover)) await useDeviceAssets().remove('covers', name)
    } catch (error) {
      // An orphaned cover file is harmless; a failed purge is not.
      console.warn('[Formats] Could not remove a cached cover:', error)
    }
  }

  /**
   * Apply an app-level format choice, purging the books it removes.
   * @returns {Promise<{removed: number, formats: string[]}>}
   */
  const applyEnabledFormats = async (nextFormats) => {
    const next = normalizeEnabledFormats(nextFormats)
    const removedFormats = formatsRemovedBy(enabledFormats.value, next)

    // Write the setting FIRST. If a purge fails halfway the app is already
    // refusing to import that format again, so a retry converges instead of
    // racing a scan that re-adds what is being removed.
    updateSettings({ enabledFormats: next, formatChoiceMade: true })

    let removed = 0
    for (const format of removedFormats) {
      for (const book of booksOfFormat(books.value, format)) {
        try {
          await purgeBook(book)
          removed += 1
        } catch (error) {
          console.error('[Formats] Could not remove a book during format purge:', error)
        }
      }
    }

    if (removed > 0) await fetchAllData()
    return { removed, formats: removedFormats }
  }

  const applyFormatMode = (mode) => applyEnabledFormats(enabledFormatsForMode(mode))

  // The first-boot chooser has not been answered yet.
  const needsFormatChoice = computed(() => settings.value.formatChoiceMade !== true)

  const dismissFormatChoice = () => updateSettings({ formatChoiceMade: true })

  return {
    enabledFormats,
    formatMode,
    supportedFormats: SUPPORTED_FORMATS,
    countAffected,
    applyEnabledFormats,
    applyFormatMode,
    needsFormatChoice,
    dismissFormatChoice,
  }
}
