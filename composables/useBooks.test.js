import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reconcileStatusProgress, useBooks } from '~/composables/useBooks'
import { getGoodreadsRating } from '~/composables/useGoodreadsRating'

const mockExists = vi.fn()
const mockCacheCoverImage = vi.fn()

vi.mock('~/composables/useDeviceAssets', () => ({
  assetsAvailable: () => true,
  useDeviceAssets: () => ({ exists: mockExists }),
}))

vi.mock('~/composables/useCoverImageCache', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useCoverImageCache: () => ({ cacheCoverImage: mockCacheCoverImage }),
  }
})

vi.mock('~/composables/useLibraryStore', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useLibraryStore: () => ({
      getBooks: async () => [],
      getCollections: async () => [],
      updateBook: async (book) => book,
    }),
  }
})

describe('useBooks', () => {
  it('should be resolvable', () => {
    expect(useBooks).toBeDefined()
  })

  it('parses Goodreads ratings from saved web reviews', () => {
    expect(getGoodreadsRating({ webReview: 'Goodreads Rating: 4.28/5 (based on 1,511,111 reviews).' })).toBe(4.28)
    expect(getGoodreadsRating({ webReview: 'Rating: 3.91/5' })).toBe(3.91)
    expect(getGoodreadsRating({ webReview: '' })).toBe(0)
  })
})

describe('cacheRemoteLibraryCovers', () => {
  const NEW_LOCAL_COVER = 'https://localhost/_capacitor_file_/data/user/0/app/files/covers/new123.jpg'
  const OLD_LOCAL_COVER = 'https://localhost/_capacitor_file_/data/user/0/app/files/covers/old999.jpg'
  const OLD_REMOTE_SOURCE = 'https://images.example.com/old-cover.jpg'

  beforeEach(() => {
    mockExists.mockReset()
    mockCacheCoverImage.mockReset()
    const { books, initialized } = useBooks()
    initialized.value = true
    books.value = []
  })

  // Regression: picking a new cover via web search left coverSource pointing at
  // the OLD remote URL, and the next app open re-cached that stale source and
  // reverted the cover. A cover whose file is really on disk must be kept —
  // coverSource is only a recovery pointer for missing files.
  it('keeps a device cover whose file exists even when coverSource still points at the old cover', async () => {
    mockExists.mockResolvedValue(true)
    mockCacheCoverImage.mockResolvedValue(OLD_LOCAL_COVER)

    const { books, cacheRemoteLibraryCovers } = useBooks()
    books.value = [{
      id: 'b1',
      title: 'Refactoring UI',
      cover: NEW_LOCAL_COVER,
      coverSource: OLD_REMOTE_SOURCE,
    }]

    await cacheRemoteLibraryCovers()

    expect(books.value[0].cover).toBe(NEW_LOCAL_COVER)
    expect(mockCacheCoverImage).not.toHaveBeenCalled()
  })

  it('keeps an already-cached data URL cover with a stale coverSource', async () => {
    mockCacheCoverImage.mockResolvedValue('data:image/jpeg;base64,OLD')

    const { books, cacheRemoteLibraryCovers } = useBooks()
    books.value = [{
      id: 'b2',
      title: 'Data URL Book',
      cover: 'data:image/jpeg;base64,NEW',
      coverSource: OLD_REMOTE_SOURCE,
    }]

    await cacheRemoteLibraryCovers()

    expect(books.value[0].cover).toBe('data:image/jpeg;base64,NEW')
    expect(mockCacheCoverImage).not.toHaveBeenCalled()
  })

  it('still heals a missing device cover file from its saved source', async () => {
    mockExists.mockResolvedValue(false)
    const healed = 'https://localhost/_capacitor_file_/data/user/0/app/files/covers/healed.jpg'
    mockCacheCoverImage.mockResolvedValue(healed)

    const { books, cacheRemoteLibraryCovers } = useBooks()
    books.value = [{
      id: 'b3',
      title: 'Missing File Book',
      cover: OLD_LOCAL_COVER,
      coverSource: OLD_REMOTE_SOURCE,
    }]

    await cacheRemoteLibraryCovers()

    expect(mockCacheCoverImage).toHaveBeenCalledWith(OLD_REMOTE_SOURCE)
    expect(books.value[0].cover).toBe(healed)
    expect(books.value[0].coverSource).toBe(OLD_REMOTE_SOURCE)
  })

  it('still downloads a live remote cover to the device', async () => {
    mockExists.mockResolvedValue(false)
    const cached = 'https://localhost/_capacitor_file_/data/user/0/app/files/covers/fresh.jpg'
    mockCacheCoverImage.mockResolvedValue(cached)

    const { books, cacheRemoteLibraryCovers } = useBooks()
    books.value = [{
      id: 'b4',
      title: 'Remote Cover Book',
      cover: 'https://images.example.com/fresh.jpg',
    }]

    await cacheRemoteLibraryCovers()

    expect(books.value[0].cover).toBe(cached)
    expect(books.value[0].coverSource).toBe('https://images.example.com/fresh.jpg')
  })
})

describe('reconcileStatusProgress', () => {
  it('clears the progress of a finished book that is marked unread again', () => {
    expect(reconcileStatusProgress('Unread', 100)).toBe(0)
  })

  it('completes a book marked as read', () => {
    expect(reconcileStatusProgress('Read', 12)).toBe(100)
  })

  it('keeps a book marked as reading short of the complete badge', () => {
    expect(reconcileStatusProgress('Reading', 100)).toBe(99)
    expect(reconcileStatusProgress('Reading', 40)).toBe(40)
  })

  it('clamps junk progress values', () => {
    expect(reconcileStatusProgress('Reading', -5)).toBe(0)
    expect(reconcileStatusProgress('Reading', undefined)).toBe(0)
  })
})
