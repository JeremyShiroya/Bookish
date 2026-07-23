// Highlights and notes for a book's text.
//
// ANCHORING. A highlight has to survive the book being re-rendered, the
// typography changing, and sections mounting in any order — so it is never
// stored as a DOM position. The reader already wraps every readable sentence
// in `<span data-tts-chunk="N">` (see useChunkSpans), and those chunk indices
// are derived deterministically from the book's content. An annotation is
// therefore stored as a chunk index plus character offsets within that chunk,
// which re-resolve to a DOM range wherever and whenever the chunk is mounted.
//
// A selection can cross sentences, so the anchor holds a start and an end
// chunk; painting walks the chunks between them.

import { computed, ref } from 'vue'
import { buildTextIndex, resolveRangePoint } from '~/composables/useChunkSpans'
import { openLibraryDB } from '~/composables/useLibraryStore'

export const HIGHLIGHT_COLORS = Object.freeze([
  { id: 'yellow', label: 'Yellow', value: '#ffd54f' },
  { id: 'green', label: 'Green', value: '#a5d6a7' },
  { id: 'blue', label: 'Blue', value: '#90caf9' },
  { id: 'pink', label: 'Pink', value: '#f48fb1' },
  { id: 'purple', label: 'Purple', value: '#ce93d8' },
])

// Notes get their own look so a passage you wrote about never reads as just
// another colour choice.
export const NOTE_COLOR = '#c8b6ff'

export const colorValue = (id) => (
  HIGHLIGHT_COLORS.find((c) => c.id === id)?.value || HIGHLIGHT_COLORS[0].value
)

const newId = () => (
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `ann-${Date.now()}-${Math.random().toString(16).slice(2)}`
)

// ── Persistence ─────────────────────────────────────────────────────────────

const annotations = ref([])
const loadedBookId = ref('')

async function withStore(mode, run) {
  const db = await openLibraryDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('annotations', mode)
    const store = tx.objectStore('annotations')
    let result
    try {
      result = run(store)
    } catch (error) {
      reject(error)
      return
    }
    tx.oncomplete = () => resolve(result?.result ?? result)
    tx.onerror = (event) => reject(event.target.error)
    tx.onabort = (event) => reject(event.target.error)
  })
}

export async function loadAnnotations(bookId) {
  if (!bookId || typeof indexedDB === 'undefined') return []
  const rows = await withStore('readonly', (store) => store.index('bookId').getAll(String(bookId)))
  const list = Array.isArray(rows) ? rows : []
  // Reading order, so every list in the app agrees on what "first" means.
  list.sort((a, b) => (a.startChunk - b.startChunk) || (a.startOffset - b.startOffset))
  annotations.value = list
  loadedBookId.value = String(bookId)
  return list
}

export async function saveAnnotation(annotation) {
  const record = {
    ...annotation,
    id: annotation.id || newId(),
    bookId: String(annotation.bookId),
    updatedAt: new Date().toISOString(),
    createdAt: annotation.createdAt || new Date().toISOString(),
  }
  await withStore('readwrite', (store) => store.put(record))
  const index = annotations.value.findIndex((item) => item.id === record.id)
  if (index === -1) annotations.value = [...annotations.value, record]
  else annotations.value = annotations.value.map((item) => (item.id === record.id ? record : item))
  return record
}

export async function deleteAnnotation(id) {
  if (!id) return
  await withStore('readwrite', (store) => store.delete(id))
  annotations.value = annotations.value.filter((item) => item.id !== id)
}

export async function deleteAnnotationsForBook(bookId) {
  const rows = await loadAnnotations(bookId)
  for (const row of rows) await deleteAnnotation(row.id)
}

// ── Anchoring ───────────────────────────────────────────────────────────────

const chunkElement = (root, chunkIndex) => (
  (root || document).querySelector(`[data-tts-chunk="${chunkIndex}"]`)
)

