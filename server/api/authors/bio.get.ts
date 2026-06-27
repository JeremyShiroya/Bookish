import { defineEventHandler, getQuery, createError } from 'h3'
import {
  extractAuthorBibliographySummary,
  extractAuthorLeadFacts,
  selectAuthorCandidate,
} from '../../utils/authorEnrichment'
import { verifyAuthorDetails } from '../../utils/aiAuthorVerifier'

const JSON_HEADERS = {
  'User-Agent': 'Bookish/1.0 (author info lookup; contact: local-app)',
  'Accept': 'application/json',
}

interface AuthorDetails {
  bio: string | null
  birthDate: string | null
  deathDate: string | null
  nationality: string | null
  notableWorks: string[]
  validatedBooksCount: number | null
  validatedSeriesCount: number | null
  latestWork: string | null
  spouseName: string | null
  hasChildren: boolean | null
  childrenCount: number | null
  source: string
  version: number
  aiVerified?: boolean
  aiRejected?: boolean
  aiProvider?: string
  aiWarnings?: string[]
}

async function fetchWikidataDetails(name: string): Promise<Partial<AuthorDetails> | null> {
  try {
    const search: any = await $fetch(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&format=json&origin=*&type=item&limit=5`,
      { headers: JSON_HEADERS },
    )
    const candidates = (search.search || []).slice(0, 5)
    // Prefer results whose description mentions "author" or "writer" or "novelist"
    const id = selectAuthorCandidate(candidates, name)?.id
    if (!id) return null

    const entityRes: any = await $fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(id)}&props=claims&languages=en&format=json&origin=*`,
      { headers: JSON_HEADERS },
    )
    const entity = entityRes.entities?.[id]
    if (!entity) return null

    const claims = entity.claims || {}

    const getValue = (prop: string) => claims[prop]?.[0]?.mainsnak?.datavalue?.value

    const birthDateRaw = getValue('P569')
    const deathDateRaw = getValue('P570')
    const citizenshipId = getValue('P27')?.id
    const spouseId = getValue('P26')?.id
    const childrenCount = claims['P1971']?.[0]?.mainsnak?.datavalue?.value?.amount

    // Resolve nationality and spouse labels in one request
    let nationality: string | null = null
    let spouseName: string | null = null
    const labelIds = [citizenshipId, spouseId].filter(Boolean)
    if (labelIds.length) {
      try {
        const labelRes: any = await $fetch(
          `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(labelIds.join('|'))}&props=labels&languages=en&format=json&origin=*`,
          { headers: JSON_HEADERS },
        )
        if (citizenshipId) nationality = labelRes.entities?.[citizenshipId]?.labels?.en?.value || null
        if (spouseId) spouseName = labelRes.entities?.[spouseId]?.labels?.en?.value || null
      } catch {}
    }

    const formatDate = (raw: any): string | null => {
      if (!raw?.time) return null
      // Wikidata time format: +YYYY-MM-DDT00:00:00Z
      const match = raw.time.match(/[+-](\d{4})-(\d{2})-(\d{2})/)
      if (!match) return null
      const [, year, month, day] = match
      if (month === '00' || day === '00') return year
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      const mIdx = parseInt(month, 10) - 1
      return day === '01' ? `${months[mIdx]} ${year}` : `${parseInt(day, 10)} ${months[mIdx]} ${year}`
    }

    return {
      birthDate: formatDate(birthDateRaw),
      deathDate: formatDate(deathDateRaw),
      nationality,
      spouseName,
      hasChildren: childrenCount !== undefined ? true : null,
      childrenCount: childrenCount !== undefined ? Math.abs(parseInt(childrenCount, 10)) : null,
    }
  } catch {
    return null
  }
}

