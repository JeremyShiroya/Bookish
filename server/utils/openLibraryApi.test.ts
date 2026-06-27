import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchOpenLibrary } from './openLibraryApi'

describe('openLibraryApi', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not fetch detail URLs for suspicious Open Library keys', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.startsWith('https://openlibrary.org/search.json')) {
        return new Response(JSON.stringify({
          docs: [{
            key: '/works/../../admin',
            title: 'Suspicious Book',
            author_name: ['Example Author'],
            subject: ['Fiction'],
          }],
        }), { status: 200 })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    const results = await searchOpenLibrary('Suspicious Book', 'Example Author')

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      id: '/works/../../admin',
      title: 'Suspicious Book',
      blurb: null,
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
