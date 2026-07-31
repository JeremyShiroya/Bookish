// Ask a language model to ENUMERATE a series — "what is book #31 of the Prey
// series called?" — when the Goodreads series page cannot answer.
//
// WHY THIS EXISTS: the per-book metadata providers (Google Books, Open Library,
// Kobo, Internet Archive) index books by their real titles, so they cannot be
// asked for "book 31 of this series" — knowing the title IS the question. Until
// now the Goodreads series page was the only source that could enumerate a
// series in order, which made it a single point of failure: when Goodreads
// rate-limits a device (it answers HTTP 202 anti-bot stubs), later installments
// stayed blank forever no matter how many times the reader pressed search.
//
// A model is the second thing that can answer that question, because series
// orderings are well represented in its training data.
//
// THE SAFETY RULE: the model is a TITLE GENERATOR, never a source of truth.
// Nothing it says is written to the library. Its proposed titles are handed to
// the existing cross-checked metadata pipeline, and only what those real
// providers confirm — with the provider's own cover, author and year — is ever
// stored. A hallucinated title costs one wasted lookup, not a corrupt record.
// This module therefore only PROPOSES; useSeriesSuggestions does the verifying.
//
// Isomorphic on purpose (plain fetch + JSON, no Node built-ins) so it runs both
// in the Nitro server and, on native, directly in the WebView — exactly like
// goodreadsScraper's provider functions.

type FetchLike = typeof fetch

export type AiSeriesProvider = 'gemini' | 'groq'

export type AiSeriesConfig = {
  provider: AiSeriesProvider
  apiKey: string
  model: string
}

// One installment as the model proposed it. `title` is a CANDIDATE awaiting
// verification — never trusted enough to store on its own.
export type AiSeriesBook = {
  installment: number
  title: string
  year: number | null
}

export type AiSeriesOptions = {
  seriesName: string
  author?: string
  // Installments already resolved from the roster: { 16: 'Broken Prey', ... }.
  // These are the anchors the model's answer is checked against.
  anchors?: Record<number, string>
  // The numbers we actually need. Empty means "the whole series".
  missing?: number[]
  env?: Record<string, string | undefined>
  fetchFn?: FetchLike
  config?: AiSeriesConfig | null
}

// Evergreen alias on purpose. A pinned version silently retires — Google
// answers 404 "no longer available to new users" for gemini-2.5-flash on any
// recently issued key, which made this feature look like it had no knowledge
// when it was never reaching a model at all.
const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest'
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile'

// How many anchors must come back right before we believe anything else the
// model said. Series orderings are memorised as a unit: a model that misplaces
// books it should know is reconstructing rather than recalling, and the rest of
// its answer cannot be trusted either.
const ANCHOR_AGREEMENT_RATIO = 0.6
// Never ask for an unbounded list — a runaway answer is a sign of trouble.
const MAX_PROPOSED_BOOKS = 60

const compact = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim()

