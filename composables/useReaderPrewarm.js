import { useBookStorage } from '~/composables/useBookStorage'

const readerContentCache = new Map()

function normalizeId(bookId) {
  return String(bookId ?? '')
}

export function getPrewarmedReaderContent(bookId) {
  const key = normalizeId(bookId)
  return key ? readerContentCache.get(key) ?? null : null
}

export function clearPrewarmedReaderContent(bookId) {
  const key = normalizeId(bookId)
  if (key) readerContentCache.delete(key)
}

export function prewarmReaderContent(bookId) {
  const key = normalizeId(bookId)
  if (!key || !import.meta.client) return null

  const existing = readerContentCache.get(key)
  if (existing?.promise || existing?.content) return existing

  const { getBookContent } = useBookStorage()
  const entry = {
    content: null,
    error: null,
    promise: getBookContent(bookId)
      .then((content) => {
        entry.content = content
        return content
      })
      .catch((error) => {
        entry.error = error
        console.warn('[Reader] Could not prewarm content.', error)
        return null
      })
      .finally(() => {
        entry.promise = null
      }),
  }

  readerContentCache.set(key, entry)
  return entry
}
