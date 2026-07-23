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
import { mergeMetadataIntoBook } from '~/composables/useDeviceLibrarySync'
import { bookNeedsMetadata, missingMetadataFields } from '~/composables/useMetadataBackfill'

// Pacing. Deliberately gentle: this is a background chore, not a race, and the
// shared metadata sources (Google Books especially) throttle bursts.
const BATCH_SIZE = 3 // books topped up per cycle
const BETWEEN_BOOKS_MS = 4000 // pause between books within a cycle
const CYCLE_COOLDOWN_MS = 4 * 60 * 1000 // rest between cycles
const RECHECK_AFTER_MS = 24 * 60 * 60 * 1000 // don't re-hit an unfillable book for a day
const START_DELAY_MS = 20 * 1000 // let the app settle after launch first

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

// Which books to top up this cycle: those with gaps, skipping any checked
// within RECHECK_AFTER_MS so an unfillable book is not hammered every cycle.
export function pickAutoTargets(books, { now = Date.now(), cooldownMs = RECHECK_AFTER_MS, limit = BATCH_SIZE } = {}) {
  return (books || [])
    .filter((book) => bookNeedsMetadata(book))
    .filter((book) => {
      const checkedAt = Number(book?.metaCheckedAt) || 0
      return now - checkedAt >= cooldownMs
    })
    .slice(0, limit)
}

// ── Background runner ────────────────────────────────────────────────────────

const autoState = reactive({
  enabled: false,
  running: false, // a cycle is actively working right now
  lastRunAt: 0,
  lastUpdated: 0, // books filled in the last cycle
  totalUpdated: 0, // books filled since this session started
})

let _timer = null
let _deps = null // { getBooks, updateBook, isBackfillRunning, isOnline }

const wait = (ms) => new Promise((resolve) => { _timer = setTimeout(resolve, ms); })

const online = () => (_deps?.isOnline ? _deps.isOnline() : (typeof navigator === 'undefined' || navigator.onLine !== false))

async function runCycle() {
  if (!autoState.enabled || autoState.running) return
  // Never compete with the manual Settings → Storage sweep.
  if (_deps?.isBackfillRunning?.()) return
  if (!online()) return

  const targets = pickAutoTargets(_deps.getBooks())
  if (!targets.length) return

  autoState.running = true
  autoState.lastUpdated = 0
  try {
    for (const book of targets) {
      if (!autoState.enabled) break
      try {
        const results = await fetchBookMetadataResults(
          book.title,
          book.author || undefined,
          undefined,
          { light: true },
        )
        const top = results?.[0]
        // Verify before trusting: only merge a result that is really this book.
        const merged = metadataResultMatchesBook(book, top)
          ? mergeMetadataIntoBook(book, top)
          : null
        // Stamp the check either way so an unfillable book waits a day before
        // its next attempt. Merge on top of `merged` so a successful fill keeps
        // its new fields.
        await _deps.updateBook({ ...(merged || book), metaCheckedAt: Date.now() })
        if (merged) {
          autoState.lastUpdated += 1
          autoState.totalUpdated += 1
        }
      } catch {
        // A source was down or rate-limited; leave the book for a later cycle.
      }
      if (!autoState.enabled) break
      await wait(BETWEEN_BOOKS_MS)
    }
  } finally {
    autoState.running = false
    autoState.lastRunAt = Date.now()
  }
}

async function loop() {
  // First pass shortly after launch, then a cycle every cooldown period.
  await wait(START_DELAY_MS)
  while (autoState.enabled) {
    await runCycle()
    if (!autoState.enabled) break
    await wait(CYCLE_COOLDOWN_MS)
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
