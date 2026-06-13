const DB_NAME = 'bookish-library'
const DB_VERSION = 1

// IndexedDB's structured clone cannot serialize Vue reactive proxies — passing
// one to `put()` throws DataCloneError ("#<Object> could not be cloned"), and a
// shallow spread doesn't help because nested arrays/objects stay reactive. Every
// write therefore goes through a deep plain-object snapshot first. Without this,
// edits and progress saves fail silently while the UI still reports success.
function toPlainRecord(value) {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return value
  }
}

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
    const book = toPlainRecord({ ...bookData, id: crypto.randomUUID(), createdAt: now, updatedAt: now })
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
    const updated = toPlainRecord({ ...book, updatedAt: new Date().toISOString() })
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
    const collection = toPlainRecord({
      ...collectionData,
      id: crypto.randomUUID(),
      bookIds: collectionData.bookIds || [],
      createdAt: now,
      updatedAt: now,
    })
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
    const db = await openLibraryDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('collections', 'readwrite')
      const store = tx.objectStore('collections')
      const request = store.get(collection.id)
      let updated = null
      request.onsuccess = (event) => {
        const existing = event.target.result
        if (!existing) {
          reject(new Error(`Collection ${collection.id} not found`))
          tx.abort()
          return
        }
        updated = {
          ...existing,
          name: String(collection.name || '').trim(),
          updatedAt: new Date().toISOString(),
        }
        store.put(updated)
      }
      tx.oncomplete = () => resolve(updated)
      tx.onerror = (e) => reject(e.target.error)
      tx.onabort = (e) => reject(e.target.error ?? new DOMException('Transaction aborted'))
    })
  }

  const deleteCollection = async (id) => {
    const db = await openLibraryDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('collections', 'readwrite')
      tx.objectStore('collections').delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject(e.target.error)
      tx.onabort = (e) => reject(e.target.error ?? new DOMException('Transaction aborted'))
    })
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
        try {
          const now = new Date().toISOString()
          for (const book of e.target.result) {
            if (book.author === authorName) {
              store.put({ ...book, authorImage: imageUrl, updatedAt: now })
            }
          }
        } catch (err) {
          tx.abort()
          reject(err)
        }
      }
      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject(e.target.error)
      tx.onabort = (e) => reject(e.target.error ?? new DOMException('Transaction aborted'))
    })
  }

  const updateAuthorDetails = async (authorName, details) => {
    const db = await openLibraryDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction('books', 'readwrite')
      const store = tx.objectStore('books')
      const req = store.getAll()
      req.onsuccess = (e) => {
        try {
          const now = new Date().toISOString()
          for (const book of e.target.result) {
            if (book.author === authorName) {
              const patch = {}
              if (details.bio) patch.authorBio = details.bio
              if (details.birthDate !== undefined) patch.authorBirthDate = details.birthDate
              if (details.deathDate !== undefined) patch.authorDeathDate = details.deathDate
              if (details.nationality) patch.authorNationality = details.nationality
              if (details.notableWorks?.length) patch.authorNotableWorks = details.notableWorks
              if (details.booksCount) patch.authorBooksCount = details.booksCount
              if (details.latestWork) patch.authorLatestWork = details.latestWork
              if (details.spouseName !== undefined) patch.authorSpouseName = details.spouseName
              if (details.hasChildren !== undefined) patch.authorHasChildren = details.hasChildren
              if (details.childrenCount !== undefined) patch.authorChildrenCount = details.childrenCount
              store.put({ ...book, ...patch, updatedAt: now })
            }
          }
        } catch (err) {
          tx.abort()
          reject(err)
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
    deleteCollection,
    addBookToCollection,
    updateAuthorImage,
    updateAuthorDetails,
  }
}
