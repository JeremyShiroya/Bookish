import { toRaw } from 'vue'
import { assetWebSrc, assetsAvailable, useDeviceAssets } from '~/composables/useDeviceAssets'

const DB_NAME = 'bookish-storage'
const STORE_NAME = 'book-content'
const PDF_SOURCE_STORE_NAME = 'book-pdf-source'
const DB_VERSION = 2

// Marker kept in IndexedDB when a book's PDF bytes live on the device
// filesystem instead of in IndexedDB (native app).
const DEVICE_FILE_MARKER = { __deviceFile: 'pdf' }
const pdfFileName = (bookId) => `${bookId}.pdf`

// Convert whatever the caller passed as a PDF source into an ArrayBuffer,
// without pulling in pdf.js.
async function sourceToArrayBuffer(source) {
  if (!source) return null
  const raw = toRaw(source)
  if (raw instanceof ArrayBuffer) return raw.slice(0)
  if (ArrayBuffer.isView(raw)) return raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
  if (typeof Blob !== 'undefined' && raw instanceof Blob) return raw.arrayBuffer()
  if (typeof raw === 'string' && !/^(https?:|capacitor:|file:|blob:)/i.test(raw)) {
    const base64 = raw.includes(',') ? raw.split(',')[1] : raw
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return bytes.buffer
  }
  return null
}

function cloneForStorage(value) {
  if (value === null || value === undefined) return value
  const raw = toRaw(value)
  if (raw instanceof ArrayBuffer) return raw.slice(0)
  if (ArrayBuffer.isView(raw)) {
    return raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
  }
  if (typeof Blob !== 'undefined' && raw instanceof Blob) return raw
  return JSON.parse(JSON.stringify(raw))
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
      if (!db.objectStoreNames.contains(PDF_SOURCE_STORE_NAME)) {
        db.createObjectStore(PDF_SOURCE_STORE_NAME)
      }
    }
    request.onsuccess = (e) => resolve(e.target.result)
    request.onerror = (e) => reject(e.target.error)
  })
}

function normalizeSourceForStorage(source) {
  return cloneForStorage(source)
}

function emptyStorageSummary(error = null) {
  return {
    available: !error,
    contentCount: 0,
    sourceCount: 0,
    totalBytes: 0,
    error,
  }
}

function estimateStoredBytes(value, seen = new WeakSet()) {
  if (value === null || value === undefined) return 0
  if (typeof value === 'string') return value.length * 2
  if (typeof value === 'number') return 8
  if (typeof value === 'boolean') return 4
  if (value instanceof ArrayBuffer) return value.byteLength
  if (ArrayBuffer.isView(value)) return value.byteLength
  if (typeof Blob !== 'undefined' && value instanceof Blob) return value.size
  if (typeof value !== 'object') return 0
  if (seen.has(value)) return 0

  seen.add(value)

  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + estimateStoredBytes(item, seen), 0)
  }

  return Object.entries(value).reduce((sum, [key, item]) => {
    return sum + key.length * 2 + estimateStoredBytes(item, seen)
  }, 0)
}

function summarizeStore(db, storeName) {
  if (!db.objectStoreNames.contains(storeName)) {
    return Promise.resolve({ count: 0, bytes: 0 })
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const cursorRequest = store.openCursor()
    let count = 0
    let bytes = 0

    cursorRequest.onsuccess = (event) => {
      const cursor = event.target.result
      if (!cursor) return
      count += 1
      bytes += estimateStoredBytes(cursor.value)
      cursor.continue()
    }

    tx.oncomplete = () => resolve({ count, bytes })
    tx.onerror = (event) => reject(event.target.error)
    tx.onabort = (event) => reject(event.target.error ?? new DOMException('Transaction aborted'))
  })
}