async function fetchWikipediaBio(
  name: string,
  knownBooks: string[],
): Promise<{
  bio: string
  birthDate: string | null
  notableWorks: string[]
  latestWork: string | null
  validatedBooksCount: number | null
  validatedSeriesCount: number | null
} | null> {
  const titles = [name, `${name} (writer)`, `${name} (author)`, `${name} (novelist)`]
  for (const title of titles) {
    try {
      const summary: any = await $fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/\s+/g, '_'))}`,
        { headers: JSON_HEADERS },
      )
      if (summary?.type === 'disambiguation') continue
      const bio = summary?.extract
      if (!bio || bio.length < 40) continue
      const identityText = `${summary?.description || ''} ${bio.slice(0, 240)}`
      const mentionsWriting = /author|writer|novelist|poet|playwright|essayist|biographer/i.test(identityText)
      const mentionsKnownBook = knownBooks.some(book => (
        book.length > 2 && bio.toLowerCase().includes(book.toLowerCase())
      ))
      if (!mentionsWriting && !mentionsKnownBook) continue

      // Try to get notable works from the full page
      let notableWorks: string[] = []
      let latestWork: string | null = null
      let birthDate: string | null = null
      let validatedBooksCount: number | null = null
      let validatedSeriesCount: number | null = null
      try {
        const pageRes: any = await $fetch(
          `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title.replace(/\s+/g, '_'))}&prop=revisions&rvprop=content&rvslots=main&format=json&origin=*`,
          { headers: JSON_HEADERS },
        )
        const page = Object.values(pageRes.query?.pages || {})[0] as any
        const wikitext = page?.revisions?.[0]?.slots?.main?.['*'] || ''
        const leadFacts = extractAuthorLeadFacts(wikitext)
        const bibliography = extractAuthorBibliographySummary(wikitext)
        birthDate = leadFacts.birthDate
        const countCandidates = [
          bibliography.fullLengthBooks,
          leadFacts.minimumFullLengthBooks,
        ].filter((value): value is number => Number.isSafeInteger(value) && value > 0)
        validatedBooksCount = countCandidates.length ? Math.max(...countCandidates) : null
        validatedSeriesCount = bibliography.series
        latestWork = bibliography.latestWork
        // Extract notable works from the infobox. The value often spans
        // multiple lines and is wrapped in {{plainlist}}/{{flatlist}} templates,
        // so capture until the next infobox parameter and pull link/italic titles.
        const notableMatch = wikitext.match(/\|\s*notable_works?\s*=([\s\S]*?)(?=\n\s*\|[a-z_ ]+=|\n\}\})/i)
        if (notableMatch) {
          const section = notableMatch[1]
          const linkTitles = [...section.matchAll(/\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g)]
            .map((m: RegExpMatchArray) => m[1].trim())
          const italicTitles = [...section.matchAll(/''+([^'{}<>|]{2,80}?)''+/g)]
            .map((m: RegExpMatchArray) => m[1].trim())
          const plain = section
            .replace(/\{\{[^}]*\}\}/g, ' ')
            .split(/\n|,|;|\*/)
            .map((s: string) => s.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1').replace(/'''|''|#/g, '').trim())
          const candidates = linkTitles.length ? linkTitles : (italicTitles.length ? italicTitles : plain)
          const seen = new Set<string>()
          notableWorks = candidates
            .filter((s: string) => {
              const key = s.toLowerCase()
              if (s.length < 2 || s.length > 80 || seen.has(key)) return false
              seen.add(key)
              return true
            })
            .slice(0, 6)
        }
        if (!notableWorks.length) {
          notableWorks = leadFacts.notableWorks
        }
      } catch {}

      return {
        bio: bio.slice(0, 600),
        birthDate,
        notableWorks,
        latestWork,
        validatedBooksCount,
        validatedSeriesCount,
      }
    } catch {}
  }
  return null
}

async function fetchOpenLibraryBio(
  name: string,
  knownBooks: string[],
): Promise<{
  bio: string | null
  topWork: string | null
} | null> {
  try {
    const data: any = await $fetch(
      `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(name)}&limit=5`,
      { headers: JSON_HEADERS },
    )
    const match = selectAuthorCandidate(data.docs || [], name, knownBooks)
    if (!match) return null

    const topWork = match.top_work || null

    const authorKey = match.key?.replace('/authors/', '')
    let bio: string | null = null
    if (authorKey) {
      try {
        const authorRes: any = await $fetch(
          `https://openlibrary.org/authors/${authorKey}.json`,
          { headers: JSON_HEADERS },
        )
        bio = typeof authorRes.bio === 'string'
          ? authorRes.bio
          : authorRes.bio?.value || null
      } catch {}
    }

    return {
      bio: bio ? bio.slice(0, 600) : null,
      topWork,
    }
  } catch {
    return null
  }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const name = query.name?.toString().trim()
  let knownBooks: string[] = []
  try {
    const parsed = JSON.parse(query.books?.toString() || '[]')
    if (Array.isArray(parsed)) {
      knownBooks = parsed.map(value => String(value || '').trim()).filter(Boolean).slice(0, 5)
    }
  } catch {}

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Author name is required' })
  }
  if (name.length > 200) {
    throw createError({ statusCode: 400, statusMessage: 'Author name too long' })
  }

  try {
    const [wikiResult, wikidataResult, openLibResult] = await Promise.allSettled([
      fetchWikipediaBio(name, knownBooks),
      fetchWikidataDetails(name),
      fetchOpenLibraryBio(name, knownBooks),
    ])

    const wiki = wikiResult.status === 'fulfilled' ? wikiResult.value : null
    const wikidata = wikidataResult.status === 'fulfilled' ? wikidataResult.value : null
    const openLib = openLibResult.status === 'fulfilled' ? openLibResult.value : null

    const bio = wiki?.bio || openLib?.bio || null
    // Wikipedia infoboxes often omit notable_works; fall back to the
    // author's most popular work from Open Library so the field still fills.
    const notableWorks = wiki?.notableWorks?.length
      ? wiki.notableWorks
      : (openLib?.topWork ? [openLib.topWork] : [])
    const details: AuthorDetails = {
      bio,
      birthDate: wikidata?.birthDate || wiki?.birthDate || null,
      deathDate: wikidata?.deathDate || null,
      nationality: wikidata?.nationality || null,
      notableWorks,
      validatedBooksCount: wiki?.validatedBooksCount ?? null,
      validatedSeriesCount: wiki?.validatedSeriesCount ?? null,
      latestWork: wiki?.latestWork || null,
      spouseName: wikidata?.spouseName || null,
      hasChildren: wikidata?.hasChildren || null,
      childrenCount: wikidata?.childrenCount || null,
      source: bio ? (wiki?.bio ? 'wikipedia' : 'openlibrary') : 'none',
      version: 6,
    }

    return await verifyAuthorDetails(name, knownBooks, details)
  } catch (error: any) {
    console.error('[Author Bio] Failed:', error)
    return {
      bio: null, birthDate: null, deathDate: null, nationality: null,
      notableWorks: [], validatedBooksCount: null, validatedSeriesCount: null, latestWork: null,
      spouseName: null, hasChildren: null, childrenCount: null, source: 'none',
      version: 6,
    }
  }
})
