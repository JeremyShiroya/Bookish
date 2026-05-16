import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { useBookStorage } from './useBookStorage.js'

describe('useBookStorage', () => {
  const { saveBookContent, getBookContent, deleteBookContent, hasBookContent } = useBookStorage()

  it('saves and retrieves content by bookId', async () => {
    await saveBookContent(1, { content: '<p>Hello</p>', pages: 10 })
    const result = await getBookContent(1)
    expect(result).toEqual({ content: '<p>Hello</p>', pages: 10 })
  })

  it('returns null for unknown bookId', async () => {
    const result = await getBookContent(9999)
    expect(result).toBeNull()
  })

  it('overwrites existing entry on second save', async () => {
    await saveBookContent(2, { content: '<p>Old</p>', pages: 5 })
    await saveBookContent(2, { content: '<p>New</p>', pages: 8 })
    const result = await getBookContent(2)
    expect(result).toEqual({ content: '<p>New</p>', pages: 8 })
  })

  it('deleteBookContent removes the entry', async () => {
    await saveBookContent(3, { content: '<p>Gone</p>', pages: 1 })
    await deleteBookContent(3)
    expect(await getBookContent(3)).toBeNull()
  })

  it('hasBookContent returns true when stored', async () => {
    await saveBookContent(4, { content: '<p>X</p>', pages: 2 })
    expect(await hasBookContent(4)).toBe(true)
  })

  it('hasBookContent returns false when not stored', async () => {
    expect(await hasBookContent(9998)).toBe(false)
  })
})
