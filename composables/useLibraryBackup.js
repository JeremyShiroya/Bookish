import { BOOKISH_SETTINGS_KEY, readBookishSettings, writeBookishSettings } from '~/composables/useBookishSettings'
import { BOOKISH_TTS_SESSION_KEY, readStoredTtsSession, writeStoredTtsSession } from '~/composables/useTTS'

const BACKUP_VERSION = 1
const LIBRARY_DB_NAME = 'bookish-library'
const LIBRARY_DB_VERSION = 2
const STORAGE_DB_NAME = 'bookish-storage'
const STORAGE_DB_VERSION = 2

const LIBRARY_STORES = ['books', 'collections', 'profiles']
const STORAGE_STORES = ['book-content', 'book-pdf-source']

function openBookishDB(name, version) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version)
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (name === LIBRARY_DB_NAME) {
        if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('collections')) db.createObjectStore('collections', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles', { keyPath: 'id' })
      }
      if (name === STORAGE_DB_NAME) {
        if (!db.objectStoreNames.contains('book-content')) db.createObjectStore('book-content')
        if (!db.objectStoreNames.contains('book-pdf-source')) db.createObjectStore('book-pdf-source')
      }
    }
    request.onsuccess = (event) => resolve(event.target.result)
    request.onerror = (event) => reject(event.target.error)
  })
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = (event) => reject(event.target.error)
    tx.onabort = (event) => reject(event.target.error ?? new DOMException('Transaction aborted'))
  })
}

function bytesToBase64(bytes) {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function base64ToBytes(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function serializeValue(value) {
  if (value === null || value === undefined) return value
  if (value instanceof ArrayBuffer) {
    return { __bookishType: 'ArrayBuffer', data: bytesToBase64(new Uint8Array(value)) }
  }
  if (ArrayBuffer.isView(value)) {
    return {
      __bookishType: 'TypedArray',
      name: value.constructor.name,
      data: bytesToBase64(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)),
    }
  }
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return {
      __bookishType: 'Blob',
      mimeType: value.type || '',
      data: bytesToBase64(new Uint8Array(await value.arrayBuffer())),
    }
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map(item => serializeValue(item)))
  }
  if (typeof value === 'object') {
    const entries = await Promise.all(
      Object.entries(value).map(async ([key, item]) => [key, await serializeValue(item)])
    )
    return Object.fromEntries(entries)
  }
  return value
}

function deserializeValue(value) {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map(item => deserializeValue(item))
  if (typeof value !== 'object') return value

  if (value.__bookishType === 'ArrayBuffer') {
    return base64ToBytes(value.data || '').buffer
  }
  if (value.__bookishType === 'TypedArray') {
    const bytes = base64ToBytes(value.data || '')
    if (value.name === 'Uint8Array') return bytes
    return bytes.buffer
  }
  if (value.__bookishType === 'Blob') {
    return new Blob([base64ToBytes(value.data || '')], { type: value.mimeType || '' })
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, deserializeValue(item)])
  )
}

async function readAllRecords(db, storeNames) {
  const result = {}
  for (const storeName of storeNames) {
    if (!db.objectStoreNames.contains(storeName)) {
      result[storeName] = []
      continue
    }

    const { keys, values } = await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const keysRequest = store.getAllKeys()
      const valuesRequest = store.getAll()

      tx.oncomplete = () => resolve({
        keys: keysRequest.result || [],
        values: valuesRequest.result || [],
      })
      tx.onerror = (event) => reject(event.target.error)
      tx.onabort = (event) => reject(event.target.error ?? new DOMException('Transaction aborted'))
    })

    result[storeName] = await Promise.all(
      values.map(async (value, index) => ({
        key: await serializeValue(keys[index]),
        value: await serializeValue(value),
      }))
    )
  }
  return result
}

