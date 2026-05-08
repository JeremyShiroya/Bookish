# EPUB & PDF Reader Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user uploads an EPUB or PDF book and clicks to open it, the reader displays the actual book content instead of a dummy placeholder.

**Architecture:** Client-side only — no server changes, no schema migration. For EPUB, `jszip` unpacks the file in the browser and concatenates chapter HTML into the existing `content` field. For PDF, `FileReader.readAsDataURL` encodes the file as a base64 data URL stored in `content`. The reader detects `format === 'pdf'` and renders an `<embed>` tag; all other formats use the existing HTML/text rendering path.

**Tech Stack:** Nuxt 4, Vue 3, jszip (new), existing Drizzle/Postgres backend (untouched)

---

### Task 1: Install jszip

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
npm install jszip
```

Expected output: jszip appears in `dependencies` in `package.json`.

- [ ] **Step 2: Verify install**

```bash
node -e "import('jszip').then(m => console.log('jszip ok', typeof m.default))"
```

Expected: `jszip ok function`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add jszip for epub extraction"
```

---

### Task 2: Create EPUB extractor composable

**Files:**
- Create: `composables/useEpubExtractor.js`
- Create: `composables/useEpubExtractor.test.js`

The extractor takes a `File` object and returns a single HTML string containing all chapter content in reading order. It is a plain async function wrapped in a composable so it can be mocked in tests.

- [ ] **Step 1: Write the failing test**

Create `composables/useEpubExtractor.test.js`:

```js
import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'

// Helper: build a minimal valid EPUB zip in memory
async function buildMinimalEpub() {
  const zip = new JSZip()

  zip.file('META-INF/container.xml', `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:schemas:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`)

  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="uid" version="2.0">
  <manifest>
    <item id="ch1" href="chapter1.html" media-type="application/xhtml+xml"/>
    <item id="ch2" href="chapter2.html" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>`)

  zip.file('OEBPS/chapter1.html', `<html><body><p>Hello from chapter one.</p></body></html>`)
  zip.file('OEBPS/chapter2.html', `<html><body><p>Hello from chapter two.</p></body></html>`)

  const blob = await zip.generateAsync({ type: 'blob' })
  return new File([blob], 'test.epub', { type: 'application/epub+zip' })
}

