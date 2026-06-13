// Extracts the pure helpers from useTTS.js and verifies chunk boundaries
import { readFileSync } from 'fs'

const src = readFileSync('composables/useTTS.js', 'utf8')

const pick = (name, kind = 'function') => {
  let startToken = kind === 'function' ? `export function ${name}` : `const ${name}`
  let start = src.indexOf(startToken)
  if (start === -1 && kind === 'function') start = src.indexOf(`function ${name}`)
  if (start === -1) throw new Error(`${name} not found`)
  // find matching closing brace
  let i = src.indexOf('{', start)
  let depth = 0
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') { depth--; if (depth === 0) break }
  }
  return src.slice(start, i + 1).replace(/^export /, '')
}

const pickLine = (name) => {
  const line = src.split('\n').find(l => l.startsWith(`const ${name}`))
  if (!line) throw new Error(`${name} line not found`)
  return line
}

const code = [
  'const DEFAULT_SENTENCE_MAX_CHARS = 480;',
  pick('NAMED_ENTITIES', 'const'),
  pickLine('SECTION_TITLE_PATTERN'),
  pick('decodeEntities'),
  pick('stripHtml'),
  pick('splitLongSentence'),
  pick('splitToChunks'),
  pick('isRenderableSection'),
  pick('splitContentSections'),
  pick('buildReadableChunks'),
  pick('buildChapterBoundariesFromHtml'),
].join('\n')

const fn = new Function(code + `
  return { decodeEntities, stripHtml, splitToChunks, isRenderableSection, splitContentSections, buildReadableChunks, buildChapterBoundariesFromHtml }
`)
const { decodeEntities, stripHtml, splitToChunks, isRenderableSection, splitContentSections, buildReadableChunks, buildChapterBoundariesFromHtml } = fn()

let failures = 0
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) {
    failures++
    console.log(`FAIL ${label}\n  actual:   ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`)
  } else {
    console.log(`ok   ${label}`)
  }
}

// Screenshot case: curly quotes around dialogue
const text = '‘Oh, okay. Good,’ Marybeth said. ‘Did she, uh, did you get a treasure hunt this year?’ Her eyes turned red again. ‘Before …’'
check('curly-quote dialogue chunks', splitToChunks(text), [
  '‘Oh, okay.',
  'Good,’ Marybeth said.',
  '‘Did she, uh, did you get a treasure hunt this year?’',
  'Her eyes turned red again.',
  '‘Before …’',
])

// Entity-encoded version of the same text (as raw EPUB HTML would have it)
const htmlText = '<p>&lsquo;Oh, okay. Good,&rsquo; Marybeth said. &lsquo;Did she, uh, did you get a treasure hunt this year?&rsquo; Her eyes turned red again. &lsquo;Before &hellip;&rsquo;</p>'
check('entity-decoded chunks match', splitToChunks(stripHtml(htmlText)), splitToChunks(text))

// hr no longer creates phantom "." chunks
check('hr produces no phantom chunks',
  splitToChunks(stripHtml('<p>End of one.</p><hr class="chapter-break"><p>Start of two.</p>')),
  ['End of one.', 'Start of two.'])

// decodeEntities basics
check('mdash entity', decodeEntities('a &mdash; b'), 'a — b')
check('numeric entity', decodeEntities('&#8217;tis'), '’tis')
check('double-encoded amp stays literal', decodeEntities('&amp;mdash;'), '&mdash;')
check('soft hyphen stripped', decodeEntities('co­operate'), 'cooperate')

// chapter boundaries — simple book, one heading per section
const bookHtml = '<h2>One</h2><p>First. Second. Third.</p><hr class="chapter-break"/><h2>Two</h2><p>Fourth. Fifth.</p>'
const totalChunks = splitToChunks(stripHtml(bookHtml)).length
const bounds = buildChapterBoundariesFromHtml(bookHtml, totalChunks)
check('boundary count', bounds.length, 2)
check('boundary coverage', [bounds[0].chunkStart, bounds[bounds.length - 1].chunkEnd], [0, totalChunks - 1])
check('boundary titles', bounds.map(b => b.title), ['One', 'Two'])