async function replaceStores(db, recordsByStore, storeNames) {
  const existingStores = storeNames.filter(storeName => db.objectStoreNames.contains(storeName))
  if (!existingStores.length) return

  const tx = db.transaction(existingStores, 'readwrite')
  for (const storeName of existingStores) {
    const store = tx.objectStore(storeName)
    store.clear()
    for (const record of recordsByStore[storeName] || []) {
      const value = deserializeValue(record.value)
      const key = deserializeValue(record.key)
      if (store.keyPath) store.put(value)
      else store.put(value, key)
    }
  }
  await transactionDone(tx)
}

async function clearStores(db, storeNames) {
  const existingStores = storeNames.filter(storeName => db.objectStoreNames.contains(storeName))
  if (!existingStores.length) return

  const tx = db.transaction(existingStores, 'readwrite')
  for (const storeName of existingStores) {
    tx.objectStore(storeName).clear()
  }
  await transactionDone(tx)
}

function normalizeBackup(input) {
  const backup = typeof input === 'string' ? JSON.parse(input) : input
  if (!backup || backup.app !== 'Bookish' || backup.version !== BACKUP_VERSION) {
    throw new Error('This is not a compatible Bookish backup file.')
  }
  return backup
}

export const useLibraryBackup = () => {
  const exportBookishData = async () => {
    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB is not available in this browser.')
    }

    const libraryDb = await openBookishDB(LIBRARY_DB_NAME, LIBRARY_DB_VERSION)
    const storageDb = await openBookishDB(STORAGE_DB_NAME, STORAGE_DB_VERSION)

    const [library, storage] = await Promise.all([
      readAllRecords(libraryDb, LIBRARY_STORES),
      readAllRecords(storageDb, STORAGE_STORES),
    ])

    return {
      app: 'Bookish',
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      settings: readBookishSettings(),
      ttsSession: readStoredTtsSession(),
      indexedDB: {
        [LIBRARY_DB_NAME]: library,
        [STORAGE_DB_NAME]: storage,
      },
    }
  }

  const importBookishData = async (backupInput) => {
    const backup = normalizeBackup(backupInput)
    const libraryDb = await openBookishDB(LIBRARY_DB_NAME, LIBRARY_DB_VERSION)
    const storageDb = await openBookishDB(STORAGE_DB_NAME, STORAGE_DB_VERSION)

    await replaceStores(libraryDb, backup.indexedDB?.[LIBRARY_DB_NAME] || {}, LIBRARY_STORES)
    await replaceStores(storageDb, backup.indexedDB?.[STORAGE_DB_NAME] || {}, STORAGE_STORES)
    writeBookishSettings(backup.settings || {})

    if (backup.ttsSession) writeStoredTtsSession(backup.ttsSession)
    else if (typeof localStorage !== 'undefined') localStorage.removeItem(BOOKISH_TTS_SESSION_KEY)
  }

  const wipeBookishData = async () => {
    const libraryDb = await openBookishDB(LIBRARY_DB_NAME, LIBRARY_DB_VERSION)
    const storageDb = await openBookishDB(STORAGE_DB_NAME, STORAGE_DB_VERSION)

    await Promise.all([
      clearStores(libraryDb, LIBRARY_STORES),
      clearStores(storageDb, STORAGE_STORES),
    ])

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(BOOKISH_SETTINGS_KEY)
      localStorage.removeItem(BOOKISH_TTS_SESSION_KEY)
    }
  }

  const createDownload = async () => {
    const backup = await exportBookishData()
    const json = JSON.stringify(backup, null, 2)
    const stamp = new Date().toISOString().slice(0, 10)
    return {
      filename: `bookish-backup-${stamp}.json`,
      url: URL.createObjectURL(new Blob([json], { type: 'application/json' })),
      summary: {
        books: backup.indexedDB[LIBRARY_DB_NAME].books.length,
        collections: backup.indexedDB[LIBRARY_DB_NAME].collections.length,
        profiles: backup.indexedDB[LIBRARY_DB_NAME].profiles.length,
        contentRecords: backup.indexedDB[STORAGE_DB_NAME]['book-content'].length,
        sourceRecords: backup.indexedDB[STORAGE_DB_NAME]['book-pdf-source'].length,
      },
    }
  }

  return {
    exportBookishData,
    importBookishData,
    wipeBookishData,
    createDownload,
  }
}
