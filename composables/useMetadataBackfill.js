import { reactive, readonly } from 'vue'
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
      // light: this is a bulk sweep over the whole library — skip the blind
      // publisher-site crawl, which costs ~15s a book for occasional extras.
      const results = await fetchBookMetadataResults(book.title, book.author || undefined, undefined, { light: true })
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

// ── Library-wide run that survives navigation ───────────────────────────────
//
// The Settings → Storage screen used to own this loop in component scope, so
// leaving the page took its progress state with it and the run appeared to
// stop. The run now lives at module scope: the page starts it and merely
// OBSERVES shared state, so navigating away (or coming back) neither cancels
// it nor loses the progress.

const backfillState = reactive({
  running: false,
  finished: false,
  current: 0,
  total: 0,
  currentTitle: '',
  updated: 0,
  failures: [],
})

let _stopRequested = false
let _runPromise = null

export const useLibraryBackfill = () => ({
  state: readonly(backfillState),
  start: startLibraryBackfill,
  stop: stopLibraryBackfill,
})

export function stopLibraryBackfill() {
  _stopRequested = true
}

export async function startLibraryBackfill({ books, updateBook, onDone } = {}) {
  // Already running — hand back the in-flight run so a second visit to the
  // page attaches to it instead of starting a competing sweep.
  if (backfillState.running) return _runPromise

  _stopRequested = false
  Object.assign(backfillState, {
    running: true,
    finished: false,
    current: 0,
    total: 0,
    currentTitle: '',
    updated: 0,
    failures: [],
  })

  _runPromise = (async () => {
    try {
      const result = await backfillLibraryMetadata({
        books,
        updateBook,
        shouldStop: () => _stopRequested,
        onProgress: ({ current, total, title }) => {
          backfillState.current = current
          backfillState.total = total
          backfillState.currentTitle = title
        },
      })
      backfillState.updated = result.updated
      backfillState.total = result.total
      backfillState.failures = result.failures
      backfillState.finished = true
      onDone?.({ ...result, stopped: _stopRequested })
      return result
    } finally {
      backfillState.running = false
      _runPromise = null
    }
  })()

  return _runPromise
}
