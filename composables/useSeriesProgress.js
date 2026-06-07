export const formatSeriesCollectionProgress = (ownedCount, seriesTotal) => {
  const owned = Math.max(0, Number(ownedCount) || 0);
  const total = Number(seriesTotal);

  if (Number.isSafeInteger(total) && total > 0) {
    return owned >= total ? 'Complete series' : `${owned}/${total} books collected`;
  }

  return `${owned} ${owned === 1 ? 'Book' : 'Books'}`;
};

const normalizeSeriesName = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const validSeriesTotals = (books) => books
  .map((book) => Number(book?.seriesTotal))
  .filter((total) => Number.isSafeInteger(total) && total > 0);

const metadataSeriesTotal = (results, seriesName, highestInstallment) => {
  const target = normalizeSeriesName(seriesName);
  const totals = results
    .filter((result) => normalizeSeriesName(result?.series) === target)
    .map((result) => Number(result?.seriesTotal))
    .filter((total) => (
      Number.isSafeInteger(total)
      && total > 0
      && total >= highestInstallment
    ));
  return totals.length ? Math.max(...totals) : null;
};

export const propagateSeriesTotal = async ({
  seriesName,
  seriesTotal,
  books,
  updateBook,
}) => {
  const total = Number(seriesTotal);
  if (!Number.isSafeInteger(total) || total < 1) return 0;

  const target = normalizeSeriesName(seriesName);
  const matchingBooks = books.filter((book) => normalizeSeriesName(book?.series) === target);
  await Promise.all(matchingBooks.map((book) => (
    updateBook({ ...book, seriesTotal: total })
  )));
  return matchingBooks.length;
};

export const ensureSeriesTotal = async ({
  seriesName,
  books,
  fetchMetadataResults,
  updateBook,
}) => {
  const storedTotals = validSeriesTotals(books);
  const storedTotal = storedTotals.length ? Math.max(...storedTotals) : null;

  const highestInstallment = Math.max(
    0,
    ...books
      .map((book) => Number(book?.seriesInstallment))
      .filter((installment) => Number.isFinite(installment)),
  );

  for (const book of books.slice(0, 3)) {
    if (!book?.title) continue;
    try {
      const results = await fetchMetadataResults(
        book.title,
        book.author || undefined,
        book.publisher || undefined,
      );
      const total = metadataSeriesTotal(results, seriesName, highestInstallment);
      if (!total) continue;

      if (total !== storedTotal) {
        await propagateSeriesTotal({
          seriesName,
          seriesTotal: total,
          books,
          updateBook,
        });
      }
      return total;
    } catch {
      // Try another owned installment before falling back to the local count.
    }
  }

  return storedTotal;
};

export const backfillSeriesTotals = async ({
  seriesList,
  fetchMetadataResults,
  updateBook,
  onProgress,
}) => {
  const seen = new Set();
  const uniqueSeries = seriesList.filter((series) => {
    const key = normalizeSeriesName(series?.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const summary = {
    total: uniqueSeries.length,
    updated: 0,
    unresolved: 0,
  };

  for (let index = 0; index < uniqueSeries.length; index += 1) {
    const series = uniqueSeries[index];
    const total = await ensureSeriesTotal({
      seriesName: series.name,
      books: series.books || [],
      fetchMetadataResults,
      updateBook,
    });

    if (total) summary.updated += 1;
    else summary.unresolved += 1;

    onProgress?.({
      current: index + 1,
      total: summary.total,
      seriesName: series.name,
      updated: summary.updated,
      unresolved: summary.unresolved,
    });
  }

  return summary;
};
