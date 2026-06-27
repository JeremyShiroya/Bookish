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
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_INDEX: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
}

function wordsToNumber(value: string) {
  const units: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
  }
  const tens: Record<string, number> = {
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
  }
  const normalized = value.toLowerCase().replace(/-/g, ' ').trim()
  if (/^\d+$/.test(normalized)) return Number(normalized)
  return normalized.split(/\s+/).reduce((total, part) => (
    total + (units[part] || tens[part] || 0)
  ), 0) || null
}

function formatDate(year: number, month?: number | null, day?: number | null) {
  if (!Number.isSafeInteger(year) || year <= 0) return null
  if (!month || month < 1 || month > 12) return String(year)
  if (!day || day < 1 || day > 31) return `${MONTHS[month - 1]} ${year}`
  return `${day} ${MONTHS[month - 1]} ${year}`
}

function parseYear(line: string) {
  const match = line.match(/\b(15|16|17|18|19|20)\d{2}\b/)
  return match ? Number(match[0]) : null
}

function extractPrimaryTitle(line: string) {
  const cleanedLine = line
    .replace(/<ref[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[^>]*\/>/gi, '')
  const link = cleanedLine.match(/\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/)
  const italic = cleanedLine.match(/''+([^'{}<>]{2,160}?)''+/)
  return (link?.[2] || link?.[1] || italic?.[1] || '')
    .replace(/<ref[\s\S]*?<\/ref>/gi, '')
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/\s*\([^)]*(?:novel|book)[^)]*\)\s*$/i, '')
    .replace(/\s*\/\s*.+$/, '')
    .trim()
}

function collectItalicTitles(value: string) {
  const seen = new Set<string>()
  return [...String(value || '').matchAll(/''+([^'{}<>|]{2,100}?)''+/g)]
    .map(match => match[1]
      .replace(/\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g, (_full, page, label) => label || page)
      .replace(/\s+/g, ' ')
      .trim())
    .filter((title) => {
      const key = normalize(title)
      if (!key || seen.has(key)) return false
      if (/^(newyorktimes|sundaytimes)$/i.test(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 6)
}

export function extractAuthorLeadFacts(wikitext = '') {
  const text = String(wikitext || '')
  let birthDate: string | null = null

  const templateDate = text.match(/\{\{\s*Birth date(?: and age)?\s*\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})/i)
  if (templateDate) {
    birthDate = formatDate(Number(templateDate[1]), Number(templateDate[2]), Number(templateDate[3]))
  }

  if (!birthDate) {
    const proseDate = text.match(/\bborn\s+([A-Z][a-z]+)\s+(\d{1,2}),\s+(\d{4})/i)
    if (proseDate) {
      birthDate = formatDate(Number(proseDate[3]), MONTH_INDEX[proseDate[1].toLowerCase()], Number(proseDate[2]))
    }
  }

  let minimumFullLengthBooks: number | null = null
  const minimumMatch = text.match(/\b(?:more than|over)\s+([a-z0-9 -]+?)\s+novels?\b/i)
  if (minimumMatch) {
    const amount = wordsToNumber(minimumMatch[1])
    if (amount) minimumFullLengthBooks = amount + 1
  }

  const lead = text.split(/^==/m)[0] || text
  const including = lead.match(/\bincluding\b([\s\S]*?)(?:\.|\n\n|$)/i)?.[1] || lead
  return {
    birthDate,
    minimumFullLengthBooks,
    notableWorks: collectItalicTitles(including),
  }
}

export function extractAuthorBibliographySummary(wikitext = '', asOfYear = new Date().getFullYear()) {
  const lines = String(wikitext || '').split(/\r?\n/)
  const sectionStart = lines.findIndex(line => {
    const match = line.match(/^==\s*([^=]+?)\s*==\s*$/)
    return !!match && WORKS_SECTION.test(match[1].trim())
  })

  if (sectionStart === -1) {
    return { fullLengthBooks: null, series: null, latestWork: null }
  }

  const titles = new Set<string>()
  const series = new Set<string>()
  let currentHeading = ''
  let currentSeries = ''
  let classifiedSectionSeen = false
  let latestWork: { title: string; year: number } | null = null

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
      currentSeries = isSeries && !excluded ? normalize(currentHeading.replace(/\([^)]*\)/g, '').replace(/\bseries\b/i, '')) : ''
      continue
    }

    if (!/^\s*\*/.test(line)) continue
    const excluded = EXCLUDED_WORK_HEADING.test(currentHeading)
    const isFullLength = SERIES_HEADING.test(currentHeading) || FULL_LENGTH_HEADING.test(currentHeading)
    if (!isFullLength || excluded) continue

    const title = extractPrimaryTitle(line)
    const key = normalize(title)
    if (!key) continue

    const year = parseYear(line)
    if (year && year > asOfYear) continue

    titles.add(key)
    if (currentSeries) series.add(currentSeries)

    if (year && year <= asOfYear && (!latestWork || year > latestWork.year)) {
      latestWork = { title, year }
    }
  }

  if (!classifiedSectionSeen) {
    return { fullLengthBooks: null, series: null, latestWork: null }
  }

  return {
    fullLengthBooks: titles.size,
    series: series.size,
    latestWork: latestWork?.title ?? null,
  }
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
