const DB_NAME = 'bookish-library'
const DB_VERSION = 1

function openLibraryDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('books')) {
        db.createObjectStore('books', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('collections')) {
        db.createObjectStore('collections', { keyPath: 'id' })
      }
    }
    request.onsuccess = (e) => resolve(e.target.result)
    request.onerror = (e) => reject(e.target.error)
  })
}

export const useLibraryStore = () => {
  const getBooks = async () => {
    const db = await openLibraryDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('books', 'readonly')
      const req = tx.objectStore('books').getAll()
      req.onsuccess = (e) => resolve(e.target.result)
      req.onerror = (e) => reject(e.target.error)
    })
  }

  const addBook = async (bookData) => {
    const now = new Date().toISOString()
    const book = { ...bookData, id: crypto.randomUUID(), createdAt: now, updatedAt: now }
    const db = await openLibraryDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction('books', 'readwrite')
      tx.objectStore('books').put(book)
      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject(e.target.error)
      tx.onabort = (e) => reject(e.target.error ?? new DOMException('Transaction aborted'))
    })
    return book
  }

  const updateBook = async (book) => {
    const updated = { ...book, updatedAt: new Date().toISOString() }
    const db = await openLibraryDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction('books', 'readwrite')
      tx.objectStore('books').put(updated)
      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject(e.target.error)
      tx.onabort = (e) => reject(e.target.error ?? new DOMException('Transaction aborted'))
    })
    return updated
  }

  const deleteBook = async (id) => {
    const db = await openLibraryDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('books', 'readwrite')
      tx.objectStore('books').delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject(e.target.error)
      tx.onabort = (e) => reject(e.target.error ?? new DOMException('Transaction aborted'))
    })
  }

  const getCollections = async () => {
    const db = await openLibraryDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('collections', 'readonly')
      const req = tx.objectStore('collections').getAll()
      req.onsuccess = (e) => resolve(e.target.result)
      req.onerror = (e) => reject(e.target.error)
    })
  }

  const addCollection = async (collectionData) => {
    const now = new Date().toISOString()
    const collection = {
      ...collectionData,
      id: crypto.randomUUID(),
      bookIds: collectionData.bookIds || [],
      createdAt: now,
      updatedAt: now,
    }
    const db = await openLibraryDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction('collections', 'readwrite')
      tx.objectStore('collections').put(collection)
      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject(e.target.error)
      tx.onabort = (e) => reject(e.target.error ?? new DOMException('Transaction aborted'))
    })
    return collection
  }

  const updateCollection = async (collection) => {
    const updated = { ...collection, updatedAt: new Date().toISOString() }
    const db = await openLibraryDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction('collections', 'readwrite')
      tx.objectStore('collections').put(updated)
      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject(e.target.error)
      tx.onabort = (e) => reject(e.target.error ?? new DOMException('Transaction aborted'))
    })
    return updated
  }

  const addBookToCollection = async (collectionId, bookId) => {
    const db = await openLibraryDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('collections', 'readwrite')
      const store = tx.objectStore('collections')
      const req = store.get(collectionId)
      req.onsuccess = (e) => {
        const collection = e.target.result
        if (!collection) {
          reject(new Error(`Collection ${collectionId} not found`))
          tx.abort()
          return
        }
        if (!collection.bookIds.includes(bookId)) {
          collection.bookIds = [...collection.bookIds, bookId]
          collection.updatedAt = new Date().toISOString()
          store.put(collection)
        }
      }
      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject(e.target.error)
      tx.onabort = (e) => reject(e.target.error ?? new DOMException('Transaction aborted'))
    })
  }

  const updateAuthorImage = async (authorName, imageUrl) => {
    const db = await openLibraryDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction('books', 'readwrite')
      const store = tx.objectStore('books')
      const req = store.getAll()
      req.onsuccess = (e) => {
        const now = new Date().toISOString()
        for (const book of e.target.result) {
          if (book.author === authorName) {
            store.put({ ...book, authorImage: imageUrl, updatedAt: now })
          }
        }
      }
      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject(e.target.error)
      tx.onabort = (e) => reject(e.target.error ?? new DOMException('Transaction aborted'))
    })
  }

  return {
    getBooks,
    addBook,
    updateBook,
    deleteBook,
    getCollections,
    addCollection,
    updateCollection,
    addBookToCollection,
    updateAuthorImage,
  }
}