export const useBookStorage = () => {
  const deviceAssets = useDeviceAssets()

  const putPdfSourceRecord = async (bookId, value) => {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PDF_SOURCE_STORE_NAME, 'readwrite')
      const store = tx.objectStore(PDF_SOURCE_STORE_NAME)
      if (value === null) store.delete(bookId)
      else store.put(value, bookId)
      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject(e.target.error)
      tx.onabort = (e) => reject(e.target.error ?? new DOMException('Transaction aborted'))
    })
  }

  const savePdfSource = async (bookId, source) => {
    if (source === undefined) return

    // Native: keep the (large) PDF bytes on the filesystem, not in IndexedDB.
    // IndexedDB only holds a small marker so we know where to look.
    if (assetsAvailable()) {
      if (source === null) {
        await deviceAssets.remove('pdfs', pdfFileName(bookId))
        await putPdfSourceRecord(bookId, null)
        return
      }
      const buffer = await sourceToArrayBuffer(source)
      if (buffer) {
        const saved = await deviceAssets.saveArrayBuffer('pdfs', pdfFileName(bookId), buffer)
        if (saved) {
          await putPdfSourceRecord(bookId, { ...DEVICE_FILE_MARKER })
          return
        }
      }
      // Fell through (couldn't write file) — fall back to IndexedDB below.
    }

    await putPdfSourceRecord(bookId, source === null ? null : normalizeSourceForStorage(source))
  }

  const saveBookContent = async (bookId, {
    content,
    pages,
    tocTitles,
    source,
    tocItems,
    format,
    pdfTocChecked,
    pdfTextMapVersion,
    pdfManifest,
  }) => {
    if (source !== undefined) {
      await savePdfSource(bookId, source)
    }

    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const record = { content: cloneForStorage(content ?? null), pages: cloneForStorage(pages ?? 0) }
      if (tocTitles !== undefined) record.tocTitles = cloneForStorage(tocTitles ?? null)
      if (tocItems !== undefined) record.tocItems = cloneForStorage(tocItems ?? null)
      if (format !== undefined) record.format = cloneForStorage(format ?? null)
      if (pdfTocChecked !== undefined) record.pdfTocChecked = !!pdfTocChecked
      if (pdfTextMapVersion !== undefined) record.pdfTextMapVersion = Number(pdfTextMapVersion) || 0
      if (pdfManifest !== undefined) record.pdfManifest = cloneForStorage(pdfManifest ?? null)
      tx.objectStore(STORE_NAME).put(record, bookId)
      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject(e.target.error)
      tx.onabort = (e) => reject(e.target.error ?? new DOMException('Transaction aborted'))
    })
  }

  const getBookContent = async (bookId) => {
    const db = await openDB()
    const content = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(bookId)
      req.onsuccess = (e) => resolve(e.target.result ?? null)
      req.onerror = (e) => reject(e.target.error)
    })

    const source = await new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains(PDF_SOURCE_STORE_NAME)) {
        resolve(null)
        return
      }

      const tx = db.transaction(PDF_SOURCE_STORE_NAME, 'readonly')
      const req = tx.objectStore(PDF_SOURCE_STORE_NAME).get(bookId)
      req.onsuccess = (e) => resolve(e.target.result ?? null)
      req.onerror = (e) => reject(e.target.error)
    })

    let resolvedSource = source ?? content?.source ?? null

    // Native: resolve the PDF source to a streamable device-file URL.
    if (assetsAvailable()) {
      const name = pdfFileName(bookId)
      const isMarker = resolvedSource && typeof resolvedSource === 'object' && resolvedSource.__deviceFile
      if (isMarker || await deviceAssets.exists('pdfs', name)) {
        // Marker (or file already present) → hand pdf.js the on-disk URL.
        const uri = await deviceAssets.getUri('pdfs', name)
        resolvedSource = uri ? assetWebSrc(uri) : null
      } else if (resolvedSource && resolvedSource !== null) {
        // Legacy PDF still living in IndexedDB — migrate it to the filesystem
        // once, then serve it from disk from now on.
        const buffer = await sourceToArrayBuffer(resolvedSource)
        if (buffer) {
          const saved = await deviceAssets.saveArrayBuffer('pdfs', name, buffer)
          if (saved?.webSrc) {
            await putPdfSourceRecord(bookId, { ...DEVICE_FILE_MARKER })
            resolvedSource = saved.webSrc
          }
        }
      }
    }

    if (!content && (resolvedSource === null || resolvedSource === undefined)) return null

    const result = { ...(content ?? { content: null, pages: 0 }) }
    if (resolvedSource !== null && resolvedSource !== undefined) result.source = resolvedSource
    return result
  }

  const deleteBookContent = async (bookId) => {
    // Remove the on-device PDF file too (native).
    if (assetsAvailable()) {
      await deviceAssets.remove('pdfs', pdfFileName(bookId))
    }
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const stores = db.objectStoreNames.contains(PDF_SOURCE_STORE_NAME)
        ? [STORE_NAME, PDF_SOURCE_STORE_NAME]
        : [STORE_NAME]
      const tx = db.transaction(stores, 'readwrite')
      tx.objectStore(STORE_NAME).delete(bookId)
      if (stores.includes(PDF_SOURCE_STORE_NAME)) {
        tx.objectStore(PDF_SOURCE_STORE_NAME).delete(bookId)
      }
      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject(e.target.error)
      tx.onabort = (e) => reject(e.target.error ?? new DOMException('Transaction aborted'))
    })
  }

  const hasBookContent = async (bookId) => {
    const stored = await getBookContent(bookId)
    return stored !== null
  }

  const getStorageSummary = async () => {
    if (typeof indexedDB === 'undefined') {
      return emptyStorageSummary('IndexedDB is not available.')
    }

    try {
      const db = await openDB()
      const [content, source] = await Promise.all([
        summarizeStore(db, STORE_NAME),
        summarizeStore(db, PDF_SOURCE_STORE_NAME),
      ])

      return {
        available: true,
        contentCount: content.count,
        sourceCount: source.count,
        totalBytes: content.bytes + source.bytes,
        error: null,
      }
    } catch (error) {
      return emptyStorageSummary(error?.message || 'Could not inspect local storage.')
    }
  }

  return {
    saveBookContent,
    getBookContent,
    deleteBookContent,
    hasBookContent,
    savePdfSource,
    getStorageSummary,
  }
}
