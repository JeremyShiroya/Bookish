import { fetchBookMetadataResults } from '~/composables/useBookMetadataSearch'
import { mergeMetadataIntoBook } from '~/composables/useDeviceLibrarySync'

// Library-wide metadata backfill used by Settings → Storage. Walks every book
// that is missing details, fetches metadata, and fills ONLY empty fields.

export function bookNeedsMetadata(book) {
  if (!book?.title) return false
  const missingText = ['blurb', 'genre', 'author'].some((field) => !String(book[field] ?? '').trim())
  const missingYear = !book.publishYear
  const placeholderCover = !book.cover || String(book.cover).startsWith('data:image/svg+xml')
  return missingText || missingYear || placeholderCover
}

export async function backfillLibraryMetadata({ books, updateBook, onProgress, shouldStop } = {}) {
  const targets = (books || []).filter(bookNeedsMetadata)
  const failures = []
  let updated = 0

  for (let index = 0; index < targets.length; index += 1) {
    if (shouldStop?.()) break
    const book = targets[index]
    onProgress?.({ current: index + 1, total: targets.length, title: book.title })

    try {
      const results = await fetchBookMetadataResults(book.title, book.author || undefined, undefined, {})
      const merged = mergeMetadataIntoBook(book, results?.[0])
      if (merged) {
        await updateBook(merged)
        updated += 1
      } else if (!results?.length) {
        failures.push({ id: book.id, title: book.title, reason: 'No metadata results found' })
      } else {
        failures.push({ id: book.id, title: book.title, reason: 'Results had no new details to add' })
      }
    } catch (error) {
      failures.push({ id: book.id, title: book.title, reason: error?.message || 'Lookup failed' })
    }
  }

  return { total: targets.length, updated, failures }
}
