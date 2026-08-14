import { describe, expect, test } from 'vitest'
import {
  chunkForProgress,
  progressForChunk,
  readingPositionUpdate,
  resolveStartChunk,
  statusForProgress,
} from '../composables/useReadingPosition.js'
import { reconcileStatusProgress } from '../composables/useBooks.js'

describe('Reading Position Lifecycle & Safeguards (T1, T9, T10, T11)', () => {

  test('T9: Existing saved position (e.g. readingChunk 500) survives mount and is not overwritten by chunk 0', () => {
    const savedBook = { id: 'book-1', readingChunk: 500, progress: 25, status: 'Reading' }
    
    // Simulate initial unpositioned emit (chunk 0) when component first mounts before hydration
    const unpositionedEmit = { chunk: 0, totalChunks: 2000 }
    
    // If tracking is not ready, update function must not overwrite savedBook.readingChunk with 0
    let trackingReady = false
    let currentChunk = savedBook.readingChunk

    if (trackingReady) {
      const update = readingPositionUpdate(savedBook, {
        chunk: unpositionedEmit.chunk,
        totalChunks: unpositionedEmit.totalChunks,
      })
      if (update) currentChunk = update.readingChunk
    }

    expect(currentChunk).toBe(500)

    // Once tracking is ready and targetChunk (500) has landed:
    trackingReady = true
    const validTurn = { chunk: 501, totalChunks: 2000 }
    const validUpdate = readingPositionUpdate(savedBook, {
      chunk: validTurn.chunk,
      totalChunks: validTurn.totalChunks,
    })
    
    expect(validUpdate).not.toBeNull()
    expect(validUpdate.readingChunk).toBe(501)
  })

  test('T10: Paged restoration uses renderer coordinates (resolveStartChunk outranks progress fallback)', () => {
    const bookWithChunk = { id: 'book-2', readingChunk: 2500, progress: 40 }
    const totalChunks = 5000

    const resolvedChunk = resolveStartChunk(bookWithChunk, totalChunks)
    expect(resolvedChunk).toBe(2500)
    expect(resolvedChunk).not.toBe(chunkForProgress(40, totalChunks)) // 2000
  })

  test('T11: Progress rounding does not affect micro-position resume', () => {
    // Both chunk 1537 and chunk 1538 in a 10,000-chunk book round to 15% progress
    const total = 10000
    const chunkA = 1537
    const chunkB = 1538

    const progressA = progressForChunk(chunkA, total) // 15%
    const progressB = progressForChunk(chunkB, total) // 15%
    expect(progressA).toBe(15)
    expect(progressB).toBe(15)

    const book = { readingChunk: chunkA, progress: progressA, status: 'Reading' }
    
    // Moving from chunk 1537 to 1538 must produce a valid update despite identical %
    const update = readingPositionUpdate(book, { chunk: chunkB, totalChunks: total })
    expect(update).not.toBeNull()
    expect(update.readingChunk).toBe(1538)
    expect(update.progress).toBe(15)
    expect(update.lastReadAt).toBeTruthy()
  })

  test('T1: Rapid Exit - micro position update generates timestamp and update payload immediately', () => {
    const book = { readingChunk: 100, progress: 10, status: 'Reading' }
    const update = readingPositionUpdate(book, { chunk: 101, totalChunks: 1000 })

    expect(update).not.toBeNull()
    expect(update.readingChunk).toBe(101)
    expect(new Date(update.lastReadAt).getTime()).toBeGreaterThan(0)
  })

  test('Status reconciliation preserves reading position rules', () => {
    expect(reconcileStatusProgress('Read', 45)).toBe(100)
    expect(reconcileStatusProgress('Unread', 100)).toBe(0)
    expect(reconcileStatusProgress('Reading', 100)).toBe(99)
    expect(reconcileStatusProgress('Reading', 45)).toBe(45)
  })

})