const normalize = (value: unknown) => compact(value)
  .normalize('NFKD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '')

// Same provider-selection rules as the metadata verifier, so one setting
// (BOOKISH_AI_PROVIDER / the *_API_KEY vars) governs every AI feature.
export function resolveAiSeriesConfig(env: Record<string, string | undefined> = {}): AiSeriesConfig | null {
  return resolveAiSeriesConfigs(env)[0] || null
}

// Every provider that has a key, preferred one first. When two are configured
// the second is a genuine fallback rather than a spare: a provider that is out
// of quota, rate-limited, or simply does not know a series returns nothing, and
// a series left blank because the FIRST provider was unavailable is the exact
// failure this feature exists to remove. Both are equally safe to consult,
// since nothing either proposes is stored without provider confirmation.
export function resolveAiSeriesConfigs(env: Record<string, string | undefined> = {}): AiSeriesConfig[] {
  const requested = compact(env.BOOKISH_AI_PROVIDER).toLowerCase()
  if (requested === 'off' || requested === 'none' || requested === 'false') return []

  const geminiKey = env.GEMINI_API_KEY || env.GOOGLE_AI_API_KEY
  const groqKey = env.GROQ_API_KEY

  const gemini: AiSeriesConfig | null = geminiKey
    ? { provider: 'gemini', apiKey: geminiKey, model: compact(env.GEMINI_MODEL) || DEFAULT_GEMINI_MODEL }
    : null
  const groq: AiSeriesConfig | null = groqKey
    ? { provider: 'groq', apiKey: groqKey, model: compact(env.GROQ_MODEL) || DEFAULT_GROQ_MODEL }
    : null

  // An explicit choice leads; the other still stands by.
  const ordered = requested === 'groq' ? [groq, gemini] : [gemini, groq]
  return ordered.filter((config): config is AiSeriesConfig => !!config)
}

// The prompt leans on two things that keep a model honest: it is told the books
// we ALREADY know (so it must reproduce a verifiable spine, and we can catch it
// when it doesn't), and it is told explicitly that omitting an uncertain entry
// is the correct move. Asking for a year as well gives the verification step a
// second axis to check against.
export function buildSeriesOrderPrompt({ seriesName, author, anchors = {}, missing = [] }: {
  seriesName: string
  author?: string
  anchors?: Record<number, string>
  missing?: number[]
}) {
  const knownLines = Object.entries(anchors)
    .map(([installment, title]) => [Number(installment), compact(title)] as const)
    .filter(([installment, title]) => Number.isFinite(installment) && !!title)
    .sort((a, b) => a[0] - b[0])
    .map(([installment, title]) => `  ${installment}. ${title}`)

  const wanted = (missing || []).filter((n) => Number.isSafeInteger(n) && n >= 1).sort((a, b) => a - b)

  return `List the books of a novel series in publication order for a personal library app.

Series: ${seriesName}
Author: ${author || 'unknown'}

${knownLines.length ? `Books already confirmed (these MUST appear at these exact numbers):\n${knownLines.join('\n')}` : 'No confirmed books are available.'}

${wanted.length ? `Numbers still needed: ${wanted.join(', ')}` : 'Return the complete series.'}

Rules:
- Return only JSON of the shape {"books":[{"installment":1,"title":"...","year":1989}]}.
- installment is the book's number in the series; title is the book's real published title WITHOUT the series name or number.
- year is the first publication year, or null if you are unsure.
- Reproduce the confirmed books above at their given numbers. If you believe one is wrong, still use the number given.
- Include ONLY main numbered entries. Exclude novellas, short stories, box sets, omnibus editions and companion books.
- If you are not confident a numbered book exists, OMIT it. An incomplete list is correct; a guessed title is not.
- Never invent a title to fill a gap.`
}

function parseJsonObject(text: string) {
  const cleaned = compact(text)
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    return null
  }
}

