export function groupAuthorWorks(books = []) {
  const standaloneBooks = []
  const grouped = new Map()

  for (const book of books) {
    const seriesName = String(book?.series || '').trim()
    if (!seriesName) {
      standaloneBooks.push(book)
      continue
    }

    if (!grouped.has(seriesName)) {
      grouped.set(seriesName, {
        id: encodeURIComponent(seriesName),
        name: seriesName,
        author: book.author,
        books: [],
      })
    }
    grouped.get(seriesName).books.push(book)
  }

  const seriesGroups = [...grouped.values()]
    .map(series => ({
      ...series,
      books: [...series.books].sort((a, b) => (
        (Number(a.seriesInstallment) || Infinity)
        - (Number(b.seriesInstallment) || Infinity)
      )),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return { standaloneBooks, seriesGroups }
}

export function buildAuthorCollectionStats({
  ownedBooks = 0,
  totalBooks = null,
  ownedSeries = 0,
  totalSeries = null,
} = {}) {
  const normalizeTotal = (value) => {
    if (value === null || value === undefined || value === '') return null
    const total = Number(value)
    return Number.isFinite(total) && total >= 0 ? total : null
  }
  const booksOwned = Math.max(0, Number(ownedBooks) || 0)
  const seriesOwned = Math.max(0, Number(ownedSeries) || 0)
  const normalizedBooksTotal = normalizeTotal(totalBooks)
  const normalizedSeriesTotal = normalizeTotal(totalSeries)
  const booksTotal = normalizedBooksTotal === null
    ? null
    : Math.max(booksOwned, normalizedBooksTotal)
  const seriesTotal = normalizedSeriesTotal === null
    ? null
    : Math.max(seriesOwned, normalizedSeriesTotal)

  return {
    books: {
      owned: booksOwned,
      total: booksTotal,
      totalLabel: booksTotal === null ? '?' : String(booksTotal),
    },
    series: {
      owned: seriesOwned,
      total: seriesTotal,
      totalLabel: seriesTotal === null ? '?' : String(seriesTotal),
    },
  }
}
