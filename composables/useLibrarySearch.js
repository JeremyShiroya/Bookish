// Ranked, incremental library search: every keystroke — including the first
// letter — produces a useful, ordered list without a submit or a debounce.

// Lower-cased and stripped of accents, so "bronte" finds "Brontë".
export const normalizeSearchText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .trim()

// A title outranks an author, which outranks a series, which outranks a genre.
const FIELD_WEIGHTS = [
  ['title', 100],
  ['author', 70],
  ['series', 45],
  ['genre', 25],
]

// An exact field beats a field the query starts, which beats a match at a word
// boundary, which beats one buried mid-word. That ordering is what makes a
// single typed letter land on the books whose titles begin with it.
export const matchQuality = (value, query) => {
  const text = normalizeSearchText(value)
  if (!text || !query) return 0
  const index = text.indexOf(query)
  if (index === -1) return 0
  if (text === query) return 4
  if (index === 0) return 3
  return /\s/.test(text[index - 1]) ? 2 : 1
}

export const DEFAULT_SEARCH_LIMIT = 8

export function searchLibrary(books, rawQuery, limit = DEFAULT_SEARCH_LIMIT) {
  const query = normalizeSearchText(rawQuery)
  if (!query) return []

  const scored = []
  for (const book of books || []) {
    let score = 0
    for (const [field, weight] of FIELD_WEIGHTS) {
      score = Math.max(score, matchQuality(book?.[field], query) * weight)
    }
    if (score > 0) scored.push({ book, score })
  }

  return scored
    .sort((a, b) => b.score - a.score
      || String(a.book.title || '').localeCompare(String(b.book.title || '')))
    .slice(0, limit)
    .map((entry) => entry.book)
}
