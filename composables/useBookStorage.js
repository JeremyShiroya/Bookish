const DB_NAME = 'bookish-storage'
const STORE_NAME = 'book-content'
const PDF_SOURCE_STORE_NAME = 'book-pdf-source'
const DB_VERSION = 2

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
  if (source === null || source === undefined) return source
  if (source instanceof ArrayBuffer) return source.slice(0)
  if (ArrayBuffer.isView(source)) {
    return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength)
  }
  return source
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
  const savePdfSource = async (bookId, source) => {
    if (source === undefined) return

    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PDF_SOURCE_STORE_NAME, 'readwrite')
      const store = tx.objectStore(PDF_SOURCE_STORE_NAME)

      if (source === null) {
        store.delete(bookId)
      } else {
        store.put(normalizeSourceForStorage(source), bookId)
      }

      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject(e.target.error)
      tx.onabort = (e) => reject(e.target.error ?? new DOMException('Transaction aborted'))
    })
  }

  const saveBookContent = async (bookId, { content, pages, tocTitles, source, tocItems, format, pdfTocChecked }) => {
    if (source !== undefined) {
      await savePdfSource(bookId, source)
    }

    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const record = { content, pages }
      if (tocTitles !== undefined) record.tocTitles = tocTitles ?? null
      if (tocItems !== undefined) record.tocItems = tocItems ?? null
      if (format !== undefined) record.format = format ?? null
      if (pdfTocChecked !== undefined) record.pdfTocChecked = !!pdfTocChecked
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

    if (!content && !source) return null

    const result = { ...(content ?? { content: null, pages: 0 }) }
    const resolvedSource = source ?? content?.source ?? null
    if (resolvedSource !== null) result.source = resolvedSource
    return result
  }

  const deleteBookContent = async (bookId) => {
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
