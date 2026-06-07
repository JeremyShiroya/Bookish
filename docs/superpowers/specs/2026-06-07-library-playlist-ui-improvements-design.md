# Library and Playlist UI Improvements Design

## Goal

Improve pagination controls, playlist management, book-card information hierarchy, table hover styling, and the add-to-playlist experience while removing the temporary series backfill control.

## Settings and Pagination

- Remove the temporary "Retrieve series data" setting and all component-only state and imports used by it.
- Replace `libraryItemsPerPage` with:
  - `libraryGridItemsPerPage`, default `12`
  - `libraryTableItemsPerPage`, default `10`
- Keep both values independently editable in Settings.
- Migrate existing stored settings by using the legacy `libraryItemsPerPage` value when a new per-view value is absent.
- The Books page selects the page size from the active view and resets to page one when that value or the view changes.

## Playlist Management

- Add `updatePlaylist` and `deletePlaylist` operations to `useBooks`.
- Add `deleteCollection` to the IndexedDB store.
- Right-clicking a playlist card opens a small context menu positioned at the pointer with Edit and Delete actions.
- Edit opens a reusable playlist editor modal for name and optional description.
- Delete opens a confirmation prompt and removes only the playlist record. Library books remain untouched.
- Clicking outside the context menu or pressing Escape closes it.
- The playlist detail hero shows an edit icon beside the playlist title. It opens the same playlist editor modal.
- Both `/playlist/:id` and `/playlists/:id` route variants receive the same behavior.

## Book Grid Layout

- Place the grid reading progress directly below the genre tag.
- Give progress a full-width row with its percentage aligned beside the track.
- Keep the personal rating in the metadata row.

## Table Hover Color

- Add a dedicated `--color-table-row-hover` token to `assets/css/main.css`.
- Light value: `#d3d5e3`.
- Dark value: `#302e3b`.
- Use this token for rows in the Books table and the shared series/playlist detail table.
- Leave general control and card hover colors unchanged.

## Add-to-Playlist Modal

Use the approved cover-led design:

- Header with title, helper text, close button, and a compact selected-book preview.
- Segmented Existing Playlist / Create New control.
- Search input for filtering available playlists.
- Playlist options styled as cards with an icon, name, book count, and selected indicator.
- Clear empty state when the book already belongs to every playlist or the search has no matches.
- New-playlist form keeps name and description fields.
- Footer communicates the selected playlist and provides Cancel and Add Book actions.
- Existing persistence behavior remains unchanged.

## Error Handling

- Playlist update and deletion failures restore local state and show an error toast where the calling surface supports toasts.
- Empty playlist names cannot be saved.
- Context-menu actions stop card navigation.
- Pagination settings are normalized to allowed positive options.

## Testing

- Extend settings tests for defaults, legacy migration, and independent per-view persistence.
- Extend library store tests for collection deletion.
- Add focused tests for pure playlist filtering or pagination helpers if extracted.
- Run the complete Vitest suite excluding `.claude/worktrees/**`.
- Run the Nuxt production build.
- Validate the Books and Playlists interactions in the rendered app when browser tooling is available.
