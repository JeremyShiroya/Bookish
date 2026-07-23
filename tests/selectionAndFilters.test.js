import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { useMultiSelect } from '../composables/useMultiSelect.js'
import { shouldAskWhereToResume } from '../composables/useResumePrompt.js'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')

describe('multi-select', () => {
  test('a long press starts the mode with that item already picked', () => {
    const selection = useMultiSelect()
    expect(selection.selectionMode.value).toBe(false)

    selection.start('a')
    expect(selection.selectionMode.value).toBe(true)
    expect(selection.isSelected('a')).toBe(true)
    expect(selection.selectedCount.value).toBe(1)
  })

  test('deselecting the last item ends the mode on its own', () => {
    const selection = useMultiSelect()
    selection.start('a')
    selection.toggle('b')
    expect(selection.selectedCount.value).toBe(2)

    selection.toggle('a')
    expect(selection.selectionMode.value).toBe(true)
    selection.toggle('b')
    // No separate "done" button to hunt for, and no way to sit in a mode with
    // nothing selected.
    expect(selection.selectionMode.value).toBe(false)
    expect(selection.selectedCount.value).toBe(0)
  })

  test('ids compare across string and number, as they arrive from storage', () => {
    const selection = useMultiSelect()
    selection.start(7)
    expect(selection.isSelected('7')).toBe(true)
    selection.toggle('7')
    expect(selection.selectedCount.value).toBe(0)
  })

  test('a bulk delete takes its ticks with it', () => {
    const selection = useMultiSelect()
    selection.start('a')
    selection.toggle('b')

    selection.retain(['b'])
    expect(selection.selectedCount.value).toBe(1)
    expect(selection.isSelected('a')).toBe(false)

    selection.retain([])
    expect(selection.selectionMode.value).toBe(false)
  })
})

describe('selection wiring', () => {
  test('the books toolbar swaps its view toggle for the bulk actions', () => {
    const books = read('components/mobile/BooksMobile.vue')
    expect(books).toContain('SelectionActionsBar')
    // The view chips are the thing that steps aside — not something rendered
    // alongside, which would leave two competing toolbars.
    expect(books).toMatch(/<SelectionActionsBar[\s\S]*?v-if="selectionMode"[\s\S]*?<div\s+v-else\s+class="view-chips"/)
    for (const action of ['favourite', 'playlist', 'hide', 'delete']) {
      expect(books, action).toContain(`key: '${action}'`)
    }
  })

  test('a selected card hides its own action row', () => {
    const card = read('components/shared/LibraryBookCard.vue')
    // Otherwise the per-card buttons compete with the bulk actions that just
    // appeared in the toolbar.
    expect(card).toMatch(/\.library-book-card\.selectable \.card-actions[\s\S]*?display:\s*none/)
    expect(card).toContain('select-tick')
    expect(card).toContain("emit('toggle-select', book)")
  })

  test('a tap during selection picks the item instead of opening it', () => {
    expect(read('components/shared/LibraryBookCard.vue'))
      .toMatch(/if \(props\.selectable\) emit\('toggle-select', props\.book\)/)
    expect(read('components/shared/SeriesCollageCard.vue'))
      .toMatch(/if \(props\.selectable\) emit\("toggle-select", props\.series\)/)
  })

  test('the playlists toolbar keeps its filter and puts actions at the right edge', () => {
    const playlists = read('components/mobile/PlaylistsMobile.vue')
    expect(playlists).toContain('LibraryControlsRow')
    expect(playlists).toContain('#actions')
    expect(playlists).toContain('SelectionActionsBar')
  })

  test('bulk delete and bulk playlist reuse the single-item sheets', () => {
    // A second near-copy of a delete warning is the thing that drifts from the
    // original.
    expect(read('components/shared/DeleteConfirmModal.vue')).toContain('isBulk')
    expect(read('components/shared/PlaylistDeleteModal.vue')).toContain('isBulk')
    expect(read('components/shared/AddToPlaylistModal.vue')).toContain('targetBooks')
  })
})

