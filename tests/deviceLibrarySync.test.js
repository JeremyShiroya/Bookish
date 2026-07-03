import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  BOOKISH_DEVICE_IMPORTS_KEY,
  cleanTitleFromFileName,
  mergeMetadataIntoBook,
  readImportRegistry,
  selectNewDeviceFiles,
  writeImportRegistry,
} from '../composables/useDeviceLibrarySync.js'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')

const fakeStorage = (initial = {}) => {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  }
}

describe('device library sync', () => {
  test('imports only unseen or changed pdf/epub files', () => {
    const registry = {
      '/storage/emulated/0/Books/known.epub': { size: 100, modified: 5 },
      '/storage/emulated/0/Books/changed.pdf': { size: 100, modified: 5 },
      '/storage/emulated/0/Books/failed.epub': { size: 70, modified: 3, failed: true },
    }
    const files = [
      { path: '/storage/emulated/0/Books/known.epub', name: 'known.epub', size: 100, modified: 5 },
      { path: '/storage/emulated/0/Books/changed.pdf', name: 'changed.pdf', size: 250, modified: 9 },
      { path: '/storage/emulated/0/Books/new.pdf', name: 'new.pdf', size: 300, modified: 10 },
      { path: '/storage/emulated/0/Books/failed.epub', name: 'failed.epub', size: 70, modified: 3 },
      { path: '/storage/emulated/0/Notes/readme.txt', name: 'readme.txt', size: 10, modified: 1 },
      { path: '/storage/emulated/0/Books/huge.pdf', name: 'huge.pdf', size: 900 * 1024 * 1024, modified: 2 },
    ]

    expect(selectNewDeviceFiles(files, registry).map((file) => file.name)).toEqual(['changed.pdf', 'new.pdf'])
  })

  test('round-trips the import registry through storage', () => {
    const storage = fakeStorage()
    writeImportRegistry({ '/a.pdf': { size: 1, modified: 2 } }, storage)
    expect(JSON.parse(storage.getItem(BOOKISH_DEVICE_IMPORTS_KEY))).toEqual({ '/a.pdf': { size: 1, modified: 2 } })
    expect(readImportRegistry(storage)).toEqual({ '/a.pdf': { size: 1, modified: 2 } })
    expect(readImportRegistry(fakeStorage({ [BOOKISH_DEVICE_IMPORTS_KEY]: 'not-json' }))).toEqual({})
  })

  test('derives a readable title from a file name', () => {
    expect(cleanTitleFromFileName('the_martian-andy_weir.epub')).toBe('the martian andy weir')
    expect(cleanTitleFromFileName('Project Hail Mary.pdf')).toBe('Project Hail Mary')
  })

  test('backfill only fills empty fields and never overwrites user data', () => {
    const book = {
      id: '1',
      title: 'Project Hail Mary',
      author: 'Andy Weir',
      blurb: '',
      genre: '',
      publishYear: null,
      series: null,
      seriesInstallment: null,
      seriesTotal: null,
      cover: 'data:image/svg+xml,placeholder',
      webReview: null,
    }
    const meta = {
      title: 'Project Hail Mary (different)',
      author: 'Somebody Else',
      blurb: 'An astronaut wakes alone.',
      genre: 'Science Fiction',
      publishYear: 2021,
      cover: 'https://covers.example/phm.jpg',
      webReview: { rating: 4.5 },
    }

    const updated = mergeMetadataIntoBook(book, meta)
    expect(updated.title).toBe('Project Hail Mary')
    expect(updated.author).toBe('Andy Weir')
    expect(updated.blurb).toBe('An astronaut wakes alone.')
    expect(updated.genre).toBe('Science Fiction')
    expect(updated.publishYear).toBe(2021)
    expect(updated.cover).toBe('https://covers.example/phm.jpg')
    expect(updated.webReview).toEqual({ rating: 4.5 })

    // A real (non-placeholder) cover is never replaced.
    const covered = mergeMetadataIntoBook({ ...book, cover: 'blob:local-cover' }, meta)
    expect(covered.cover).toBe('blob:local-cover')

    // Nothing to fill → no update.
    expect(mergeMetadataIntoBook({ ...updated, series: 'S', seriesInstallment: 1, seriesTotal: 3, publisher: 'P' }, meta)).toBeNull()
  })

  test('native shell wires up the DeviceBooks plugin and permissions', () => {
    expect(existsSync(resolve(root, 'android/app/src/main/java/com/bookish/app/DeviceBooksPlugin.java'))).toBe(true)

    const mainActivity = read('android/app/src/main/java/com/bookish/app/MainActivity.java')
    expect(mainActivity).toContain('registerPlugin(DeviceBooksPlugin.class)')

    const manifest = read('android/app/src/main/AndroidManifest.xml')
    expect(manifest).toContain('android.permission.MANAGE_EXTERNAL_STORAGE')
    expect(manifest).toContain('android.permission.READ_EXTERNAL_STORAGE')

    const plugin = read('android/app/src/main/java/com/bookish/app/DeviceBooksPlugin.java')
    expect(plugin).toContain('ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION')
    expect(plugin).toContain('.pdf')
    expect(plugin).toContain('.epub')

    const nuxtPlugin = read('plugins/device-library-sync.client.js')
    expect(nuxtPlugin).toContain('syncDeviceLibrary')
    expect(nuxtPlugin).toContain('isNativeCapacitorPlatform')
  })
})
