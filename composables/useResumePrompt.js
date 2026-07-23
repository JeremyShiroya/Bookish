// "You've moved to a different page" — should the reader be asked where to
// resume narration from?
//
// Pulled out of ReaderMobile so the rule can be tested directly: the version
// that lived inline compared the chunk distance against a whole SECTION's chunk
// count, a threshold nothing inside a chapter can ever exceed, so turning pages
// — the ordinary case — never asked anything.

export function shouldAskWhereToResume({
  paused,
  shownChunk,
  shownPage = null,
  playingPage = null,
  shownSection = null,
  playingSection = null,
} = {}) {
  // Only on resuming from a pause: starting fresh has nothing to resume from,
  // and interrupting mid-playback would be asking about a move nobody made.
  if (!paused) return false
  if (shownChunk === null || shownChunk === undefined || shownChunk < 0) return false

  // Pages are what a reader turns, so pages are what "moved away" means.
  if (Number.isFinite(shownPage) && Number.isFinite(playingPage)) {
    return shownPage !== playingPage
  }

  // The page map is measured in the background, so early on there may be no
  // page numbers yet. Chapters are the coarser fallback.
  if (Number.isFinite(shownSection) && Number.isFinite(playingSection)) {
    return shownSection !== playingSection
  }

  return false
}
