// Reading position, shared by every reading surface.
//
// The reader used to keep two disconnected positions: the paged surface wrote
// {section, page} to localStorage, while the scroll surface restored from
// `book.progress`, which was derived from the CHAPTER INDEX alone. So scroll
// mode could only ever land on a chapter boundary, and switching modes threw the
// page away — the "scroll mode always starts at the beginning" report.
//
// One unit fixes both: the CHUNK index. Chunks are the reader's existing
// sentence-level unit, already shared by the paged surface, the scroll surface,
// PDF pages and narration. Progress becomes chunk/total, so the percentage is
// sentence-accurate and actually moves while reading — which is also what makes
// "Currently Reading" able to follow silent reading.

export const READING_POSITION_SAVE_DELAY_MS = 450

export function progressForChunk(chunkIndex, totalChunks) {
  const total = Math.max(0, Math.floor(Number(totalChunks) || 0))
  if (total <= 1) return 0
  const current = Math.max(0, Math.min(total - 1, Math.floor(Number(chunkIndex) || 0)))
  return Math.max(0, Math.min(100, Math.round((current / (total - 1)) * 100)))
}

export function chunkForProgress(progress, totalChunks) {
  const total = Math.max(0, Math.floor(Number(totalChunks) || 0))
  if (total <= 0) return 0
  const percent = Math.max(0, Math.min(100, Number(progress) || 0))
  return Math.max(0, Math.min(total - 1, Math.round((percent / 100) * (total - 1))))
}

export function statusForProgress(progress) {
  const percent = Math.max(0, Math.min(100, Number(progress) || 0))
  if (percent > 95) return 'Read'
  return percent > 0 ? 'Reading' : 'Unread'
}

// Where a book should open. `readingChunk` is authoritative; `progress` is the
// migration path for books saved before chunk positions existed.
export function resolveStartChunk(book, totalChunks) {
  const saved = Number(book?.readingChunk)
  if (Number.isFinite(saved) && saved >= 0) {
    return Math.max(0, Math.min(Math.max(0, totalChunks - 1), Math.floor(saved)))
  }
  const progress = Number(book?.progress) || 0
  return progress > 0 ? chunkForProgress(progress, totalChunks) : 0
}

/**
 * The record to write for a position. Returns null when nothing changed, so a
 * settling scroll does not spend a database write per frame.
 *
 * `lastReadAt` is stamped whenever the CHUNK moves, not only when the rounded
 * percentage does. The old guard compared percentages, so turning twenty pages
 * inside one chapter wrote nothing at all — which is why silent reading never
 * reached "Currently Reading".
 */
export function readingPositionUpdate(book, { chunk, totalChunks, progress, status } = {}) {
  if (!book) return null

  const nextChunk = Math.max(0, Math.floor(Number(chunk) || 0))
  const nextProgress = progress ?? progressForChunk(nextChunk, totalChunks)
  const nextStatus = status ?? statusForProgress(nextProgress)

  const chunkUnchanged = Number(book.readingChunk) === nextChunk
  const progressUnchanged = Number(book.progress || 0) === nextProgress
  const statusUnchanged = (book.status || 'Unread') === nextStatus
  if (chunkUnchanged && progressUnchanged && statusUnchanged) return null

  return {
    readingChunk: nextChunk,
    progress: nextProgress,
    status: nextStatus,
    lastReadAt: new Date().toISOString(),
  }
}
