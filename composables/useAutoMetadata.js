// Automatic, background book-details backfill.
//
// The Settings → Storage "Book details" check finds books missing a cover,
// author, blurb, genre, year, Goodreads rating, or — for a series — its name,
// installment and total, and fills them from the web. This runs that same
// check on its own, forever, a few books at a time: scan the library, top up a
// small batch, cool down, repeat. It lives at module scope so it keeps running
// as the user moves around the app.
//
// It populates unattended, so it must not write wrong data. Two guards:
//   1. Sources are cross-referenced. fetchBookMetadataResults already merges
//      Google Books, Open Library, Internet Archive and Goodreads, preferring
//      values several sources agree on (see useBookMetadataSearch mergeResults).
//   2. A result is only accepted if it is actually THIS book — its title and
//      author must match (metadataResultMatchesBook), so a near-miss search hit
//      never overwrites empty fields with someone else's book.

import { reactive, readonly } from 'vue'
import { fetchBookMetadataResults } from '~/composables/useBookMetadataSearch'
import { applyMetadataResult, bookNeedsMetadata, missingMetadataFields } from '~/composables/useMetadataBackfill'

// Pacing.
//
// The old schedule spent 70-90% of the wall clock idling: three books were
// looked up one at a time, then the loop rested four minutes whether or not
// hundreds of books were still waiting. The rest period is now ADAPTIVE — short
// while there is a backlog and lookups are succeeding, long once the queue
// drains or the sources start refusing — and a batch is looked up concurrently
// rather than in single file.
const BATCH_SIZE = 3 // books looked up per cycle
const CONCURRENCY = 3 // ...and how many of them run at once
const RECHECK_AFTER_MS = 24 * 60 * 60 * 1000 // don't re-hit an unfillable book for a day
const START_DELAY_MS = 20 * 1000 // let the app settle after launch first

// Adaptive rest between cycles.
const BUSY_COOLDOWN_MS = 25 * 1000 // backlog, and the last cycle went fine
const IDLE_COOLDOWN_MS = 4 * 60 * 1000 // nothing left to do
const BACKGROUND_COOLDOWN_MS = 4 * 60 * 1000 // app is not on screen — be gentle
const ERROR_COOLDOWN_MS = 90 * 1000 // sources are refusing; ease off
// A cycle where most lookups threw means the sources are unhappy, not that the
// books are unfillable.
const ERROR_BACKOFF_RATIO = 0.5

const normalize = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

// Is this search result actually the book we asked about? Titles must match (or
// one contain the other — subtitles and series suffixes vary between sources),
// and if the book already has an author, it must agree. This is the gate that
// stops the unattended fill from writing another book's details into a gap.
export function metadataResultMatchesBook(book, result) {
  if (!result) return false
  const bookTitle = normalize(book?.title)
  const resultTitle = normalize(result.title)
  if (!bookTitle || !resultTitle) return false

  const titleMatches = bookTitle === resultTitle
    || bookTitle.includes(resultTitle)
    || resultTitle.includes(bookTitle)
  if (!titleMatches) return false

  const bookAuthor = normalize(book?.author)
  const resultAuthor = normalize(result.author)
  // Only enforce the author when the book already knows its own — a book that
  // is missing its author is exactly what we are here to fill.
  if (bookAuthor && resultAuthor) {
    return bookAuthor === resultAuthor
      || bookAuthor.includes(resultAuthor)
      || resultAuthor.includes(bookAuthor)
  }
  return true
}

// Goodreads is the slowest source by a wide margin — a 25s search cap plus a
// scrape per candidate — and it is the ONLY one that carries a star rating or a
// reliable series position. So it is worth calling when those are what's
// missing, and pure overhead when they aren't.
//
// This is deliberately not "use fewer sources for the same field": every field
// still being filled is still merged across every source that could supply it,
// so cross-verification is untouched. It only skips a source that has nothing
// left to contribute.
const GOODREADS_ONLY_FIELDS = new Set([
  'goodreadsRating', 'series', 'seriesInstallment', 'seriesTotal',
])

export function needsGoodreads(book) {
  return missingMetadataFields(book).some((field) => GOODREADS_ONLY_FIELDS.has(field))
}

// Books the user is most likely to look at next come first. Same throughput,
// but the gaps close where they are actually looking.
const priorityOf = (book) => {
  const status = String(book?.status || '').toLowerCase()
  if (status === 'reading') return 0
  if (book?.lastReadAt) return 1
  return 2
}

const addedAt = (book) => new Date(book?.createdAt || 0).getTime() || 0

// Which books to top up this cycle: those with gaps, skipping any checked
// within RECHECK_AFTER_MS so an unfillable book is not hammered every cycle.
export function pickAutoTargets(books, { now = Date.now(), cooldownMs = RECHECK_AFTER_MS, limit = BATCH_SIZE } = {}) {
  return (books || [])
    .filter((book) => bookNeedsMetadata(book))
    .filter((book) => {
      const checkedAt = Number(book?.metaCheckedAt) || 0
      return now - checkedAt >= cooldownMs
    })
    .sort((a, b) => priorityOf(a) - priorityOf(b) || addedAt(b) - addedAt(a))
    .slice(0, limit)
}

// How many books still carry a gap — drives whether the loop hurries or rests.
export function countPendingTargets(books, { now = Date.now(), cooldownMs = RECHECK_AFTER_MS } = {}) {
  return (books || []).filter((book) => (
    bookNeedsMetadata(book) && now - (Number(book?.metaCheckedAt) || 0) >= cooldownMs
  )).length
}

// ── Background runner ────────────────────────────────────────────────────────

