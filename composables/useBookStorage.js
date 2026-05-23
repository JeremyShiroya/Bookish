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

  return { saveBookContent, getBookContent, deleteBookContent, hasBookContent, savePdfSource }
}
