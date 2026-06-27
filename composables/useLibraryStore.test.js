import { IDBFactory } from 'fake-indexeddb'
import { describe, it, expect, beforeEach } from 'vitest'
import { useLibraryStore } from './useLibraryStore.js'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

describe('useLibraryStore — books', () => {
  it('returns an empty array when no books exist', async () => {
    const { getBooks } = useLibraryStore()
    expect(await getBooks()).toEqual([])
  })

  it('adds a book and retrieves it', async () => {
    const { addBook, getBooks } = useLibraryStore()
    const book = await addBook({ title: 'Dune', author: 'Frank Herbert' })
    expect(book.id).toBeTruthy()
    expect(book.title).toBe('Dune')
    expect(book.createdAt).toBeTruthy()
    expect(book.updatedAt).toBeTruthy()
    const books = await getBooks()
    expect(books).toHaveLength(1)
    expect(books[0].title).toBe('Dune')
  })

  it('updates a book', async () => {
    const { addBook, updateBook, getBooks } = useLibraryStore()
    const book = await addBook({ title: 'Old Title', author: 'Author' })
    const updated = await updateBook({ ...book, title: 'New Title' })
    expect(updated.title).toBe('New Title')
    expect(updated.updatedAt).not.toBe(book.updatedAt)
    const books = await getBooks()
    expect(books[0].title).toBe('New Title')
  })

  it('deletes a book', async () => {
    const { addBook, deleteBook, getBooks } = useLibraryStore()
    const book = await addBook({ title: 'Delete Me', author: 'Author' })
    await deleteBook(book.id)
    expect(await getBooks()).toHaveLength(0)
  })

  it('updateAuthorImage sets authorImage on all books by that author', async () => {
    const { addBook, updateAuthorImage, getBooks } = useLibraryStore()
    await addBook({ title: 'Book A', author: 'J.K. Rowling', authorImage: null })
    await addBook({ title: 'Book B', author: 'J.K. Rowling', authorImage: null })
    await addBook({ title: 'Other', author: 'Stephen King', authorImage: null })
    await updateAuthorImage('J.K. Rowling', 'https://example.com/jkr.jpg')
    const books = await getBooks()
    const jkrBooks = books.filter(b => b.author === 'J.K. Rowling')
    const otherBooks = books.filter(b => b.author === 'Stephen King')
    expect(jkrBooks.every(b => b.authorImage === 'https://example.com/jkr.jpg')).toBe(true)
    expect(otherBooks[0].authorImage).toBeNull()
  })

  it('updateAuthorDetails can clear stale author profile fields', async () => {
    const { addBook, updateAuthorDetails, getBooks } = useLibraryStore()
    await addBook({
      title: 'The Shining',
      author: 'Stephen King',
      authorBio: 'Wrong cached biography',
      authorNationality: 'Wrong place',
      authorNotableWorks: ['Wrong book'],
      authorLatestWork: 'Wrong latest work',
      authorDetailsVersion: 3,
    })

    await updateAuthorDetails('Stephen King', {
      bio: null,
      birthDate: null,
      deathDate: null,
      nationality: null,
      notableWorks: [],
      validatedBooksCount: null,
      validatedSeriesCount: null,
      latestWork: null,
      spouseName: null,
      hasChildren: null,
      childrenCount: null,
      source: 'none',
      version: 6,
      aiRejected: true,
    })

    const [book] = await getBooks()
    expect(book.authorBio).toBeNull()
    expect(book.authorNationality).toBeNull()
    expect(book.authorNotableWorks).toEqual([])
    expect(book.authorLatestWork).toBeNull()
    expect(book.authorDetailsVersion).toBe(6)
  })
})

describe('useLibraryStore — collections', () => {
  it('returns an empty array when no collections exist', async () => {
    const { getCollections } = useLibraryStore()
    expect(await getCollections()).toEqual([])
  })

  it('adds a collection with empty bookIds by default', async () => {
    const { addCollection, getCollections } = useLibraryStore()
    const col = await addCollection({ name: 'My Favs', description: 'Top picks' })
    expect(col.id).toBeTruthy()
    expect(col.name).toBe('My Favs')
    expect(col.bookIds).toEqual([])
    expect(await getCollections()).toHaveLength(1)
  })

  it('addBookToCollection appends a bookId', async () => {
    const { addCollection, addBookToCollection, getCollections } = useLibraryStore()
    const col = await addCollection({ name: 'Shelf' })
    await addBookToCollection(col.id, 'book-uuid-1')
    await addBookToCollection(col.id, 'book-uuid-2')
    const collections = await getCollections()
    expect(collections[0].bookIds).toEqual(['book-uuid-1', 'book-uuid-2'])
  })

  it('addBookToCollection does not duplicate bookIds', async () => {
    const { addCollection, addBookToCollection, getCollections } = useLibraryStore()
    const col = await addCollection({ name: 'No Dupes' })
    await addBookToCollection(col.id, 'book-uuid-1')
    await addBookToCollection(col.id, 'book-uuid-1')
    const collections = await getCollections()
    expect(collections[0].bookIds).toHaveLength(1)
  })

  it('updateCollection saves changes', async () => {
    const { addCollection, updateCollection, getCollections } = useLibraryStore()
    const col = await addCollection({
      name: 'Original',
      description: 'Keep this data',
      bookIds: ['book-1'],
    })
    await updateCollection({ ...col, name: 'Updated' })
    const collections = await getCollections()
    expect(collections[0].name).toBe('Updated')
    expect(collections[0].bookIds).toEqual(['book-1'])
    expect(collections[0].description).toBe('Keep this data')
  })

  it('deleteCollection removes only the selected collection', async () => {
    const { addCollection, deleteCollection, getCollections } = useLibraryStore()
    const keep = await addCollection({ name: 'Keep' })
    const remove = await addCollection({ name: 'Remove' })

    await deleteCollection(remove.id)

    const collections = await getCollections()
    expect(collections).toHaveLength(1)
    expect(collections[0].id).toBe(keep.id)
  })
})
