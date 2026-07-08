import { registerPlugin } from '@capacitor/core'
import { Filesystem } from '@capacitor/filesystem'
import { isNativeCapacitorPlatform } from '~/composables/useNativePlatform'
import { useBooks } from '~/composables/useBooks'
import { useBookStorage } from '~/composables/useBookStorage'
import { useDevicePermissionPrompt } from '~/composables/useDevicePermissionPrompt'
import { useToast } from '~/composables/useToast'

// ReadERA-style device library sync for the native app.
//
// On every app open Bookish scans the phone's storage for PDF / EPUB
// documents (via the DeviceBooks native plugin, which handles the
// All-files-access permission on Android 11+), imports anything new into the
// library, and then backfills missing book details from the web in the
// background — announcing each phase with a toast.

export const BOOKISH_DEVICE_IMPORTS_KEY = 'bookish:device-imports'
export const BOOKISH_DEVICE_SYNC_ASKED_KEY = 'bookish:device-sync-asked'
export const BOOKISH_SCAN_FOLDERS_KEY = 'bookish:scan-folders'

// Default: the whole shared storage. Users can narrow this from
// Settings → Storage → Scanned folders.
export const DEFAULT_SCAN_FOLDERS = Object.freeze(['/storage/emulated/0'])

const DeviceBooks = registerPlugin('DeviceBooks')

let _syncInFlight = false

const resolveStorage = () => (typeof localStorage === 'undefined' ? null : localStorage)

