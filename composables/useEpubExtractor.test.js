import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'

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