describe('useEpubExtractor', () => {
  it('extracts chapter HTML from a valid epub in spine order', async () => {
    const { extractEpub } = await import('./useEpubExtractor.js')
    const file = await buildMinimalEpub()
    const html = await extractEpub(file)
    expect(html).toContain('Hello from chapter one.')
    expect(html).toContain('Hello from chapter two.')
    // chapter one must appear before chapter two
    expect(html.indexOf('chapter one')).toBeLessThan(html.indexOf('chapter two'))
  })

  it('throws a descriptive error for a non-epub file', async () => {
    const { extractEpub } = await import('./useEpubExtractor.js')
    const bad = new File(['not a zip'], 'bad.epub', { type: 'application/epub+zip' })
    await expect(extractEpub(bad)).rejects.toThrow('Failed to parse EPUB')
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run composables/useEpubExtractor.test.js
```

Expected: FAIL — `Cannot find module './useEpubExtractor.js'`

- [ ] **Step 3: Implement the extractor**

Create `composables/useEpubExtractor.js`:

```js
import JSZip from 'jszip'

function parseXml(xmlString) {
  return new DOMParser().parseFromString(xmlString, 'application/xml')
}

export async function extractEpub(file) {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)

    // 1. Find OPF path from container.xml
    const containerXml = await zip.file('META-INF/container.xml').async('string')
    const containerDoc = parseXml(containerXml)
    const opfPath = containerDoc
      .querySelector('rootfile')
      .getAttribute('full-path')

    // 2. Parse OPF for manifest and spine
    const opfXml = await zip.file(opfPath).async('string')
    const opfDoc = parseXml(opfXml)

    // Build id -> href map from manifest
    const manifestMap = {}
    opfDoc.querySelectorAll('manifest item').forEach(item => {
      manifestMap[item.getAttribute('id')] = item.getAttribute('href')
    })

    // Get spine order
    const spineItems = Array.from(opfDoc.querySelectorAll('spine itemref'))
      .map(ref => ref.getAttribute('idref'))

    // 3. Base directory for relative hrefs (OPF may live in a subdirectory)
    const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : ''

    // 4. Read each chapter and extract body content
    const chapters = await Promise.all(
      spineItems.map(async (idref) => {
        const href = manifestMap[idref]
        if (!href) return ''
        const chapterPath = opfDir + href
        const chapterFile = zip.file(chapterPath)
        if (!chapterFile) return ''
        const html = await chapterFile.async('string')
        const doc = parseXml(html)
        const body = doc.querySelector('body')
        return body ? body.innerHTML : html
      })
    )

    return chapters.join('\n<hr class="chapter-break"/>\n')
  } catch (err) {
    throw new Error(`Failed to parse EPUB: ${err.message}`)
  }
}

export const useEpubExtractor = () => ({ extractEpub })
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run composables/useEpubExtractor.test.js
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add composables/useEpubExtractor.js composables/useEpubExtractor.test.js
git commit -m "feat: add epub extractor composable with tests"
```

---

### Task 3: Update AddBookModal to process EPUB and PDF

**Files:**
- Modify: `components/AddBookModal.vue`

Replace the `handleDocumentChange` method's `else` branch (currently `newBook.value.content = null`) with EPUB extraction and PDF base64 encoding. Also add an `extractionError` ref for user feedback.

- [ ] **Step 1: Add `extractionError` ref and update the template error display**

In `AddBookModal.vue`, inside `<script setup>`, add after the existing refs:

```js
const extractionError = ref(null)
```

In the template, add an error message below the document dropzone (after the `<input type="file" .../>` for the document):

```html
<p v-if="extractionError" class="extraction-error">{{ extractionError }}</p>
```

Add the style at the bottom of `<style scoped>`:

```css
.extraction-error {
  font-size: 0.75rem;
  color: #ef4444;
  margin-top: 0.4rem;
}
```

- [ ] **Step 2: Replace `handleDocumentChange` with EPUB/PDF-aware version**

Replace the entire `handleDocumentChange` function in `<script setup>`:

```js
const handleDocumentChange = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  extractionError.value = null
  documentFile.value = file
  const extension = file.name.split('.').pop().toLowerCase()
  newBook.value.format = extension

  if (!newBook.value.title) {
    newBook.value.title = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')
  }

  if (extension === 'txt' || extension === 'html' || extension === 'htm') {
    isProcessing.value = true
    const reader = new FileReader()
    reader.onload = (e) => {
      newBook.value.content = e.target.result
      isProcessing.value = false
    }
    reader.onerror = () => {
      extractionError.value = 'Could not read file.'
      isProcessing.value = false
    }
    reader.readAsText(file)

  } else if (extension === 'epub') {
    isProcessing.value = true
    try {
      const { extractEpub } = await import('~/composables/useEpubExtractor.js')
      newBook.value.content = await extractEpub(file)
    } catch (err) {
      extractionError.value = `EPUB error: ${err.message}`
      newBook.value.content = null
    } finally {
      isProcessing.value = false
    }

  } else if (extension === 'pdf') {
    isProcessing.value = true
    const reader = new FileReader()
    reader.onload = (e) => {
      newBook.value.content = e.target.result // data:application/pdf;base64,...
      isProcessing.value = false
    }
    reader.onerror = () => {
      extractionError.value = 'Could not read PDF file.'
      isProcessing.value = false
    }
    reader.readAsDataURL(file)

  } else {
    newBook.value.content = null
  }
}
```

- [ ] **Step 3: Verify the modal still renders without errors**

Start the dev server and open the Add Book modal:

```bash
npm run dev
```

Navigate to the app, click Add Book, upload a `.txt` file — confirm it still works (no console errors, book saves).

- [ ] **Step 4: Commit**

```bash
git add components/AddBookModal.vue
git commit -m "feat: extract epub content and encode pdf on upload"
```

---

### Task 4: Update the reader to render PDF via embed

**Files:**
- Modify: `pages/reader/[id].vue`

- [ ] **Step 1: Add `isPdf` computed and replace the content rendering block**

In `<script setup>`, add after the existing refs:

```js
import { ref, computed, onMounted, onUnmounted } from 'vue'

const isPdf = computed(() => book.value?.format === 'pdf')
```

> Note: The existing import line is `import { ref, onMounted, onUnmounted } from 'vue'` — replace it with the line above that adds `computed`.

- [ ] **Step 2: Update the template content block**

Find the `<template v-else-if="book">` block (lines 51–69 in the original file). Replace it entirely with:

```html
<template v-else-if="book">
  <!-- PDF: render via native browser embed -->
  <div v-if="isPdf && book.content" class="pdf-embed-wrapper">
    <embed
      :src="book.content"
      type="application/pdf"
      width="100%"
      height="100%"
    />
  </div>

  <!-- EPUB / HTML / plain text -->
  <div v-else-if="book.content" class="book-text">
    <div v-if="isHtml(book.content)" v-html="book.content"></div>
    <div v-else>{{ book.content }}</div>
  </div>

  <!-- No content extracted yet -->
  <div v-else class="placeholder-reading">
    <p class="dropcap">O</p>
    <p>nce upon a time in the digital library, this book awaited its reader. While the full contents are being synchronized, imagine the worlds contained within these pages.</p>
    <p>The smell of old parchment, the weight of the binding, and the whispers of long-forgotten stories fill the air of your mind.</p>
    <p>This is where your journey begins. A world of infinite possibilities, limited only by the boundaries of your imagination. Every word is a step, every sentence a path, and every chapter a destination.</p>
    <p>Continue scrolling to immerse yourself further into the architectural beauty of this reading interface.</p>
    <div class="filler-blocks">
      <div v-for="i in 5" :key="i" class="filler-paragraph"></div>
    </div>
    <p>As you reach the end of this preview, remember that every great story starts with a single click. Your library is a treasure trove of knowledge, emotion, and adventure.</p>
  </div>
</template>
```

- [ ] **Step 3: Hide font/theme controls for PDF and add pdf-embed-wrapper style**

In `<script setup>`, the controls already call `increaseFontSize`, `decreaseFontSize`, and `toggleTheme`. Wrap their buttons in the template with `v-show="!isPdf"`:

```html
<!-- In header-right div, wrap the three tool-btn buttons: -->
<div class="header-right">
  <template v-if="!isPdf">
    <button class="tool-btn" @click="toggleTheme" title="Switch Theme">
      <i :class="readerTheme === 'light' ? 'ri-moon-line' : 'ri-sun-line'"></i>
    </button>
    <button class="tool-btn" @click="increaseFontSize" title="Increase Font">
      <i class="ri-font-size"></i>
      <i class="ri-add-line mini-icon"></i>
    </button>
    <button class="tool-btn" @click="decreaseFontSize" title="Decrease Font">
      <i class="ri-font-size"></i>
      <i class="ri-subtract-line mini-icon"></i>
    </button>
  </template>
</div>
```

Add the `.pdf-embed-wrapper` style inside `<style scoped>`:

```css
.pdf-embed-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
}