const autoState = reactive({
  enabled: false,
  running: false, // a cycle is actively working right now
  lastRunAt: 0,
  lastUpdated: 0, // books filled in the last cycle
  totalUpdated: 0, // books filled since this session started
  pending: 0, // books still carrying a gap
  // Progress reporting for Settings → Storage.
  batchTotal: 0, // books in the batch being worked right now
  batchDone: 0, // how many of them are finished
  nextRunAt: 0, // epoch ms the next cycle is due
  lastError: 0, // failures in the last cycle
})

let _timer = null
let _deps = null // { getBooks, updateBook, isBackfillRunning, isOnline }

const wait = (ms) => new Promise((resolve) => { _timer = setTimeout(resolve, ms); })

const online = () => (_deps?.isOnline ? _deps.isOnline() : (typeof navigator === 'undefined' || navigator.onLine !== false))

const foreground = () => (
  typeof document === 'undefined' || document.visibilityState !== 'hidden'
)

// How long to rest after a cycle. Pure so the rules can be tested directly.
export function nextCooldownMs({
  pending = 0,
  attempted = 0,
  failed = 0,
  isForeground = true,
} = {}) {
  // Nothing waiting: this is a watch, not a job — check back rarely.
  if (!pending) return IDLE_COOLDOWN_MS
  // Off screen: the user cannot see the benefit, so don't spend their battery.
  if (!isForeground) return BACKGROUND_COOLDOWN_MS
  // Most of the batch threw — the sources are refusing, not the books empty.
  if (attempted && failed / attempted >= ERROR_BACKOFF_RATIO) return ERROR_COOLDOWN_MS
  // Backlog, and things are working. Push on.
  return BUSY_COOLDOWN_MS
}

// Look one book up and write back whatever could be verified.
async function fillOne(book) {
  const results = await fetchBookMetadataResults(
    book.title,
    book.author || undefined,
    undefined,
    // Skip the slow publisher crawl always, and Goodreads unless this book
    // actually needs something only Goodreads has.
    { light: true, skipGoodreads: !needsGoodreads(book) },
  )
  const top = results?.[0]
  // Verify before trusting: only apply a result that is really this book.
  const matched = metadataResultMatchesBook(book, top)
  const { record, filled } = applyMetadataResult(book, matched ? top : null, { didLookup: matched })
  // Stamp the check either way so an unfillable book waits a day before its
  // next attempt, on top of whatever the result filled (series-checked flag
  // included).
  await _deps.updateBook({ ...(record || book), metaCheckedAt: Date.now() })
  return filled
}

async function runCycle() {
  if (!autoState.enabled || autoState.running) return { attempted: 0, failed: 0 }
  // The scheduler keeps turning even with the book fill switched off, because
  // the series sweep shares it — so this phase checks its own setting.
  if (_deps?.isFillEnabled && !_deps.isFillEnabled()) return { attempted: 0, failed: 0 }
  // Never compete with the manual Settings → Storage sweep.
  if (_deps?.isBackfillRunning?.()) return { attempted: 0, failed: 0 }
  if (!online()) return { attempted: 0, failed: 0 }

  const targets = pickAutoTargets(_deps.getBooks())
  if (!targets.length) return { attempted: 0, failed: 0 }

  autoState.running = true
  autoState.lastUpdated = 0
  autoState.batchTotal = targets.length
  autoState.batchDone = 0
  let failed = 0
  try {
    // Concurrently, not in single file: each lookup is almost entirely waiting
    // on someone else's server, so running the batch together costs nothing
    // locally and cuts the cycle to roughly the slowest lookup in it.
    const lanes = Math.max(1, Math.min(CONCURRENCY, targets.length))
    let cursor = 0
    const worker = async () => {
      while (autoState.enabled) {
        const book = targets[cursor]
        cursor += 1
        if (!book) return
        try {
          if (await fillOne(book)) {
            autoState.lastUpdated += 1
            autoState.totalUpdated += 1
          }
        } catch {
          // A source was down or rate-limited; leave the book for a later cycle.
          failed += 1
        }
        autoState.batchDone += 1
      }
    }
    await Promise.all(Array.from({ length: lanes }, worker))
    return { attempted: targets.length, failed }
  } finally {
    autoState.running = false
    autoState.lastRunAt = Date.now()
    autoState.lastError = failed
  }
}

async function loop() {
  // First pass shortly after launch, then adaptively.
  await wait(START_DELAY_MS)
  while (autoState.enabled) {
    const { attempted, failed } = await runCycle()
    if (!autoState.enabled) break

    // One scheduler drives both background jobs, so they take turns on the
    // shared metadata sources instead of colliding on two independent timers.
    try {
      await _deps?.runSeriesSweep?.()
    } catch {
      // The series sweep reports its own problems; never let it stop this loop.
    }
    if (!autoState.enabled) break

    const pending = _deps?.isFillEnabled && !_deps.isFillEnabled()
      ? 0
      : countPendingTargets(_deps.getBooks())
    autoState.pending = pending
    const rest = nextCooldownMs({ pending, attempted, failed, isForeground: foreground() })
    autoState.nextRunAt = Date.now() + rest
    await wait(rest)
  }
}

export function startAutoMetadata(deps) {
  _deps = deps
  if (autoState.enabled) return
  autoState.enabled = true
  loop()
}

export function stopAutoMetadata() {
  autoState.enabled = false
  if (_timer) {
    clearTimeout(_timer)
    _timer = null
  }
}

export const useAutoMetadata = () => ({
  state: readonly(autoState),
  start: startAutoMetadata,
  stop: stopAutoMetadata,
})

export const __private = { missingMetadataFields }