// no chapter breaks -> empty (standard bar)
check('flat content yields no boundaries', buildChapterBoundariesFromHtml('<p>Just text. More text.</p>', 2), [])

// PAGE-SPLIT BOOK: 12 sections, but TOC says only 3 real chapters.
// Sections without a TOC title must merge into the chapter before them.
const sectionHtml = (i) => `<p>Section ${i} sentence one. Section ${i} sentence two.</p>`
const pageSplitParts = Array.from({ length: 12 }, (_, i) => sectionHtml(i))
const pageSplitHtml = pageSplitParts.join('<hr class="chapter-break"/>')
const pageSplitToc = Array.from({ length: 12 }, (_, i) =>
  i === 0 ? 'Prologue' : i === 2 ? 'Chapter One' : i === 7 ? 'Chapter Two' : null)
const pageSplitTotal = splitToChunks(stripHtml(pageSplitHtml)).length
const grouped = buildChapterBoundariesFromHtml(pageSplitHtml, pageSplitTotal, pageSplitToc)
check('page-split groups to TOC chapters', grouped.map(b => b.title), ['Prologue', 'Chapter One', 'Chapter Two'])
check('page-split group sizes', grouped.map(b => b.chunkEnd - b.chunkStart + 1), [4, 10, 10])
check('page-split coverage', [grouped[0].chunkStart, grouped[grouped.length - 1].chunkEnd], [0, pageSplitTotal - 1])

// Page-split with NO toc: headingless body-text chapters detected by pattern
const patternParts = [
  '<p>Chapter One</p><p>It began. It continued.</p>',
  '<p>More pages of one. And more.</p>',
  '<p>Chapter Two</p><p>It ended. Truly.</p>',
  '<p>Final pages. Done.</p>',
]
const patternHtml = patternParts.join('<hr class="chapter-break"/>')
const patternTotal = splitToChunks(stripHtml(patternHtml)).length
const patternBounds = buildChapterBoundariesFromHtml(patternHtml, patternTotal, [])
check('pattern-detected chapter titles', patternBounds.map(b => b.title), ['Chapter One', 'Chapter Two'])

// Untitled leading sections are NOT a fake chapter: segments mirror the TOC's
// titled sections exactly (the reader sidebar omits untitled front matter too).
const fmParts = [
  '<p>Copyright text here. All rights reserved.</p>',
  '<p>Chapter body text one. More text.</p>',
  '<p>Chapter body text two. More text.</p>',
]
const fmToc = [null, 'Chapter One', 'Chapter Two']
const fmHtml = fmParts.join('<hr class="chapter-break"/>')
const fmReadable = buildReadableChunks(fmHtml)
const fmTotal = fmReadable.chunks.length
const fmBounds = buildChapterBoundariesFromHtml(fmHtml, fmTotal, fmToc)
check('titled-section segments only', fmBounds.map(b => b.title), ['Chapter One', 'Chapter Two'])
// First chapter starts after the untitled copyright section, last covers the end.
check('front-matter excluded from first segment', fmBounds[0].chunkStart, fmReadable.sectionCounts[0])
check('segments cover through the end', fmBounds[fmBounds.length - 1].chunkEnd, fmTotal - 1)

// Per-section chunking keeps chunk indices in lockstep with section offsets:
// the sum of section counts equals the flat chunk total (no cross-section drift).
const driftHtml = '<p>Chapter One</p><hr class="chapter-break"/><p>It began without a full stop</p><hr class="chapter-break"/><p>Then it ended. Done.</p>'
const driftReadable = buildReadableChunks(driftHtml)
check('section counts sum to flat total',
  driftReadable.sectionCounts.reduce((a, b) => a + b, 0),
  driftReadable.chunks.length)

// isRenderableSection keeps image-only sections, drops empty ones
check('image-only section kept', isRenderableSection('<div><img src="cover.jpg"/></div>'), true)
check('empty section dropped', isRenderableSection('<div>  </div>'), false)

process.exit(failures ? 1 : 0)
