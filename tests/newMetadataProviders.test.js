import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchHardcover } from '../server/utils/hardcoverApi'
import { searchWikidata } from '../server/utils/wikidataApi'
import { searchOpenAlex } from '../server/utils/openAlexApi'
import { searchLibraryOfCongress } from '../server/utils/libraryOfCongressApi'

describe('New Metadata Provider APIs', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('searchHardcover parses GraphQL responses into MetadataSource format', async () => {
    const mockBook = {
      id: '123',
      title: 'Dune',
      description: 'A masterpiece sci-fi novel',
      release_date: '1965-08-01',
      rating: 4.8,
      image: { url: 'https://example.com/dune.jpg' },
      contributions: [{ author: { name: 'Frank Herbert' } }],
      book_series: [{ position: 1, series: { name: 'Dune Chronicles', books_count: 6 } }],
      cached_tags: ['Sci-Fi', 'Classics'],
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { books: [mockBook] } }),
    })

    const results = await searchHardcover('Dune', 'Frank Herbert')
    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({
      id: 'hardcover:123',
      source: 'hardcover',
      title: 'Dune',
      author: 'Frank Herbert',
      cover: 'https://example.com/dune.jpg',
      blurb: 'A masterpiece sci-fi novel',
      series: 'Dune Chronicles',
      seriesInstallment: '1',
      seriesTotal: '6',
      genre: 'Sci-Fi, Classics',
      publishYear: 1965,
      publisher: null,
      webReview: '⭐ 4.8/5',
    })
  })

  it('searchWikidata resolves entity items correctly', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ search: [{ id: 'Q205775' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entities: {
            Q205775: {
              labels: { en: { value: 'The Hobbit' } },
              descriptions: { en: { value: 'Fantasy novel by J. R. R. Tolkien' } },
              claims: {
                P577: [{ mainsnak: { datavalue: { value: { time: '+1937-09-21T00:00:00Z' } } } }],
              },
            },
          },
        }),
      })

    const results = await searchWikidata('The Hobbit', 'J. R. R. Tolkien')
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('The Hobbit')
    expect(results[0].source).toBe('wikidata')
    expect(results[0].publishYear).toBe(1937)
  })

  it('searchOpenAlex parses academic work entries', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 'https://openalex.org/W12345',
            title: 'Quantum Mechanics',
            publication_year: 2020,
            authorships: [{ author: { display_name: 'Richard Feynman' } }],
            concepts: [{ display_name: 'Physics' }],
          },
        ],
      }),
    })

    const results = await searchOpenAlex('Quantum Mechanics')
    expect(results).toHaveLength(1)
    expect(results[0].source).toBe('openAlex')
    expect(results[0].title).toBe('Quantum Mechanics')
    expect(results[0].author).toBe('Richard Feynman')
    expect(results[0].publishYear).toBe(2020)
  })

  it('searchLibraryOfCongress parses catalog entries', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 'loc123',
            title: ['Moby Dick'],
            contributor: ['Herman Melville'],
            date: '1851',
            subject: ['Whales', 'Fiction'],
          },
        ],
      }),
    })

    const results = await searchLibraryOfCongress('Moby Dick', 'Herman Melville')
    expect(results).toHaveLength(1)
    expect(results[0].source).toBe('libraryOfCongress')
    expect(results[0].title).toBe('Moby Dick')
    expect(results[0].author).toBe('Herman Melville')
    expect(results[0].publishYear).toBe(1851)
  })
})
