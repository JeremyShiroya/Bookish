const DB_NAME = 'bookish-storage'
const STORE_NAME = 'book-content'
const DB_VERSION = 1

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = (e) => resolve(e.target.result)
    request.onerror = (e) => reject(e.target.error)
  })
}

export const useBookStorage = () => {
  const saveBookContent = async (bookId, { content, pages }) => {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put({ content, pages }, bookId)
      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject(e.target.error)
    })
  }

  const getBookContent = async (bookId) => {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(bookId)
      req.onsuccess = (e) => resolve(e.target.result ?? null)
      req.onerror = (e) => reject(e.target.error)
    })
  }

  const deleteBookContent = async (bookId) => {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(bookId)
      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject(e.target.error)
    })
  }

  const hasBookContent = async (bookId) => {
    const stored = await getBookContent(bookId)
    return stored !== null
  }

  return { saveBookContent, getBookContent, deleteBookContent, hasBookContent }
}
