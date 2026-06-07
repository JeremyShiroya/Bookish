# Series Data Backfill Design

## Goal

Make series detail pages instant by storing series totals ahead of time:

- Existing libraries get a temporary Settings action that retrieves and stores all series totals.
- Add/Edit metadata selection stores the fetched total and propagates it across matching local books.
- Series detail pages only read local data and never start a metadata request.

## Architecture

`useSeriesProgress` will own three pure/service-style operations:

1. Resolve a total for one series from the existing book metadata search.
2. Persist one known total across every local book with the same normalized series name.
3. Backfill all unique series sequentially and report progress.

Settings calls the backfill operation with the current `seriesList`, metadata fetcher, and
`updateBook`. Add/Edit call the propagation operation after a successful save. The series
detail route becomes local-only again.

## Batch Behavior

The temporary Settings button processes one representative book per unique series. If the
first representative does not return a matching total, up to two more owned installments
are tried. Series are processed sequentially to avoid bursts against providers.

Progress reports:

- Current position and total unique series.
- Current series name.
- Updated count and unresolved count.

The button is disabled while running. Completion produces a success or warning toast.

## Persistence

Every resolved total is written through `useBooks().updateBook`, which updates both the
reactive library and IndexedDB. Add/Edit propagation uses the same path, so later series
navigation reads the stored value immediately.

## UI

Settings > Metadata gains a temporary `Retrieve series data` row with a progress summary.
The existing metadata snapshot remains unchanged.

Series detail pages render:

- `4/6 books collected`
- `Complete series`
- `4 Books` when the backfill or Add/Edit lookup could not resolve a total

There is no page-load spinner or metadata request on the series route.

## Testing

Tests cover unique-series batching, sequential progress, persistence, unresolved series,
and propagation of an Add/Edit total to matching local books.