describe('page filters', () => {
  test('the shared controls row drives its sections from data', () => {
    const row = read('components/shared/LibraryControlsRow.vue')
    expect(row).toContain('resolvedSections')
    expect(row).toContain('builtInFilters')
    expect(row).toContain('hideView')
    // The dot means "you are not seeing everything", so it tracks every section.
    expect(row).toMatch(/hasActiveFilter = computed\(\(\) => resolvedSections\.value\.some/)
  })

  test('series filters by name, status and how much of it is collected', () => {
    const series = read('components/mobile/SeriesMobile.vue')
    expect(series).toContain('LibraryControlsRow')
    expect(series).toContain(':built-in-filters="false"')
    for (const key of ["key: 'sort'", "key: 'status'", "key: 'collected'"]) {
      expect(series, key).toContain(key)
    }
    expect(series).toContain('Books collected')
    // A series with no known total is neither complete nor incomplete, so it
    // answers neither filter rather than being guessed at.
    expect(series).toMatch(/if \(!Number\.isFinite\(total\) \|\| total <= 0\) return 'unknown'/)
  })

  test('playlists filter on what a playlist actually has', () => {
    const playlists = read('components/mobile/PlaylistsMobile.vue')
    expect(playlists).toContain("key: 'sort'")
    expect(playlists).toContain("key: 'contents'")
    // Reading status belongs to books, not to the collection holding them.
    expect(playlists).not.toContain("key: 'status'")
  })
})

describe('resume-where prompt', () => {
  test('turning a page while paused asks', () => {
    expect(shouldAskWhereToResume({
      paused: true, shownChunk: 40, shownPage: 13, playingPage: 12,
    })).toBe(true)
  })

  test('staying on the narrated page does not ask', () => {
    expect(shouldAskWhereToResume({
      paused: true, shownChunk: 40, shownPage: 12, playingPage: 12,
    })).toBe(false)
  })

  test('a page turn inside one chapter still counts as a move', () => {
    // The old rule compared chunk distance against a whole section's chunk
    // count, so nothing short of changing chapter could ever trigger it — which
    // is why the prompt never appeared.
    expect(shouldAskWhereToResume({
      paused: true, shownChunk: 41, shownPage: 14, playingPage: 13,
      shownSection: 0, playingSection: 0,
    })).toBe(true)
  })

  test('without a measured page map it falls back to chapters', () => {
    expect(shouldAskWhereToResume({
      paused: true, shownChunk: 40, shownSection: 3, playingSection: 1,
    })).toBe(true)
    expect(shouldAskWhereToResume({
      paused: true, shownChunk: 40, shownSection: 1, playingSection: 1,
    })).toBe(false)
  })

  test('it never interrupts playback, only a resume', () => {
    expect(shouldAskWhereToResume({
      paused: false, shownChunk: 40, shownPage: 99, playingPage: 1,
    })).toBe(false)
  })

  test('no known position means no question', () => {
    expect(shouldAskWhereToResume({ paused: true, shownChunk: null })).toBe(false)
  })
})

describe('listen view tracks narration on open', () => {
  const reader = read('components/mobile/ReaderMobile.vue')

  test('the offset is recomputed when Listen opens', () => {
    // Opening Listen changes none of the offset watcher's sources, so without
    // this the panel appeared parked at the top of the page mid-narration.
    expect(reader).toContain('syncListenOffset')
    expect(reader).toMatch(/watch\(readerMode, \(mode\) => \{\s*if \(mode === "listen"\) syncListenOffset/)
  })

  test('clearing the element refs happens in the same watcher that measures them', () => {
    // A separate watcher wiped the refs after this one had yielded on
    // nextTick — the offset fell back to 0, hence "waits, then jumps".
    expect(reader).not.toMatch(/watch\(listenChunks, \(\) => \{\s*listenChunkEls = \[\];\s*\}\)/)
    expect(reader).toContain('resetEls')
  })
})

describe('small fixes', () => {
  test('the dark reader lifts its selected mode off the page', () => {
    const reader = read('components/mobile/ReaderMobile.vue')
    // #27262d on #18171c is barely a shade — the selection was invisible.
    expect(reader).toMatch(/\.reader-mobile-page\.dark \.reader-mode-toggle button\.active/)
  })

  test('restore wears the same treatment as every other card action', () => {
    const card = read('components/shared/LibraryBookCard.vue')
    const rule = card.match(/\.action-button\.restore \{[^}]*\}/)?.[0] || ''
    expect(rule).not.toContain('--color-brand-primary')
  })

  test('the playlist page keeps its two actions behind one overflow button', () => {
    const playlist = read('components/mobile/PlaylistDetailMobile.vue')
    expect(playlist).toContain('ri-more-2-fill')
    expect(playlist).toContain('more-menu')
    expect(playlist).toContain('Playlist options')
  })

  test('home search updates on every keystroke, not every word', () => {
    const home = read('components/mobile/HomeMobile.vue')
    // v-model suppresses input events while an IME composes, and Gboard treats
    // each word as one composition — so results only landed on the space bar.
    expect(home).toContain('@input="homeSearch = $event.target.value"')
    expect(home).not.toMatch(/v-model="homeSearch"/)
  })
})
