import { describe, expect, test } from 'vitest'
import { searchLibrary, normalizeSearchText, matchQuality } from './useLibrarySearch.js'

const dune = { id: 1, title: 'Dune', author: 'Frank Herbert', series: 'Dune', genre: 'Sci-Fi' }
const emma = { id: 2, title: 'Emma', author: 'Jane Austen', genre: 'Drama' }
const villette = { id: 3, title: 'Villette', author: 'Charlotte Brontë' }
const dracula = { id: 4, title: 'Dracula', author: 'Bram Stoker', genre: 'Horror' }

const library = [emma, villette, dracula, dune]

describe('library search', () => {
  test('an empty query returns nothing', () => {
    expect(searchLibrary(library, '')).toEqual([])
    expect(searchLibrary(library, '   ')).toEqual([])
  })

  test('a single letter already ranks title matches first', () => {
    const results = searchLibrary(library, 'd')
    // "Dracula" and "Dune" start with the letter; "Drama" is only Emma's genre.
    expect(results.slice(0, 2).map((book) => book.title)).toEqual(['Dracula', 'Dune'])
    expect(results.map((book) => book.title)).toContain('Emma')
  })

  test('an exact title outranks a title that merely contains the query', () => {
    const results = searchLibrary([dracula, dune], 'dune')
    expect(results[0]).toBe(dune)
  })

  test('a title match outranks an author match', () => {
    const results = searchLibrary([{ title: 'Herbert Rides', author: 'X' }, dune], 'herbert')
    expect(results[0].title).toBe('Herbert Rides')
    expect(results[1]).toBe(dune)
  })

  test('matches ignore case and accents', () => {
    expect(searchLibrary(library, 'BRONTE')).toEqual([villette])
    expect(normalizeSearchText('Brontë')).toBe('bronte')
  })

  test('word-boundary matches outrank mid-word matches', () => {
    expect(matchQuality('Frank Herbert', 'herbert')).toBeGreaterThan(matchQuality('Frank Herbert', 'erbert'))
  })

  test('results are capped', () => {
    const many = Array.from({ length: 20 }, (_, index) => ({ id: index, title: `Alpha ${index}` }))
    expect(searchLibrary(many, 'alpha')).toHaveLength(8)
    expect(searchLibrary(many, 'alpha', 3)).toHaveLength(3)
  })

  test('books missing fields never throw', () => {
    expect(searchLibrary([{ id: 9 }], 'a')).toEqual([])
    expect(searchLibrary(undefined, 'a')).toEqual([])
  })
})
