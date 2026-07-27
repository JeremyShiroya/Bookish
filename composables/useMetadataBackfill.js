import { reactive, readonly } from 'vue'
import { fetchBookMetadataResults } from '~/composables/useBookMetadataSearch'
import { mergeMetadataIntoBook } from '~/composables/useDeviceLibrarySync'

// Library-wide metadata backfill used by Settings → Storage. Walks every book
// that is missing details, fetches metadata, and fills ONLY empty fields.

// A book still needs its SERIES worked out when it has no series name and we
// have not yet looked. `seriesChecked` records that we asked the sources and
// they said "standalone" — without it, a genuine standalone would be re-queried
// forever, and (worse, before this) a book that IS in a series was never
// queried at all, because a missing series name was not treated as a gap. That
// is what forced the reader to set so many series by hand.
export function needsSeriesLookup(book) {
  return !String(book?.series ?? '').trim() && !book?.seriesChecked
}

// Every gap the details check looks for: an empty cover, author, blurb, genre,
// year, or Goodreads rating; a book's SERIES name if it hasn't been determined;
// and, once a series IS known, its installment number and total. Format ("book
// type") is set at import from the file itself, so it is never missing here.
export function missingMetadataFields(book) {
  if (!book?.title) return []
  const missing = []

  for (const field of ['author', 'blurb', 'genre']) {
    if (!String(book[field] ?? '').trim()) missing.push(field)
  }
  if (!book.publishYear) missing.push('publishYear')
  if (!book.cover || String(book.cover).startsWith('data:image/svg+xml')) missing.push('cover')
  // webReview carries the Goodreads star rating.
  if (!book.webReview || !(Number(book.webReview.rating) > 0)) missing.push('goodreadsRating')

  if (needsSeriesLookup(book)) {
    // The series NAME itself is unknown — go and find out whether this book
    // belongs to one.
    missing.push('series')
  } else if (String(book.series ?? '').trim()) {
    // The series is known; top up its installment and total.
    if (!book.seriesInstallment) missing.push('seriesInstallment')
    if (!(Number(book.seriesTotal) > 0)) missing.push('seriesTotal')
  }

  return missing
}

export function bookNeedsMetadata(book) {
  return missingMetadataFields(book).length > 0
}

const normalizeForMatch = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

export function metadataResultMatchesBook(book, result) {
  if (!result) return false
  const bookTitle = normalizeForMatch(book?.title)
  const resultTitle = normalizeForMatch(result.title)
  if (!bookTitle || !resultTitle) return false

  const titleMatches = bookTitle === resultTitle
    || bookTitle.includes(resultTitle)
    || resultTitle.includes(bookTitle)
  if (!titleMatches) return false

  const bookAuthor = normalizeForMatch(book?.author)
  const resultAuthor = normalizeForMatch(result.author)
  if (bookAuthor && resultAuthor) {
    return bookAuthor === resultAuthor
      || bookAuthor.includes(resultAuthor)
      || resultAuthor.includes(bookAuthor)
  }
  return true
}

export function bestMetadataResultForBook(book, results = []) {
  return (results || []).find((result) => metadataResultMatchesBook(book, result)) || null
}

export function markMetadataCheck(book, { now = Date.now(), lookedUp = true } = {}) {
  const record = { ...book }
  const missing = missingMetadataFields(record)
  if (!missing.length && lookedUp) {
    record.metaCompleteAt = now
    record.metaCheckedAt = now
  } else {
    delete record.metaCompleteAt
    record.metaCheckedAt = now
  }
  return record
}

export function friendlyMetadataFailure(error) {
  const message = String(error?.message || error || '').trim()
  if (/light is not defined|is not defined|referenceerror/i.test(message)) {
    return 'The metadata lookup hit an app error. Please update and try again.'
  }
  if (/failed with \d+|request failed|fetch failed|network|timeout|timed out/i.test(message)) {
    return 'The metadata sources could not be reached. Try again when the connection is steady.'
  }
  return 'Details are not available from the metadata sources yet.'
}

// Apply a fetched result to a book, filling only empty fields. When the book
// had no series and — after a genuine lookup — still has none, it is marked
// `seriesChecked` so a true standalone stops being re-queried. Returns
// { record, filled }: `record` is null when nothing at all changed.
export function applyMetadataResult(book, meta, { didLookup = true } = {}) {
  const hadNoSeries = !String(book?.series ?? '').trim()
  const merged = mergeMetadataIntoBook(book, meta)
  const stillNoSeries = !String((merged || book).series ?? '').trim()

  // Only conclude "standalone" when we actually asked and matched a result —
  // a lookup that found nothing at all must not silently mark the book.
  const resolveStandalone = didLookup && hadNoSeries && stillNoSeries && !book?.seriesChecked

  if (!merged && !resolveStandalone) return { record: null, filled: false }
  const record = { ...(merged || book) }
  if (resolveStandalone) record.seriesChecked = true
  return { record, filled: !!merged }
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
      const match = bestMetadataResultForBook(book, results)
      const { record, filled } = applyMetadataResult(book, match, { didLookup: !!match })
      if (record) {
        // A record with no fill is a standalone we just confirmed — persist the
        // seriesChecked mark, but it does not count as an update.
        await updateBook(markMetadataCheck(record))
        if (filled) updated += 1
      } else if (!results?.length) {
        failures.push({ id: book.id, title: book.title, reason: 'No matching details found yet' })
      } else {
        failures.push({ id: book.id, title: book.title, reason: 'Returned details did not match this book' })
      }
    } catch (error) {
      failures.push({ id: book.id, title: book.title, reason: friendlyMetadataFailure(error) })
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