.pdf-embed-wrapper embed {
  flex: 1;
  min-height: 80vh;
}
```

- [ ] **Step 4: Verify EPUB and PDF both render correctly**

With the dev server running (`npm run dev`):
1. Upload an EPUB file → open it in the reader. Confirm chapter text is visible (not the dummy placeholder).
2. Upload a PDF file → open it in the reader. Confirm the browser's native PDF viewer appears inside the reader frame. Confirm theme/font buttons are hidden.
3. Upload a TXT file → confirm it still renders as before (regression check).
4. Click an existing book that has no content → confirm the dummy placeholder still shows (regression check).

- [ ] **Step 5: Commit**

```bash
git add pages/reader/[id].vue
git commit -m "feat: render epub as html and pdf via embed in reader"
```

---

### Task 5: Add chapter-break style for EPUB

**Files:**
- Modify: `pages/reader/[id].vue`

The extractor inserts `<hr class="chapter-break"/>` between chapters. Style it so it's visible and readable.

- [ ] **Step 1: Add the style**

Inside `<style scoped>` in `pages/reader/[id].vue`, add:

```css
.book-text :deep(.chapter-break) {
  border: none;
  border-top: 1px solid rgba(138, 43, 226, 0.3);
  margin: 3rem auto;
  width: 60%;
}
```

- [ ] **Step 2: Verify visually**

Open an EPUB with multiple chapters. Confirm a subtle divider line appears between chapters.

- [ ] **Step 3: Commit**

```bash
git add pages/reader/[id].vue
git commit -m "style: add chapter break divider for epub reader"
```
