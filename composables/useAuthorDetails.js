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
