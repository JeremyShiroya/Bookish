import { registerPlugin } from '@capacitor/core'
import { isNativeCapacitorPlatform } from '~/composables/useNativePlatform'
import { useBooks } from '~/composables/useBooks'
import { useBookStorage } from '~/composables/useBookStorage'
import { useToast } from '~/composables/useToast'
import {
  base64ToFile,
  importDocumentFile,
  readImportRegistry,
  writeImportRegistry,
} from '~/composables/useDeviceLibrarySync'

// Handles documents the app was opened with via the system "Open with" sheet
// (file managers, browsers, mail apps…). The native side parks the document
// URI; this consumes it, imports the book through the same pipeline as the
// device scan, and jumps straight into the reader — ReadERA-style.

const DeviceBooks = registerPlugin('DeviceBooks')

let _openInFlight = false

export function resolveOpenedExtension(name, mimeType) {
  const lower = String(name || '').toLowerCase()
  if (lower.endsWith('.pdf')) return 'pdf'
  if (lower.endsWith('.epub')) return 'epub'
  const mime = String(mimeType || '').toLowerCase()
  if (mime.includes('application/pdf')) return 'pdf'
  if (mime.includes('application/epub+zip')) return 'epub'
  return null
}

// Registry key for the shared import registry: "Open with" documents have no
// stable on-disk path, so name + size stands in to keep re-opens idempotent.
export function openedDocumentRegistryKey(name, size) {
  return `openwith:${name}:${size}`
}

// The startup device scan registers imports under their absolute path. When
// the opened document matches one of those by basename + size, it is the same
// file — opening it again must not create a duplicate book.
export function findScannedImportId(registry, name, size) {
  for (const [path, entry] of Object.entries(registry || {})) {
    if (!entry?.bookId || path.startsWith('openwith:')) continue
    if (path.split('/').pop() === name && Number(entry.size) === Number(size)) return entry.bookId
  }
  return null
}

export async function consumeOpenedDocument() {
  if (!import.meta.client || !isNativeCapacitorPlatform() || _openInFlight) return
  _openInFlight = true

  const { addToast } = useToast()

  try {
    const result = await DeviceBooks.consumeOpenedDocument()
    if (!result?.available || !result.data) return

    const extension = resolveOpenedExtension(result.name, result.mimeType)
    if (!extension) {
      addToast('Bookish can only open PDF and EPUB documents.', 'error')
      return
    }

    const { addBook, books, fetchAllData, initialized } = useBooks()
    const { saveBookContent } = useBookStorage()
    if (!initialized.value) await fetchAllData()

    // Re-opening a document that was already imported just opens its book —
    // whether it came in through "Open with" before, or the startup device
    // scan already picked the same file (same basename + size) off storage.
    const registry = readImportRegistry()
    const key = openedDocumentRegistryKey(result.name, result.size)
    const existingId = registry[key]?.bookId ?? findScannedImportId(registry, result.name, result.size)
    if (existingId && books.value.some((book) => book?.id === existingId)) {
      await navigateTo(`/reader/${existingId}`)
      return
    }

    addToast(`Opening ${result.name}…`, 'info')

    const documentFile = base64ToFile(result.data, result.name, extension)
    const savedBook = await importDocumentFile(documentFile, extension, { addBook, saveBookContent })
    if (!savedBook?.id) {
      addToast('That document could not be imported.', 'error')
      return
    }

    registry[key] = { size: result.size, bookId: savedBook.id }
    writeImportRegistry(registry)

    addToast(`Added “${savedBook.title}” to your library.`, 'success')
    await navigateTo(`/reader/${savedBook.id}`)
  } catch (error) {
    console.warn('[OpenedDocument] Could not open document:', error)
    addToast('That document could not be opened — the file may be corrupt.', 'error')
  } finally {
    _openInFlight = false
  }
}