export function readImportRegistry(storage = resolveStorage()) {
  if (!storage) return {}
  try {
    const parsed = JSON.parse(storage.getItem(BOOKISH_DEVICE_IMPORTS_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function writeImportRegistry(registry, storage = resolveStorage()) {
  if (!storage) return
  try {
    storage.setItem(BOOKISH_DEVICE_IMPORTS_KEY, JSON.stringify(registry))
  } catch {
    // Quota errors just mean the same files get re-checked next open.
  }
}

export function normalizeScanFolder(value) {
  const cleaned = String(value || '').trim().replace(/\/+$/, '')
  if (!cleaned) return ''
  if (cleaned.startsWith('/')) return cleaned
  // Accept bare folder names like "Download" relative to shared storage.
  return `/storage/emulated/0/${cleaned.replace(/^\/+/, '')}`
}

export function readScanFolders(storage = resolveStorage()) {
  if (!storage) return [...DEFAULT_SCAN_FOLDERS]
  try {
    const parsed = JSON.parse(storage.getItem(BOOKISH_SCAN_FOLDERS_KEY) || 'null')
    if (!Array.isArray(parsed)) return [...DEFAULT_SCAN_FOLDERS]
    const folders = parsed.map(normalizeScanFolder).filter(Boolean)
    return folders.length ? folders : []
  } catch {
    return [...DEFAULT_SCAN_FOLDERS]
  }
}

export function writeScanFolders(folders, storage = resolveStorage()) {
  const normalized = [...new Set((folders || []).map(normalizeScanFolder).filter(Boolean))]
  try {
    storage?.setItem(BOOKISH_SCAN_FOLDERS_KEY, JSON.stringify(normalized))
  } catch {}
  return normalized
}

// Permanently remove a device-imported document from the phone, and forget it in
// the import registry so the next scan doesn't treat it as a "new" file and
// re-import the book the user just deleted. Best-effort: a missing file or a
// denied permission must never block deleting the book from the library.
export async function deleteDeviceImport(book) {
  const path = book?.deviceImportPath
  if (!path || !import.meta.client || !isNativeCapacitorPlatform()) return false

  let deleted = false
  try {
    const result = await DeviceBooks.deleteFile({ path })
    deleted = !!result?.deleted
  } catch (error) {
    console.warn('[DeviceSync] Could not delete device file', path, error)
  }

  // KEEP the registry entry and tombstone it. Clearing it would make the next
  // scan treat the file as brand new — so a deletion that failed (permission
  // revoked, read-only volume) would silently re-import the book the user just
  // deleted. A tombstone keeps it deleted either way.
  try {
    const registry = readImportRegistry()
    registry[path] = { ...(registry[path] || {}), bookId: null, deletedByUser: true }
    writeImportRegistry(registry)
  } catch {
    // Quota failure only means the file gets re-checked on the next scan.
  }

  return deleted
}

export function fileInScanFolders(path, folders) {
  const target = String(path || '')
  return (folders || []).some((folder) => (
    target === folder || target.startsWith(`${folder}/`)
  ))
}

// Reading a file into the WebView goes through a base64 bridge — very large
// documents would exhaust memory, so they are left for manual import.
export const MAX_DEVICE_IMPORT_BYTES = 150 * 1024 * 1024

// A device file needs importing when it was never imported, or when the file
// on disk changed since (size or modification time differ).
export function selectNewDeviceFiles(files, registry) {
  return (Array.isArray(files) ? files : []).filter((file) => {
    if (!file?.path || !/\.(pdf|epub)$/i.test(file.path)) return false
    if (Number(file.size) > MAX_DEVICE_IMPORT_BYTES) return false
    const known = registry[file.path]
    if (!known) return true
    // The user deleted this book. Never resurrect it, even if the file survived
    // (deletion can fail) or its timestamp changed.
    if (known.deletedByUser) return false
    return Number(known.size) !== Number(file.size) || Number(known.modified) !== Number(file.modified)
  })
}

export function cleanTitleFromFileName(name) {
  return String(name || '')
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Fields the background pass may fill — only ever writes over empty values.
export function mergeMetadataIntoBook(book, meta) {
  if (!meta) return null
  const updated = { ...book }
  let changed = false

  const fillText = (field) => {
    const current = String(updated[field] ?? '').trim()
    const next = String(meta[field] ?? '').trim()
    if (!current && next) {
      updated[field] = next
      changed = true
    }
  }

  for (const field of ['author', 'blurb', 'genre', 'series', 'publisher']) fillText(field)

  if (!updated.publishYear && meta.publishYear) {
    updated.publishYear = meta.publishYear
    changed = true
  }
  if (!updated.seriesInstallment && updated.series && meta.seriesInstallment) {
    updated.seriesInstallment = meta.seriesInstallment
    changed = true
  }
  if (!updated.seriesTotal && updated.series && Number(meta.seriesTotal) > 0) {
    updated.seriesTotal = meta.seriesTotal
    changed = true
  }
  if (!updated.webReview && meta.webReview) {
    updated.webReview = meta.webReview
    changed = true
  }

  const hasRealCover = typeof updated.cover === 'string'
    && updated.cover
    && !updated.cover.startsWith('data:image/svg+xml')
  if (!hasRealCover && meta.cover) {
    updated.cover = meta.cover
    changed = true
  }

  return changed ? updated : null
}

function generateCoverPlaceholder(title) {
  const colors = ['#8A2BE2', '#6A0DAD', '#2f7d62', '#b45309']
  const safeTitle = String(title || 'Book')
  const hash = [...safeTitle].reduce((total, c) => total + c.charCodeAt(0), 0)
  const color = colors[hash % colors.length]
  const initial = safeTitle.trim()[0]?.toUpperCase() || '?'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="${color}"/><text x="100" y="145" font-family="serif" font-size="96" fill="rgba(255,255,255,.48)" text-anchor="middle" dominant-baseline="middle">${initial}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function base64ToFile(base64, name, extension) {
  // Tolerate a data: URI prefix or stray whitespace from either reader path.
  const clean = String(base64 || '').replace(/^data:[^,]*,/, '').replace(/\s/g, '')
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  const type = extension === 'pdf' ? 'application/pdf' : 'application/epub+zip'
  return new File([bytes], name, { type })
}

// Ask once per app open via the styled in-app modal; the actual grant happens
// on the system settings screen, so we re-check when the app regains focus.
async function ensureStoragePermission(addToast, askForConsent) {
  const { granted } = await DeviceBooks.check()
  if (granted) return true

  const storage = resolveStorage()
  const alreadyAsked = storage?.getItem(BOOKISH_DEVICE_SYNC_ASKED_KEY)

  const wantsToGrant = await askForConsent()
  try { storage?.setItem(BOOKISH_DEVICE_SYNC_ASKED_KEY, '1') } catch {}
  if (!wantsToGrant) {
    if (!alreadyAsked) addToast('Device book scan skipped — you can enable file access any time from Android settings.', 'info')
    return false
  }

  await DeviceBooks.request()

  // Wait for the user to come back from the settings screen (or a legacy
  // permission dialog to close), then re-check.
  const regained = await new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      document.removeEventListener('visibilitychange', onVisible)
      resolve()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') setTimeout(finish, 350)
    }
    document.addEventListener('visibilitychange', onVisible)
    setTimeout(finish, 120000)
  }).then(() => DeviceBooks.check())

  return !!regained.granted
}

// Prefer the native plugin's reader (same permission that listed the file);
// fall back to Capacitor Filesystem only if that fails.
async function readDeviceFileBase64(path) {
  try {
    const { data } = await DeviceBooks.readFile({ path })
    if (data) return data
  } catch (error) {
    console.warn('[DeviceSync] Native readFile failed, trying Filesystem:', error)
  }
  const { data } = await Filesystem.readFile({ path })
  return data
}

async function importDeviceFile(file, { addBook, saveBookContent }) {
  const extension = file.name.split('.').pop().toLowerCase()
  const data = await readDeviceFileBase64(file.path)
  const documentFile = base64ToFile(data, file.name, extension)

  let extracted = {}
  let source = null
  if (extension === 'epub') {
    const { extractEpub } = await import('~/composables/useEpubExtractor.js')
    extracted = await extractEpub(documentFile)
  } else {
    const { extractPdf } = await import('~/composables/usePdfExtractor.js')
    extracted = await extractPdf(documentFile)
    source = extracted.source ?? await documentFile.arrayBuffer()
  }

  const title = extracted.title || cleanTitleFromFileName(file.name)
  const savedBook = await addBook({
    title,
    author: extracted.author || '',
    format: extension,
    pages: extracted.pages || 0,
    progress: 0,
    status: 'Unread',
    isFavourite: false,
    cover: extracted.cover || generateCoverPlaceholder(title),
    blurb: '',
    genre: '',
    series: null,
    seriesInstallment: null,
    seriesTotal: null,
    deviceImport: true,
    deviceImportPath: file.path,
  })

  if (savedBook?.id && (extracted.content || source)) {
    await saveBookContent(savedBook.id, {
      content: extracted.content ?? null,
      pages: savedBook.pages || 0,
      tocTitles: extracted.tocTitles ?? [],
      source,
      tocItems: extracted.tocItems ?? [],
      format: extension,
      pdfTocChecked: extension === 'pdf',
      pdfTextMapVersion: extension === 'pdf' ? 2 : undefined,
      pdfManifest: extracted.pdfManifest ?? null,
    })
  }

  return savedBook
}

async function backfillBookMetadata(importedBooks, { updateBook, addToast }) {
  const targets = importedBooks.filter(Boolean)
  if (!targets.length) return

  addToast(`Fetching book details for ${targets.length} imported book${targets.length === 1 ? '' : 's'} in the background…`, 'info')

  const { fetchBookMetadataResults } = await import('~/composables/useBookMetadataSearch')
  let updatedCount = 0

  for (const book of targets) {
    try {
      const results = await fetchBookMetadataResults(book.title, book.author || undefined, undefined, {})
      const updated = mergeMetadataIntoBook(book, results?.[0])
      if (updated) {
        await updateBook(updated)
        updatedCount += 1
      }
    } catch (error) {
      console.warn('[DeviceSync] Metadata backfill failed for', book.title, error)
    }
  }

  addToast(
    updatedCount
      ? `Book details updated for ${updatedCount} of ${targets.length} imported book${targets.length === 1 ? '' : 's'}.`
      : 'Background metadata fetch finished — no extra details were found.',
    'success',
  )
}

export async function syncDeviceLibrary() {
  if (!import.meta.client || !isNativeCapacitorPlatform() || _syncInFlight) return
  _syncInFlight = true

  const { addToast } = useToast()
  const { addBook, updateBook, fetchAllData, initialized } = useBooks()
  const { saveBookContent } = useBookStorage()
  const { ask } = useDevicePermissionPrompt()

  try {
    if (!(await ensureStoragePermission(addToast, ask))) return

    const scanFolders = readScanFolders()
    if (!scanFolders.length) {
      addToast('Device scan is off — no folders are selected in Settings → Storage.', 'info')
      return
    }

    addToast('Scanning your device for new books…', 'info')

    const { files } = await DeviceBooks.scan()
    const registry = readImportRegistry()
    const inFolders = (files || []).filter((file) => fileInScanFolders(file.path, scanFolders))
    const newFiles = selectNewDeviceFiles(inFolders, registry)
    if (!newFiles.length) {
      addToast('Device scan complete — no new books found.', 'success')
      return
    }

    if (!initialized.value) await fetchAllData()

    addToast(`Found ${newFiles.length} book${newFiles.length === 1 ? '' : 's'} on your device — importing…`, 'info')

    const importedBooks = []
    for (const file of newFiles) {
      try {
        const saved = await importDeviceFile(file, { addBook, saveBookContent })
        if (saved) importedBooks.push(saved)
        registry[file.path] = { size: file.size, modified: file.modified, bookId: saved?.id ?? null }
      } catch (error) {
        console.warn('[DeviceSync] Could not import', file.path, error)
        // Remember the failure so a corrupt file isn't re-parsed every open.
        registry[file.path] = { size: file.size, modified: file.modified, failed: true }
      }
      writeImportRegistry(registry)
    }

    if (!importedBooks.length) {
      addToast('Device books could not be imported — the files may be corrupt.', 'error')
      return
    }

    addToast(`Imported ${importedBooks.length} book${importedBooks.length === 1 ? '' : 's'} from your device.`, 'success')

    await backfillBookMetadata(importedBooks, { updateBook, addToast })
  } catch (error) {
    console.warn('[DeviceSync] Device library sync failed:', error)
  } finally {
    _syncInFlight = false
  }
}
