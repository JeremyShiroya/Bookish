# Series Collection Progress Design

## Goal

Show library ownership against the known published size of a book series:

- `4/6 books collected` when four owned books belong to a six-book series.
- `Complete series` when the owned count meets or exceeds the known total.
- `4 Books` when no trustworthy total is available.

## Architecture

The existing add/edit metadata request remains the only web lookup entry point. Goodreads
book detail parsing will retain the canonical series-page URL when one is present, then
the metadata request will fetch that page and extract its primary-work count. The count
will flow through the existing metadata aggregator as `seriesTotal` and be persisted on
the selected book.

Bookish will not perform a web request when opening the Series page. The page derives the
best stored total from its local books, so it remains fast and local-first. A later add or
edit metadata refresh can update the stored total when a series grows.

## Data Flow

1. Add/Edit calls `/api/books/metadata` as it does today.
2. Goodreads search and detail parsing identify the book's series and series-page URL.
3. The Goodreads provider fetches the series page and parses the number of primary works.
4. `seriesTotal` passes through provider adapters and `buildMetadataResults`.
5. Selecting metadata saves `seriesTotal` with the book.
6. The series detail page chooses the highest valid stored total among its books.
7. A pure display helper formats complete, partial, and unknown-total states.

## Counting Rules

Use Goodreads' primary-work count rather than total works. This avoids counting editions,
boxed sets, omnibuses, and supplementary entries as normal installments when Goodreads
distinguishes them. Invalid totals, totals below one, and totals lower than a known
installment number are ignored.

If metadata providers disagree, the aggregator keeps the highest valid series total among
matched results. This avoids an older book record shrinking a series after a newer lookup.

## UI

Only series detail pages use collection-progress wording. Shared playlist and other group
detail pages keep their existing local book count.

The series header displays:

- Partial: `4/6 books collected`
- Complete: `Complete series`
- Unknown: `4 Books`

No manual series-total editor is required for this feature. Add/Edit may retain a visible
total field as a correction fallback, but metadata remains the normal source.

## Failure Handling

Failure to fetch or parse a Goodreads series page does not fail metadata search. The result
continues without `seriesTotal`, and the UI falls back to the local count.

## Testing

Tests cover:

- Goodreads series-page count extraction.
- Book detail extraction of the series-page URL.
- Metadata aggregation and highest-valid-total selection.
- Client fallback metadata retaining `seriesTotal`.
- Display labels for partial, complete, singular, and unknown totals.