// Where in its chunk does this DOM position fall? Returns null when the point
// is not inside a mapped sentence (headings, images, unmapped markup).
export function offsetInChunk(node, offset) {
  const el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node
  const chunkEl = el?.closest?.('[data-tts-chunk]')
  if (!chunkEl) return null
  const { map } = buildTextIndex(chunkEl)
  for (let i = 0; i < map.length; i += 1) {
    const point = map[i]
    if (point.node === node && point.offset >= offset) {
      return { chunkIndex: Number(chunkEl.dataset.ttsChunk), offset: i }
    }
  }
  return { chunkIndex: Number(chunkEl.dataset.ttsChunk), offset: map.length }
}

// Turn the live selection into a storable anchor.
export function anchorFromSelection(selection) {
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null
  const range = selection.getRangeAt(0)
  const start = offsetInChunk(range.startContainer, range.startOffset)
  const end = offsetInChunk(range.endContainer, range.endOffset)
  if (!start || !end) return null

  const text = String(selection.toString() || '').replace(/\s+/g, ' ').trim()
  if (!text) return null

  return {
    startChunk: start.chunkIndex,
    startOffset: start.offset,
    endChunk: end.chunkIndex,
    endOffset: Math.max(end.offset, start.offset + 1),
    text,
  }
}

// Resolve one chunk's slice of an annotation back to a DOM range.
function rangeForChunk(root, annotation, chunkIndex) {
  const chunkEl = chunkElement(root, chunkIndex)
  if (!chunkEl) return null
  const { map } = buildTextIndex(chunkEl)
  if (!map.length) return null

  const from = chunkIndex === annotation.startChunk ? annotation.startOffset : 0
  const to = chunkIndex === annotation.endChunk ? annotation.endOffset : map.length
  const startPoint = resolveRangePoint(map, Math.max(0, Math.min(from, map.length - 1)), 1)
  const endPoint = resolveRangePoint(map, Math.max(0, Math.min(to - 1, map.length - 1)), -1)
  if (!startPoint || !endPoint) return null

  try {
    const range = document.createRange()
    range.setStart(startPoint.node, startPoint.offset)
    range.setEnd(endPoint.node, Math.min(endPoint.node.nodeValue.length, endPoint.offset + 1))
    return range
  } catch {
    return null
  }
}

export const ANNOTATION_MARK_SELECTOR = 'mark[data-annotation-id]'

// Remove painted marks without disturbing the text they wrap.
export function clearAnnotationMarks(root) {
  const marks = (root || document).querySelectorAll(ANNOTATION_MARK_SELECTOR)
  marks.forEach((mark) => {
    const parent = mark.parentNode
    if (!parent) return
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
    parent.normalize()
  })
}

// Paint annotations into a mounted section. Idempotent: existing marks are
// cleared first, so re-painting after a re-render never nests marks.
export function paintAnnotations(root, list) {
  if (!root || typeof document === 'undefined') return
  clearAnnotationMarks(root)

  // Later ranges first: wrapping an earlier range would invalidate the text
  // offsets a later one still needs.
  const ordered = [...(list || [])].sort((a, b) => (
    (b.startChunk - a.startChunk) || (b.startOffset - a.startOffset)
  ))

  for (const annotation of ordered) {
    for (let chunk = annotation.startChunk; chunk <= annotation.endChunk; chunk += 1) {
      const range = rangeForChunk(root, annotation, chunk)
      if (!range) continue
      try {
        const mark = document.createElement('mark')
        mark.dataset.annotationId = annotation.id
        mark.className = annotation.note ? 'annotation-mark has-note' : 'annotation-mark'
        mark.style.backgroundColor = annotation.note ? NOTE_COLOR : colorValue(annotation.color)
        // The badge belongs on the first chunk only, so a note spanning
        // sentences is still marked once.
        if (annotation.note && chunk === annotation.startChunk) {
          mark.dataset.hasNote = 'true'
        }
        mark.appendChild(range.extractContents())
        range.insertNode(mark)
      } catch {
        // Overlapping or detached range — skip this slice rather than throw.
      }
    }
  }
}

// ── Reactive view ───────────────────────────────────────────────────────────

export const useAnnotations = () => {
  const highlights = computed(() => annotations.value.filter((a) => !a.note))
  const notes = computed(() => annotations.value.filter((a) => a.note))

  return {
    annotations,
    highlights,
    notes,
    loadedBookId,
    loadAnnotations,
    saveAnnotation,
    deleteAnnotation,
    deleteAnnotationsForBook,
  }
}
