import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { useBookStorage } from './useBookStorage.js'
import { writeBookishSettings } from './useBookishSettings.js'
import { useLibraryBackup } from './useLibraryBackup.js'
import { useLibraryStore } from './useLibraryStore.js'
import { writeStoredTtsSession } from './useTTS.js'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  const store = new Map()
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  }
})

describe('useLibraryBackup', () => {
  it('exports, wipes, and imports the full local Bookish data set', async () => {
    const library = useLibraryStore()
    const storage = useBookStorage()
    const backup = useLibraryBackup()

    const book = await library.addBook({
      title: 'Portable Book',
      author: 'Bookish',
      progress: 42,
      status: 'Reading',
    })
    await library.addCollection({ name: 'Weekend', bookIds: [book.id] })
    await library.saveProfile({
      displayName: 'John',
      avatarType: 'image',
      avatarValue: '/Images/User%20Avatars/E-commerce-1.svg',
    })
    await storage.saveBookContent(book.id, {
      content: '<p>Hello</p>',
      pages: 5,
      source: new TextEncoder().encode('pdf bytes').buffer,
      format: 'pdf',
    })
    writeBookishSettings({ readerTheme: 'dark', libraryItemsPerPage: 50 })
    writeStoredTtsSession({
      bookId: book.id,
      chunkIdx: 7,
      totalChunks: 20,
      progress: 35,
      elapsedSeconds: 12,
      totalSeconds: 40,
      currentChunk: 'Hello',
    })

    const exported = await backup.exportBookishData()
    expect(exported.indexedDB['bookish-library'].books).toHaveLength(1)
    expect(exported.indexedDB['bookish-library'].collections).toHaveLength(1)
    expect(exported.indexedDB['bookish-library'].profiles).toHaveLength(1)
    expect(exported.indexedDB['bookish-storage']['book-content']).toHaveLength(1)
    expect(exported.indexedDB['bookish-storage']['book-pdf-source']).toHaveLength(1)

    await backup.wipeBookishData()
    expect(await library.getBooks()).toEqual([])
    expect(await library.getCollections()).toEqual([])
    expect(await library.getProfile()).toMatchObject({ displayName: 'Reader' })
    expect(await storage.getBookContent(book.id)).toBeNull()

    await backup.importBookishData(exported)
    const restoredBooks = await library.getBooks()
    const restoredCollections = await library.getCollections()
    const restoredProfile = await library.getProfile()
    const restoredContent = await storage.getBookContent(book.id)

    expect(restoredBooks[0]).toMatchObject({
      id: book.id,
      title: 'Portable Book',
      progress: 42,
    })
    expect(restoredCollections[0]).toMatchObject({ name: 'Weekend', bookIds: [book.id] })
    expect(restoredProfile).toMatchObject({
      displayName: 'John',
      avatarType: 'image',
      avatarValue: '/Images/User%20Avatars/E-commerce-1.svg',
    })
    expect(restoredContent.content).toBe('<p>Hello</p>')
    expect(restoredContent.source).toBeInstanceOf(ArrayBuffer)
    expect(new TextDecoder().decode(restoredContent.source)).toBe('pdf bytes')
  })
})