// Strip the series name / number decoration models like to add back on, so the
// title we search providers for is the bare published title.
export function cleanProposedTitle(title: unknown, seriesName?: string) {
  let text = compact(title)
  if (!text) return ''
  // "Ocean Prey (Prey, #31)" / "Ocean Prey (A Prey Novel Book 31)"
  text = text.replace(/\s*[([][^)\]]*#?\s*\d+(?:\.\d+)?\s*[)\]]\s*$/, '').trim()
  text = text.replace(/\s*[([][^)\]]*\b(?:series|novel|book)\b[^)\]]*[)\]]\s*$/i, '').trim()
  const series = compact(seriesName)
  if (series) {
    // "Prey #31: Ocean Prey" → "Ocean Prey"
    const escaped = series.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    text = text.replace(new RegExp(`^${escaped}\\s*#?\\d*\\s*[:\\-–]\\s*`, 'i'), '').trim()
  }
  return text.replace(/^["'“”]|["'“”]$/g, '').trim()
}

// Normalize whatever the model returned into clean, de-duplicated entries.
export function parseSeriesOrderPayload(payload: any, seriesName?: string): AiSeriesBook[] {
  const raw = Array.isArray(payload?.books) ? payload.books : []
  const seen = new Set<number>()
  const books: AiSeriesBook[] = []

  for (const entry of raw) {
    const installment = Number(entry?.installment)
    if (!Number.isSafeInteger(installment) || installment < 1) continue
    if (seen.has(installment)) continue

    const title = cleanProposedTitle(entry?.title, seriesName)
    if (!title) continue
    // A "title" that is just the series name carries no information.
    if (seriesName && normalize(title) === normalize(seriesName)) continue

    const yearValue = Number(entry?.year)
    const year = Number.isFinite(yearValue) && yearValue > 1400 && yearValue < 2200
      ? Math.trunc(yearValue)
      : null

    seen.add(installment)
    books.push({ installment, title, year })
    if (books.length >= MAX_PROPOSED_BOOKS) break
  }

  return books.sort((a, b) => a.installment - b.installment)
}

// The hallucination gate. We know some books for certain; if the model cannot
// reproduce those, it is not recalling this series and everything else it said
// is suspect, so the whole answer is thrown away rather than half-trusted.
export function anchorsAgree(anchors: Record<number, string> = {}, proposed: AiSeriesBook[] = []) {
  const anchorEntries = Object.entries(anchors)
    .map(([installment, title]) => [Number(installment), normalize(title)] as const)
    .filter(([installment, title]) => Number.isFinite(installment) && !!title)
  // Nothing to check against — the caller decides whether to accept unanchored
  // answers (it does not, for writes; see useSeriesSuggestions).
  if (!anchorEntries.length) return true

  const byInstallment = new Map(proposed.map((book) => [book.installment, normalize(book.title)]))
  let checked = 0
  let agreed = 0
  for (const [installment, expected] of anchorEntries) {
    const actual = byInstallment.get(installment)
    if (!actual) continue
    checked += 1
    if (actual === expected || actual.includes(expected) || expected.includes(actual)) agreed += 1
  }

  // The model answered only for gaps and echoed no anchors: nothing to verify
  // against, so it cannot be trusted for unattended writes.
  if (!checked) return false
  return agreed / checked >= ANCHOR_AGREEMENT_RATIO
}

async function callGroq(config: AiSeriesConfig, prompt: string, fetchFn: FetchLike) {
  const response = await fetchFn('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You list books in a series accurately. You never invent titles. Respond with valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  })
  if (!response.ok) throw new Error(`Groq series lookup failed with ${response.status}`)
  const data: any = await response.json()
  return parseJsonObject(data?.choices?.[0]?.message?.content || '')
}

async function callGemini(config: AiSeriesConfig, prompt: string, fetchFn: FetchLike) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`
  const response = await fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }),
  })
  if (!response.ok) throw new Error(`Gemini series lookup failed with ${response.status}`)
  const data: any = await response.json()
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((part: any) => part?.text || '')
    .join('\n')
  return parseJsonObject(text)
}

// Propose the series ordering. Returns candidates ONLY — the caller must verify
// each title against the real metadata providers before storing anything.
export async function enumerateSeriesWithAi(options: AiSeriesOptions): Promise<{
  books: AiSeriesBook[]
  provider: AiSeriesProvider | null
  anchored: boolean
}> {
  const empty = { books: [] as AiSeriesBook[], provider: null, anchored: false }
  const seriesName = compact(options.seriesName)
  if (!seriesName) return empty

  const env = options.env || (typeof process !== 'undefined' ? process.env : {})
  // An explicit config (the on-device path) is used alone; otherwise every
  // configured provider gets a turn until one gives a usable answer.
  const configs = options.config ? [options.config] : resolveAiSeriesConfigs(env)
  if (!configs.length) return empty

  const fetchFn = options.fetchFn || globalThis.fetch
  if (!fetchFn) return empty

  const prompt = buildSeriesOrderPrompt({
    seriesName,
    author: options.author,
    anchors: options.anchors,
    missing: options.missing,
  })

  let lastProvider: AiSeriesProvider | null = null

  for (const config of configs) {
    if (!config.apiKey) continue
    lastProvider = config.provider
    try {
      const payload = config.provider === 'groq'
        ? await callGroq(config, prompt, fetchFn)
        : await callGemini(config, prompt, fetchFn)

      const books = parseSeriesOrderPayload(payload, seriesName)
      // Nothing usable — let the next provider try rather than giving up.
      if (!books.length) continue

      // Disagreeing with books we have confirmed means this model is not
      // recalling the series. Discard its answer whole and move on; a second
      // provider may well know it.
      if (!anchorsAgree(options.anchors, books)) {
        console.warn(`[AI series] Discarded "${seriesName}" ordering from ${config.provider}: it contradicts confirmed books.`)
        continue
      }

      return { books, provider: config.provider, anchored: true }
    } catch (error) {
      console.warn(`[AI series] ${config.provider} unavailable for "${seriesName}":`, error)
    }
  }

  return { ...empty, provider: lastProvider }
}
