export const LIBRARY_DB_NAME = 'bookish-library'
const DB_NAME = LIBRARY_DB_NAME
// v3 adds `annotations` (highlights and notes). Version bumps must only ever
// ADD stores here — existing ones hold the user's whole library.
const DB_VERSION = 3
export const PROFILE_ID = 'local'
export const DEFAULT_PROFILE = Object.freeze({
  id: PROFILE_ID,
  displayName: 'Reader',
  avatarType: 'image',
  avatarValue: '/Images/User%20Avatars/default-user.jpeg',
})

const PROFILE_AVATAR_TYPES = new Set(['preset', 'image'])
const USER_AVATAR_PATH_PREFIX = '/Images/User%20Avatars/'

// IndexedDB's structured clone cannot serialize Vue reactive proxies — passing
// one to `put()` throws DataCloneError ("#<Object> could not be cloned"), and a
// shallow spread doesn't help because nested arrays/objects stay reactive. Every
// write therefore goes through a deep plain-object snapshot first. Without this,
// edits and progress saves fail silently while the UI still reports success.
export function toPlainRecord(value) {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return value
  }
}

export function nextTimestamp(previousTimestamp) {
  const now = new Date()
  if (!previousTimestamp) return now.toISOString()

  const previous = Date.parse(previousTimestamp)
  if (!Number.isFinite(previous) || now.getTime() > previous) return now.toISOString()

  return new Date(previous + 1).toISOString()
}

// Exported so other stores (annotations) share this connection and its
// upgrade path instead of opening the same database with their own version.
export function openLibraryDB() {
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
      if (!db.objectStoreNames.contains('profiles')) {
        db.createObjectStore('profiles', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('annotations')) {
        const store = db.createObjectStore('annotations', { keyPath: 'id' })
        // Every read is "the annotations for this book", so index the book.
        store.createIndex('bookId', 'bookId', { unique: false })
      }
    }
    request.onsuccess = (e) => resolve(e.target.result)
    request.onerror = (e) => reject(e.target.error)
  })
}

export function normalizeProfile(profile, existing = null) {
  const source = profile && typeof profile === 'object' ? profile : {}
  const displayName = String(source.displayName ?? existing?.displayName ?? DEFAULT_PROFILE.displayName)
    .trim()
    .slice(0, 32)
  const avatarType = PROFILE_AVATAR_TYPES.has(source.avatarType)
    ? source.avatarType
    : existing?.avatarType || DEFAULT_PROFILE.avatarType
  const rawAvatarValue = String(source.avatarValue ?? existing?.avatarValue ?? DEFAULT_PROFILE.avatarValue)
    .trim()
    .slice(0, 50000)
  const avatarValue = rawAvatarValue.startsWith(USER_AVATAR_PATH_PREFIX)
    ? rawAvatarValue
    : DEFAULT_PROFILE.avatarValue

  return {
    ...DEFAULT_PROFILE,
    ...existing,
    id: PROFILE_ID,
    displayName: displayName || DEFAULT_PROFILE.displayName,
    avatarType: avatarType === 'preset' ? 'image' : avatarType,
    avatarValue: avatarValue || DEFAULT_PROFILE.avatarValue,
  }
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
    const updated = toPlainRecord({ ...book, updatedAt: nextTimestamp(book.updatedAt) })
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
          updatedAt: nextTimestamp(existing.updatedAt),
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

  const getProfile = async () => {
    const db = await openLibraryDB()
    const profile = await new Promise((resolve, reject) => {
      const tx = db.transaction('profiles', 'readonly')
      const req = tx.objectStore('profiles').get(PROFILE_ID)
      req.onsuccess = (e) => resolve(e.target.result ?? null)
      req.onerror = (e) => reject(e.target.error)
    })

    return normalizeProfile(profile)
  }

  const saveProfile = async (profileData) => {
    const db = await openLibraryDB()
    const now = new Date().toISOString()
    const updated = await new Promise((resolve, reject) => {
      const tx = db.transaction('profiles', 'readwrite')
      const store = tx.objectStore('profiles')
      const req = store.get(PROFILE_ID)
      let profile = null

      req.onsuccess = (event) => {
        const existing = event.target.result ?? null
        profile = toPlainRecord({
          ...normalizeProfile(profileData, existing),
          createdAt: existing?.createdAt || now,
          updatedAt: nextTimestamp(existing?.updatedAt),
        })
        store.put(profile)
      }

      tx.oncomplete = () => resolve(profile)
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
          collection.updatedAt = nextTimestamp(collection.updatedAt)
          store.put(collection)
        }
      }
      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject(e.target.error)
      tx.onabort = (e) => reject(e.target.error ?? new DOMException('Transaction aborted'))
    })
  }

  const removeBookFromCollection = async (collectionId, bookId) => {
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
        if (collection.bookIds.some((id) => String(id) === String(bookId))) {
          collection.bookIds = collection.bookIds.filter((id) => String(id) !== String(bookId))
          collection.updatedAt = nextTimestamp(collection.updatedAt)
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
              store.put({ ...book, authorImage: imageUrl, updatedAt: nextTimestamp(book.updatedAt || now) })
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
              if (details.bio !== undefined) patch.authorBio = details.bio
              if (details.birthDate !== undefined) patch.authorBirthDate = details.birthDate
              if (details.deathDate !== undefined) patch.authorDeathDate = details.deathDate
              if (details.nationality !== undefined) patch.authorNationality = details.nationality
              if (details.notableWorks !== undefined) patch.authorNotableWorks = details.notableWorks
              if (details.validatedBooksCount !== undefined) {
                patch.authorValidatedBooksCount = details.validatedBooksCount
              }
              if (details.validatedSeriesCount !== undefined) {
                patch.authorValidatedSeriesCount = details.validatedSeriesCount
              }
              if (details.latestWork !== undefined) patch.authorLatestWork = details.latestWork
              if (details.spouseName !== undefined) patch.authorSpouseName = details.spouseName
              if (details.hasChildren !== undefined) patch.authorHasChildren = details.hasChildren
              if (details.childrenCount !== undefined) patch.authorChildrenCount = details.childrenCount
              if (details.version !== undefined) patch.authorDetailsVersion = details.version
              store.put({ ...book, ...patch, updatedAt: nextTimestamp(book.updatedAt || now) })
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
    removeBookFromCollection,
    getProfile,
    saveProfile,
    updateAuthorImage,
    updateAuthorDetails,
  }
}
