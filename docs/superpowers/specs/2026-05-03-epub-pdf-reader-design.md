# EPUB & PDF Reader Support — Design Spec
Date: 2026-05-03

## Problem

When a user uploads an EPUB or PDF book and clicks to open it, the reader shows a dummy placeholder page instead of the actual book content. Only `.txt` and `.html` files currently work. EPUB and PDF uploads silently set `content = null`.

## Goal

Make uploaded EPUB and PDF books open and display their actual content in the reader page.

---

## Architecture

No server changes. No schema migration. Two files modified, one package added.

| File | Change |
|------|--------|
| `components/AddBookModal.vue` | Extract EPUB HTML via `jszip`; encode PDF as base64 data URL |
| `pages/reader/[id].vue` | Detect PDF content and render via `<embed>` instead of text div |
| `package.json` | Add `jszip` |

The existing `content` text column in the `books` table stores both EPUB HTML and PDF base64 data URLs without modification.

---

## EPUB Processing (`AddBookModal.vue`)

Triggered when the user selects a `.epub` file in the document input.

**Steps:**
1. Set `isProcessing = true`.
2. Dynamically import `jszip`.
3. Load the EPUB file as an `ArrayBuffer` via `FileReader.readAsArrayBuffer`.
4. Unzip with JSZip.
5. Read `META-INF/container.xml` → find the `rootfile` path (the OPF file).
6. Parse the OPF XML → extract the `<spine>` reading order (list of `idref` values) and the `<manifest>` (map of id → href for each content file).
7. For each spine item in order: read the corresponding HTML file from the ZIP, strip `<head>` tags, keep the `<body>` inner HTML.
8. Concatenate all chapter HTML into one string.
9. Store in `newBook.value.content`; set `newBook.value.format = 'epub'`.
10. Set `isProcessing = false`.

**Error handling:** If any step throws (malformed OPF, missing files, etc.), set `isProcessing = false` and show an error message in the modal (a new `extractionError` ref rendered as a red text below the dropzone). Do not set `content` — leave it null so the user knows it failed.

---

## PDF Handling (`AddBookModal.vue`)

Triggered when the user selects a `.pdf` file.

**Steps:**
1. Set `isProcessing = true`.
2. Use `FileReader.readAsDataURL(file)` to encode as `data:application/pdf;base64,...`.
3. Store the data URL in `newBook.value.content`; set `newBook.value.format = 'pdf'`.
4. Set `isProcessing = false`.

No external library needed — the browser handles PDF rendering natively via `<embed>`.

**Error handling:** On `reader.onerror`, set `isProcessing = false` and show `extractionError`.

---

## Reader Changes (`pages/reader/[id].vue`)

The reader fetches the book with `includeContent = true` (already the case).

**Content rendering logic:**
- Add computed `isPdf`: `book.value?.format === 'pdf'`
- If `isPdf`: render `<embed :src="book.content" type="application/pdf" width="100%" style="height: 100%">` filling the reader content area.
- If not PDF and `book.content` exists: existing path (HTML via `v-html` or plain text).
- If `book.content` is null: existing dummy placeholder (unchanged).

**Header controls when PDF is active:**
- Font size buttons (increase/decrease) are hidden — they don't affect the embedded PDF viewer.
- Theme toggle is hidden — the PDF viewer has its own chrome.
- Progress tracking (scroll %) is disabled for PDF — `handleScroll` is not called; `scrollProgress` stays 0.

---

## Error States Summary

| Scenario | Behaviour |
|----------|-----------|
| EPUB parse fails | `extractionError` shown in modal, `content` stays null |
| PDF encode fails | `extractionError` shown in modal, `content` stays null |
| Book saved with null content | Reader shows existing dummy placeholder (no regression) |
| Book not found | Reader shows existing "Book not found" error (no change) |

---

## Out of Scope

- MOBI / AZW3 support (proprietary format, not addressed)
- Server-side file storage or file path column
- Image rendering within EPUB (inline images may not display; CSS from EPUB is stripped)
- PDF progress tracking (scroll % not tracked for embedded PDFs)
