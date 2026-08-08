import { reactive, readonly } from 'vue'
import { fetchBookMetadataResults } from '~/composables/useBookMetadataSearch'
import { mergeMetadataIntoBook } from '~/composables/useDeviceLibrarySync'
import { reconcileAndRepairBookSeries } from '~/composables/useSeriesRepair'

// Library-wide metadata backfill & Series Reconciliation used by Settings → Storage.

export function needsSeriesLookup(book) {
  return !String(book?.series ?? '').trim() && !book?.seriesChecked
}

export function missingMetadataFields(book) {
  if (!book?.title) return []
  const missing = []

  for (const field of ['author', 'blurb', 'genre']) {
    if (!String(book[field] ?? '').trim()) missing.push(field)
  }
  if (!book.publishYear) missing.push('publishYear')
  if (!book.cover || String(book.cover).startsWith('data:image/svg+xml')) missing.push('cover')
  if (!book.webReview || !(Number(book.webReview.rating) > 0)) missing.push('goodreadsRating')

  if (needsSeriesLookup(book)) {
    missing.push('series')
  } else if (String(book.series ?? '').trim()) {
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

export function applyMetadataResult(book, meta, { didLookup = true, isLightPass = false } = {}) {
  const hadNoSeries = !String(book?.series ?? '').trim()
  const merged = mergeMetadataIntoBook(book, meta)
  const stillNoSeries = !String((merged || book).series ?? '').trim()

  const hasMultiSourceVerification = !meta?.primarySource && !Array.isArray(meta?.sourceTags)
    ? true
    : (Array.isArray(meta?.sourceTags)
      ? meta.sourceTags.some((tag) => ['goodreads', 'hardcover', 'kobo', 'wikidata'].includes(tag))
      : Boolean(meta?.primarySource && ['goodreads', 'hardcover', 'kobo', 'wikidata'].includes(meta.primarySource)))

  const resolveStandalone = didLookup && !isLightPass && hadNoSeries && stillNoSeries && !book?.seriesChecked && !!meta?.title && hasMultiSourceVerification

  if (!merged && !resolveStandalone) return { record: null, filled: false }
  const record = { ...(merged || book) }
  if (resolveStandalone) record.seriesChecked = true
  return { record, filled: !!merged }
}

export async function unmarkFalseStandalones(books, updateBook) {
  const falseStandalones = (books || []).filter((book) => !String(book?.series ?? '').trim())
  for (const book of falseStandalones) {
    await updateBook({ ...book, seriesChecked: false, metaCheckedAt: 0 })
  }
}

/**
 * Two-Pass Sweep:
 * Pass 1: Missing metadata empty-field backfill
 * Pass 2: Full-library Series Reconciliation & Safe Repair Pass
 */
export async function backfillLibraryMetadata({ books, updateBook, onProgress, shouldStop, searchFn } = {}) {
  const allBooks = Array.isArray(books) ? books : []
  const failures = []
  const diagnostics = []

  let updated = 0
  let repairedCount = 0
  let protectedCount = 0
  let lowConfidenceCount = 0
  let unchangedCount = 0

  const totalSteps = allBooks.length
  const fetcher = searchFn || fetchBookMetadataResults

  for (let index = 0; index < allBooks.length; index += 1) {
    if (shouldStop?.()) break
    const book = allBooks[index]
    onProgress?.({ current: index + 1, total: totalSteps, title: book.title })

    try {
      // Step 1: Missing non-series metadata pass (cover, blurb, genre, publishYear)
      const results = await fetcher(book.title, book.author || undefined, undefined, { light: true })
      const match = bestMetadataResultForBook(book, results)
      const { record: backfilledRecord, filled } = applyMetadataResult(book, match, { didLookup: !!match, isLightPass: true })
      
      if (filled) updated += 1

      // Step 2: Series Reconciliation & Repair Pass against original book state
      const repairResult = reconcileAndRepairBookSeries(book, results || [])
      
      const diagEntry = {
        bookId: book.id,
        title: book.title,
        previousState: repairResult.previousState,
        proposedState: repairResult.proposedState,
        confidence: repairResult.confidence,
        evidenceSources: repairResult.evidenceSources,
        decision: repairResult.decision,
        reason: repairResult.reason,
      }
      diagnostics.push(diagEntry)

      if (repairResult.decision === 'PROTECTED') {
        protectedCount += 1
        if (backfilledRecord) {
          await updateBook(markMetadataCheck(backfilledRecord))
        }
      } else if (repairResult.decision === 'LOW_CONFIDENCE') {
        lowConfidenceCount += 1
        if (backfilledRecord) {
          await updateBook(markMetadataCheck(backfilledRecord))
        }
      } else if (repairResult.decision === 'UNCHANGED') {
        unchangedCount += 1
        if (backfilledRecord) {
          await updateBook(markMetadataCheck(backfilledRecord))
        }
      } else if (repairResult.decision === 'REPAIRED') {
        repairedCount += 1
        const combinedRecord = backfilledRecord
          ? {
              ...backfilledRecord,
              series: repairResult.record.series,
              seriesInstallment: repairResult.record.seriesInstallment,
              seriesTotal: repairResult.record.seriesTotal,
              seriesChecked: true,
            }
          : repairResult.record
        await updateBook(markMetadataCheck(combinedRecord))
      }
    } catch (error) {
      failures.push({ id: book.id, title: book.title, reason: friendlyMetadataFailure(error) })
      diagnostics.push({
        bookId: book.id,
        title: book.title,
        previousState: { series: book.series, seriesInstallment: book.seriesInstallment, seriesTotal: book.seriesTotal, seriesChecked: Boolean(book.seriesChecked) },
        proposedState: { series: book.series, seriesInstallment: book.seriesInstallment, seriesTotal: book.seriesTotal, seriesChecked: Boolean(book.seriesChecked) },
        confidence: 0,
        evidenceSources: [],
        decision: 'FAILED',
        reason: friendlyMetadataFailure(error),
      })
    }
  }

  return {
    total: allBooks.length,
    updated,
    repairedCount,
    protectedCount,
    lowConfidenceCount,
    unchangedCount,
    failures,
    diagnostics,
  }
}

const backfillState = reactive({
  running: false,
  finished: false,
  current: 0,
  total: 0,
  currentTitle: '',
  updated: 0,
  repairedCount: 0,
  protectedCount: 0,
  lowConfidenceCount: 0,
  unchangedCount: 0,
  failures: [],
  diagnostics: [],
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

export async function startLibraryBackfill({ books, updateBook, onDone, searchFn } = {}) {
  if (backfillState.running) return _runPromise

  _stopRequested = false
  Object.assign(backfillState, {
    running: true,
    finished: false,
    current: 0,
    total: 0,
    currentTitle: '',
    updated: 0,
    repairedCount: 0,
    protectedCount: 0,
    lowConfidenceCount: 0,
    unchangedCount: 0,
    failures: [],
    diagnostics: [],
  })

  _runPromise = (async () => {
    try {
      const result = await backfillLibraryMetadata({
        books,
        updateBook,
        searchFn,
        shouldStop: () => _stopRequested,
        onProgress: ({ current, total, title }) => {
          backfillState.current = current
          backfillState.total = total
          backfillState.currentTitle = title
        },
      })
      backfillState.updated = result.updated
      backfillState.repairedCount = result.repairedCount
      backfillState.protectedCount = result.protectedCount
      backfillState.lowConfidenceCount = result.lowConfidenceCount
      backfillState.unchangedCount = result.unchangedCount
      backfillState.total = result.total
      backfillState.failures = result.failures
      backfillState.diagnostics = result.diagnostics || []
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
