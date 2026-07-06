// Shared placeholder cover so a missing / dead / hotlink-blocked cover URL
// never shows the browser's broken-image icon — it degrades to a clean
// branded placeholder instead.

const PLACEHOLDER_COLORS = ['#8A2BE2', '#6A0DAD', '#2f7d62', '#b45309', '#2563eb']

export function coverPlaceholder(title) {
  const safeTitle = String(title || 'Book')
  const hash = [...safeTitle].reduce((total, c) => total + c.charCodeAt(0), 0)
  const color = PLACEHOLDER_COLORS[hash % PLACEHOLDER_COLORS.length]
  const initial = safeTitle.trim()[0]?.toUpperCase() || '?'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="${color}"/><text x="100" y="160" font-family="serif" font-size="110" fill="rgba(255,255,255,.5)" text-anchor="middle" dominant-baseline="middle">${initial}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export function isPlaceholderCover(value) {
  return !value || String(value).startsWith('data:image/svg+xml')
}

// Swap a broken <img> to the placeholder once (guarding against loops if the
// placeholder itself somehow errored).
export function onCoverError(event, title) {
  const img = event?.target
  if (!img || img.dataset.coverFallbackApplied) return
  img.dataset.coverFallbackApplied = '1'
  img.src = coverPlaceholder(title)
}
