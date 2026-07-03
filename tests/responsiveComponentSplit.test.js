import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const exists = (path) => existsSync(resolve(root, path))

describe('responsive mobile component split', () => {
  test('major responsive surfaces have separate mobile and desktop components', () => {
    const surfaces = [
      ['Home', 'components/shared/HomeComp.vue', 'components/mobile/HomeMobile.vue', 'components/desktop/HomeDesktop.vue'],
      ['Settings', 'components/shared/SettingsComp.vue', 'components/mobile/SettingsMobile.vue', 'components/desktop/SettingsDesktop.vue'],
      ['Books', 'components/shared/BooksComp.vue', 'components/mobile/BooksMobile.vue', 'components/desktop/BooksDesktop.vue'],
      ['Series', 'components/shared/SeriesComp.vue', 'components/mobile/SeriesMobile.vue', 'components/desktop/SeriesDesktop.vue'],
      ['Playlists', 'components/shared/PlaylistComp.vue', 'components/mobile/PlaylistsMobile.vue', 'components/desktop/PlaylistsDesktop.vue'],
      ['Favourites', 'components/shared/FavouritesComp.vue', 'components/mobile/FavouritesMobile.vue', 'components/desktop/FavouritesDesktop.vue'],
      ['Profile', 'pages/profile.vue', 'components/mobile/ProfileMobile.vue', 'components/desktop/ProfileDesktop.vue'],
    ]

    expect(exists('components/shared/ResponsiveViewSwitch.vue')).toBe(true)
    expect(exists('components/mobile')).toBe(true)
    expect(exists('components/desktop')).toBe(true)
    expect(exists('components/shared')).toBe(true)

    for (const [name, wrapperPath, mobilePath, desktopPath] of surfaces) {
      expect(exists(mobilePath), `${name} mobile component`).toBe(true)
      expect(exists(desktopPath), `${name} desktop component`).toBe(true)

      const wrapper = read(wrapperPath)
      expect(wrapper, `${name} wrapper uses responsive switch`).toContain('<ResponsiveViewSwitch')
      expect(wrapper, `${name} wrapper mounts mobile view`).toContain(`<${name}Mobile />`)
      expect(wrapper, `${name} wrapper mounts desktop view`).toContain(`<${name}Desktop />`)
    }

    expect(exists('components/home')).toBe(false)
    expect(exists('components/settings')).toBe(false)
    expect(exists('components/books')).toBe(false)
    expect(exists('components/series')).toBe(false)
    expect(exists('components/playlists')).toBe(false)
    expect(exists('components/favourites')).toBe(false)
    expect(exists('components/profile')).toBe(false)

    const rootVueFiles = readdirSync(resolve(root, 'components'))
      .filter((entry) => entry.endsWith('.vue'))
    expect(rootVueFiles).toEqual([])
  })

  test('detail routes have dedicated mobile components instead of embedded mobile branches', () => {
    const detailSurfaces = [
      ['Book detail', 'pages/book/[id].vue', 'components/mobile/BookDetailMobile.vue'],
      ['Series detail', 'pages/serie/[id].vue', 'components/mobile/SeriesDetailMobile.vue'],
      ['Playlist detail', 'pages/playlist/[id].vue', 'components/mobile/PlaylistDetailMobile.vue'],
      ['Playlist detail alias', 'pages/playlists/[id].vue', 'components/mobile/PlaylistDetailMobile.vue'],
    ]

    for (const [name, pagePath, mobilePath] of detailSurfaces) {
      expect(exists(mobilePath), `${name} mobile component`).toBe(true)

      const page = read(pagePath)
      expect(page, `${name} page uses responsive switch`).toContain('<ResponsiveViewSwitch')
      expect(page, `${name} page mounts mobile detail`).toContain('<component :is="mobileDetailComponent"')
      expect(page, `${name} page does not import mobile nav directly`).not.toContain('MobileSettingsNav')
    }

    const bookPage = read('pages/book/[id].vue')
    const groupDetail = read('components/shared/BookGroupDetail.vue')

    expect(bookPage).not.toMatch(/mobile-book-|mobile-detail-|mobile-synopsis/)
    expect(groupDetail).not.toMatch(/@media \(max-width:\s*760px\)|detail-books-grid[\s\S]*grid-template-columns:\s*1fr/)
  })

  test('book form and reader routes have dedicated mobile page components', () => {
    const mobileSurfaces = [
      ['Add book', 'pages/add.vue', 'components/mobile/AddBookMobile.vue'],
      ['Edit book', 'pages/edit/[id].vue', 'components/mobile/EditBookMobile.vue'],
      ['Reader', 'pages/reader/[id].vue', 'components/mobile/ReaderMobile.vue'],
    ]

    for (const [name, pagePath, mobilePath] of mobileSurfaces) {
      expect(exists(mobilePath), `${name} mobile component`).toBe(true)

      const page = read(pagePath)
      expect(page, `${name} page uses responsive switch`).toContain('<ResponsiveViewSwitch')
      expect(page, `${name} page mounts mobile component`).toMatch(/<component[\s\S]*:is="mobile/)
      expect(page, `${name} page does not import mobile nav directly`).not.toContain('MobileSettingsNav')
    }

    const readerMobile = read('components/mobile/ReaderMobile.vue')
    expect(readerMobile).toContain('reader-mobile-topbar')
    expect(readerMobile).toContain('ri-headphone-fill')
    expect(readerMobile).toContain('reader-chapter-dock')
    expect(readerMobile).toContain('chapter-pill')
    expect(readerMobile).toContain('replaceBottomNav')
    expect(readerMobile).toContain('reader-media-sheet')
    expect(readerMobile).toContain('Switch narrator')
    expect(readerMobile).not.toContain('class="chapter-step"')
  })

  test('mobile reader dock transitions without moving the play button into the nav replacement', () => {
    const readerMobile = read('components/mobile/ReaderMobile.vue')
    const readerPage = read('pages/reader/[id].vue')

    expect(readerMobile).toContain('class="reader-chapter-dock"')
    expect(readerMobile).toContain('class="chapter-play"')
    expect(readerMobile).toContain('dockReplacingBottomNav')
    expect(readerMobile).toMatch(/\.reader-chapter-dock\s*\{[\s\S]*background:\s*var\(--mobile-reader-bg\)/)
    expect(readerMobile).toMatch(/\.chapter-play\s*\{[\s\S]*position:\s*fixed/)
    expect(readerMobile).toMatch(/\.reader-mobile-page\.replaceBottomNav\s+\.chapter-play\s*\{[\s\S]*bottom:/)
    const replacePlayRule = readerMobile.match(/\.reader-mobile-page\.replaceBottomNav\s+\.chapter-play\s*\{[^}]*\}/)?.[0] || ''
    expect(replacePlayRule).not.toContain('transform')

    expect(readerPage).toContain('@read-current-position="playFromCurrentPosition"')
    expect(readerPage).toContain('async function playFromCurrentPosition()')
    expect(readerPage).not.toContain('@read-current-position="requestReadCurrentPosition"')
  })

  test('reader route uses cached book metadata before waiting on a full library fetch', () => {
    const readerPage = read('pages/reader/[id].vue')
    const loadBookStart = readerPage.indexOf('async function loadBook')
    const loadBookEnd = readerPage.indexOf('watch(rawContent', loadBookStart)
    const loadBook = readerPage.slice(loadBookStart, loadBookEnd)

    expect(loadBook.indexOf('const cached = books.value.find')).toBeGreaterThan(-1)
    expect(loadBook.indexOf('const cached = books.value.find')).toBeLessThan(loadBook.indexOf('await fetchAllData()'))
    expect(loadBook).toContain('fetchAllData().then')
  })

  test('mobile read actions prewarm reader content before navigation', () => {
    const prewarm = read('composables/useReaderPrewarm.js')
    const mobileDetail = read('components/mobile/BookDetailMobile.vue')
    const readerPage = read('pages/reader/[id].vue')
    const loadBookStart = readerPage.indexOf('async function loadBook')
    const loadBookEnd = readerPage.indexOf('watch(rawContent', loadBookStart)
    const loadBook = readerPage.slice(loadBookStart, loadBookEnd)

    expect(prewarm).toContain('const readerContentCache = new Map()')
    expect(prewarm).toContain('prewarmReaderContent')
    expect(prewarm).toContain('getPrewarmedReaderContent')
    expect(mobileDetail).toContain('prewarmReaderContent(book.value.id)')
    expect(mobileDetail).toContain('router.push(`/reader/${book.value.id}`)')
    expect(readerPage).toContain('getPrewarmedReaderContent')
    expect(readerPage).toContain('applyStoredReaderContent')
    expect(loadBook.indexOf('getPrewarmedReaderContent(id)')).toBeGreaterThan(-1)
    expect(loadBook.indexOf('getPrewarmedReaderContent(id)')).toBeLessThan(loadBook.indexOf('await getBookContent(id)'))
  })

  test('mobile reader keeps PDF pages readable and top navigation pinned', () => {
    const readerMobile = read('components/mobile/ReaderMobile.vue')

    expect(readerMobile).toContain('mobilePdfZoom')
    expect(readerMobile).toContain(':zoom="mobilePdfZoom"')
    expect(readerMobile).toContain('reader-mobile-pdf')
    expect(readerMobile).toMatch(/\.reader-mobile-topbar\s*\{[\s\S]*position:\s*fixed/)
    expect(readerMobile).toMatch(/\.reader-mobile-content\.is-pdf-reader\s*\{[\s\S]*padding-top:/)
    expect(readerMobile).toMatch(/\.reader-mobile-pdf\s*:deep\(\.pdf-viewer\)\s*\{[\s\S]*overflow-x:\s*hidden/)
  })

  test('mobile reader mounts chapters progressively around the reading position', () => {
    const readerMobile = read('components/mobile/ReaderMobile.vue')
    const readerPage = read('pages/reader/[id].vue')

    expect(readerPage).toContain('const mobileChapterList = computed')
    expect(readerPage).toContain(':chapter-list="mobileChapterList"')
    expect(readerPage).toContain('@mount-section="mountSection"')
    expect(readerPage).toContain('initializeSectionMounting()')
    expect(readerMobile).toContain('data-section-placeholder')
    expect(readerMobile).toContain('mount-section')
    expect(readerMobile).not.toContain('content-visibility')
  })

  test('docked chapter pill sits flush with the screen bottom', () => {
    const readerMobile = read('components/mobile/ReaderMobile.vue')
    expect(readerMobile).toContain('translateY(calc(var(--bottom-nav-space) - env(safe-area-inset-bottom)))')
  })

  test('reader chrome follows the reader theme instead of hardcoded light colors', () => {
    const readerMobile = read('components/mobile/ReaderMobile.vue')

    expect(readerMobile).toContain('--mobile-reader-surface')
    expect(readerMobile).toMatch(/\.chapter-pill\s*\{[^}]*background:\s*var\(--mobile-reader-surface\)/)
    expect(readerMobile).toMatch(/\.chapter-play\s*\{[^}]*background:\s*var\(--mobile-reader-surface\)/)
    expect(readerMobile).toContain(':class="readerTheme"')
    expect(readerMobile).toContain('.reader-media-sheet.dark')
    expect(readerMobile).not.toMatch(/\.chapter-pill\s*\{[^}]*background:\s*#fff/)
  })

  test('docked chapter pill centres its title at full width with a larger font', () => {
    const readerMobile = read('components/mobile/ReaderMobile.vue')

    expect(readerMobile).toMatch(/\.reader-mobile-page\.replaceBottomNav\s+\.chapter-pill\s*\{[^}]*grid-template-columns:\s*0px minmax\(0, 1fr\) 0px/)
    expect(readerMobile).toMatch(/\.reader-mobile-page\.replaceBottomNav\s+\.reader-chapter-dock\s*\{[^}]*padding-right:\s*20px/)
    expect(readerMobile).toMatch(/\.reader-mobile-page\.replaceBottomNav\s+\.chapter-pill-title\s*\{[^}]*font-size:\s*16px/)
  })

  test('reader layout keeps desktop chrome out of the mobile reader', () => {
    const layout = read('layouts/reader.vue')

    expect(layout).toContain('<ResponsiveViewSwitch')
    expect(layout).toContain('<template #mobile>')
    expect(layout).toContain('class="reader-mobile-layout"')
    expect(layout).toMatch(/<template #desktop>[\s\S]*<Sidebar/)
    expect(layout).toMatch(/<template #desktop>[\s\S]*<PlayingBar/)
    expect(layout).toMatch(/@media \(max-width:\s*768px\)[\s\S]*:deep\(\.sidebar\)/)
    expect(layout).toMatch(/@media \(max-width:\s*768px\)[\s\S]*:deep\(\.playing-bar\)/)
    expect(layout).toMatch(/@media \(max-width:\s*768px\)[\s\S]*margin-left:\s*0/)
  })
})
