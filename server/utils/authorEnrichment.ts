function normalize(value?: unknown) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function candidateNames(candidate: any) {
  return [
    candidate?.name,
    candidate?.label,
    ...(Array.isArray(candidate?.alternate_names) ? candidate.alternate_names : []),
  ].filter(Boolean)
}

function knownWorks(candidate: any) {
  return [
    candidate?.top_work,
    ...(Array.isArray(candidate?.works) ? candidate.works : []),
  ].map(normalize).filter(Boolean)
}

export function selectAuthorCandidate<T extends Record<string, any>>(
  candidates: T[] = [],
  name: string,
  books: string[] = [],
): T | null {
  const targetName = normalize(name)
  const targetBooks = books.map(normalize).filter(Boolean)
  if (!targetName) return null

  const ranked = candidates
    .map((candidate) => {
      const names = candidateNames(candidate).map(normalize)
      const exactName = names.includes(targetName)
      const compatibleName = exactName || names.some((value) => (
        value.includes(targetName) || targetName.includes(value)
      ))
      if (!compatibleName) return { candidate, score: -1 }

      let score = exactName ? 100 : 45
      const works = knownWorks(candidate)
      if (targetBooks.some((book) => works.some((work) => (
        book === work || book.includes(work) || work.includes(book)
      )))) {
        score += 60
      }
      if (/author|writer|novelist|poet|playwright/i.test(candidate.description || '')) score += 15
      return { candidate, score }
    })
    .filter(entry => entry.score >= 0)
    .sort((a, b) => b.score - a.score)

  return ranked[0]?.candidate ?? null
}

export function countDistinctAuthorSeries(works: any[] = []) {
  const names = new Set<string>()

  for (const work of works) {
    const series = Array.isArray(work?.series)
      ? work.series
      : (work?.series ? [work.series] : [])
    for (const item of series) {
      const name = typeof item === 'string' ? item : item?.name
      const key = normalize(name)
      if (key) names.add(key)
    }
  }

  return names.size
}

const WORKS_SECTION = /^(?:writing|bibliography|works|published works|publications)$/i
const EXCLUDED_WORK_HEADING = /\b(?:short stor|novella|antholog|collection|poem|essay|nonfiction|non-fiction|adaptation|television|film|play|edited|audio|comic|graphic)\b/i
const FULL_LENGTH_HEADING = /\bnovels?\b/i
const SERIES_HEADING = /\bseries\b/i

function extractPrimaryTitle(line: string) {
  const link = line.match(/\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/)
  const italic = line.match(/''+([^'{}<>]{2,160}?)''+/)
  return (link?.[2] || link?.[1] || italic?.[1] || '')
    .replace(/<ref[\s\S]*?<\/ref>/gi, '')
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/\s*\([^)]*(?:novel|book)[^)]*\)\s*$/i, '')
    .replace(/\s*\/\s*.+$/, '')
    .trim()
}

export function extractValidatedAuthorTotals(wikitext = '') {
  const lines = String(wikitext || '').split(/\r?\n/)
  const sectionStart = lines.findIndex(line => {
    const match = line.match(/^==\s*([^=]+?)\s*==\s*$/)
    return !!match && WORKS_SECTION.test(match[1].trim())
  })

  if (sectionStart === -1) {
    return { fullLengthBooks: null, series: null }
  }

  const titles = new Set<string>()
  const series = new Set<string>()
  let currentHeading = ''
  let currentSeries = ''
  let classifiedSectionSeen = false

  for (let index = sectionStart + 1; index < lines.length; index += 1) {
    const line = lines[index]
    const headingLine = line.replace(/<[^>]+>/g, '')
    const heading = headingLine.match(/^(={2,})\s*([^=]+?)\s*\1\s*$/)
    if (heading) {
      if (heading[1].length <= 2) break
      currentHeading = heading[2].trim()
      const excluded = EXCLUDED_WORK_HEADING.test(currentHeading)
      const isSeries = SERIES_HEADING.test(currentHeading)
      const isFullLength = isSeries || FULL_LENGTH_HEADING.test(currentHeading)
      classifiedSectionSeen ||= isFullLength && !excluded
      currentSeries = isSeries && !excluded ? normalize(currentHeading) : ''
      continue
    }

    if (!/^\s*\*/.test(line)) continue
    const excluded = EXCLUDED_WORK_HEADING.test(currentHeading)
    const isFullLength = SERIES_HEADING.test(currentHeading) || FULL_LENGTH_HEADING.test(currentHeading)
    if (!isFullLength || excluded) continue

    const title = extractPrimaryTitle(line)
    const key = normalize(title)
    if (!key) continue
    titles.add(key)
    if (currentSeries) series.add(currentSeries)
  }

  if (!classifiedSectionSeen) {
    return { fullLengthBooks: null, series: null }
  }
  return {
    fullLengthBooks: titles.size,
    series: series.size,
  }
}
