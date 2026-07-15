import { describe, it, expect } from 'vitest'
import { resolveOpenedExtension, openedDocumentRegistryKey, findScannedImportId } from '~/composables/useOpenedDocument'
import { selectNewDeviceFiles } from '~/composables/useDeviceLibrarySync'

describe('resolveOpenedExtension', () => {
  it('resolves by file extension first', () => {
    expect(resolveOpenedExtension('Deep Work.PDF', null)).toBe('pdf')
    expect(resolveOpenedExtension('dune.epub', 'application/octet-stream')).toBe('epub')
  })

  it('falls back to the MIME type when the name has no known extension', () => {
    expect(resolveOpenedExtension('document', 'application/pdf')).toBe('pdf')
    expect(resolveOpenedExtension('12345', 'application/epub+zip')).toBe('epub')
  })

  it('rejects unsupported documents', () => {
    expect(resolveOpenedExtension('notes.docx', 'application/msword')).toBeNull()
    expect(resolveOpenedExtension('', null)).toBeNull()
  })
})

describe('openedDocumentRegistryKey', () => {
  it('keys on name and size so re-opens are idempotent', () => {
    expect(openedDocumentRegistryKey('dune.epub', 123)).toBe('openwith:dune.epub:123')
    expect(openedDocumentRegistryKey('dune.epub', 456)).not.toBe(openedDocumentRegistryKey('dune.epub', 123))
  })
})

describe('open-with / device-scan dedupe', () => {
  it('finds a scan-imported book matching the opened document by basename and size', () => {
    const registry = {
      '/storage/emulated/0/Download/dune.epub': { size: 123, modified: 1, bookId: 'b1' },
      'openwith:other.pdf:9': { size: 9, bookId: 'b2' },
    }
    expect(findScannedImportId(registry, 'dune.epub', 123)).toBe('b1')
    expect(findScannedImportId(registry, 'dune.epub', 999)).toBeNull()
    expect(findScannedImportId(registry, 'other.pdf', 9)).toBeNull()
  })

  it('scan skips files already imported through the "Open with" flow', () => {
    const files = [
      { path: '/storage/emulated/0/Download/dune.epub', size: 123, modified: 1 },
      { path: '/storage/emulated/0/Download/fresh.pdf', size: 55, modified: 1 },
    ]
    const registry = { 'openwith:dune.epub:123': { size: 123, bookId: 'b1' } }
    expect(selectNewDeviceFiles(files, registry).map((file) => file.path)).toEqual([
      '/storage/emulated/0/Download/fresh.pdf',
    ])
  })
})
