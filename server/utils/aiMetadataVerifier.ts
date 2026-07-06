type FetchLike = typeof fetch

type AiVerifierOptions = {
  env?: Record<string, string | undefined>
  fetchFn?: FetchLike
}

type AiProviderConfig = {
  provider: 'gemini' | 'groq'
  apiKey: string
  model: string
}

type AiPatch = {
  index: number
  isBookMatch?: boolean
  title?: string | null
  author?: string | null
  series?: string | null
  seriesInstallment?: string | null
  seriesTotal?: string | null
  blurb?: string | null
  genre?: string | null
  warnings?: string[]
}

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile'

function compact(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalize(value: unknown) {
  return compact(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function hasPositiveNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0
}

function hasMultiBookEvidence(result: Record<string, any>) {
  const total = Number(result.seriesTotal)
  return hasPositiveNumber(result.seriesInstallment) || (Number.isFinite(total) && total > 1)
}

function cleanBlurb(value: unknown) {
  const cleaned = compact(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return null
  if (/enable javascript|cloudflare|access denied|robot check|captcha/i.test(cleaned)) return null
  return cleaned
}

function mergeWarnings(existing: unknown, ...warnings: string[]) {
  const result = new Set<string>()
  if (Array.isArray(existing)) {
    existing.forEach((warning) => {
      const text = compact(warning)
      if (text) result.add(text)
    })
  }
  warnings.forEach((warning) => {
    const text = compact(warning)
    if (text) result.add(text)
  })
  return [...result]
}

function looksLikeBylineSeries(targetTitle: string, targetAuthor: string | undefined, series: unknown, result: Record<string, any>) {
  const seriesText = compact(series)
  if (!seriesText) return false

  const seriesKey = normalize(seriesText)
  const titleKey = normalize(targetTitle || result.title)
  const authorKey = normalize(targetAuthor || result.author)
  const hasEvidence = hasMultiBookEvidence(result)

  if (/^(standalone|stand-alone|none|n\/a|not part of a series)$/i.test(seriesText)) return true

  const hasBy = /\s+by\s+/i.test(seriesText)
  if (hasBy && (!authorKey || seriesKey.includes(authorKey) || (titleKey && seriesKey.includes(titleKey)))) return true

  if (titleKey && authorKey && seriesKey.includes(titleKey) && seriesKey.includes(authorKey)) return true

  if (!hasEvidence && titleKey && seriesKey === titleKey) return true

  return false
}

export function sanitizeBookMetadataResult<T extends Record<string, any>>(
  targetTitle: string,
  targetAuthor: string | undefined,
  result: T,
): T & { aiWarnings?: string[] } {
  const next: T & { aiWarnings?: string[] } = { ...result }
  const warnings: string[] = []

  const blurb = cleanBlurb(next.blurb)
  if (next.blurb && !blurb) warnings.push('Removed a blurb that looked like page noise instead of book description.')
  next.blurb = blurb

  if (next.series) {
    next.series = compact(next.series).replace(/\s+series$/i, '').trim()
  }

  if (looksLikeBylineSeries(targetTitle, targetAuthor, next.series, next)) {
    next.series = null
    next.seriesInstallment = null
    next.seriesTotal = null
    warnings.push('Removed a series value that looked like a title/byline instead of a series.')
  }

  if (!next.series) {
    next.seriesInstallment = null
    next.seriesTotal = null
  }

  const mergedWarnings = mergeWarnings(next.aiWarnings, ...warnings)
  if (mergedWarnings.length) next.aiWarnings = mergedWarnings
  else delete next.aiWarnings

  return next
}

function resolveConfig(env: Record<string, string | undefined>): AiProviderConfig | null {
  const requested = compact(env.BOOKISH_AI_PROVIDER).toLowerCase()
  if (requested === 'off' || requested === 'none' || requested === 'false') return null

  const geminiKey = env.GEMINI_API_KEY || env.GOOGLE_AI_API_KEY
  const groqKey = env.GROQ_API_KEY

  if (requested === 'gemini' && geminiKey) {
    return {
      provider: 'gemini',
      apiKey: geminiKey,
      model: compact(env.GEMINI_MODEL) || DEFAULT_GEMINI_MODEL,
    }
  }

  if (requested === 'groq' && groqKey) {
    return {
      provider: 'groq',
      apiKey: groqKey,
      model: compact(env.GROQ_MODEL) || DEFAULT_GROQ_MODEL,
    }
  }

  if (!requested && geminiKey) {
    return {
      provider: 'gemini',
      apiKey: geminiKey,
      model: compact(env.GEMINI_MODEL) || DEFAULT_GEMINI_MODEL,
    }
  }

  if (!requested && groqKey) {
    return {
      provider: 'groq',
      apiKey: groqKey,
      model: compact(env.GROQ_MODEL) || DEFAULT_GROQ_MODEL,
    }
  }

  return null
}

function buildVerificationPrompt(targetTitle: string, targetAuthor: string | undefined, results: Record<string, any>[]) {
  const compactResults = results.slice(0, 8).map((result, index) => ({
    index,
    title: result.title,
    author: result.author,
    sourceTags: result.sourceTags,
    primarySource: result.primarySource,
    series: result.series,
    seriesInstallment: result.seriesInstallment,
    seriesTotal: result.seriesTotal,
    genre: result.genre,
    publishYear: result.publishYear,
    publisher: result.publisher,
    blurb: result.blurb,
    blurbOptions: Array.isArray(result.blurbOptions)
      ? result.blurbOptions.slice(0, 4)
      : [],
  }))

  return `Verify fetched book metadata for a personal library app.

Target title: ${targetTitle}
Target author: ${targetAuthor || 'unknown'}

Rules:
- Return only JSON with shape {"items":[...]}.
- Use the same result index values.
- Do not invent facts. Only accept, reject, or normalize supplied fields.
- Reject series values that are book titles, search headings, or bylines such as "Title by Author".
- Keep title-named series only when there is installment or multi-book evidence.
- Pick the cleanest blurb only when it clearly describes this exact book.
- Use null for fields that should be cleared.
- warnings should be short strings explaining risky fields.

Results:
${JSON.stringify(compactResults, null, 2)}`
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

async function callGroq(config: AiProviderConfig, prompt: string, fetchFn: FetchLike) {
  const response = await fetchFn('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      max_tokens: 1600,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a strict metadata verifier for books. Respond with valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  })
  if (!response.ok) throw new Error(`Groq verification failed with ${response.status}`)
  const data: any = await response.json()
  return parseJsonObject(data?.choices?.[0]?.message?.content || '')
}

async function callGemini(config: AiProviderConfig, prompt: string, fetchFn: FetchLike) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`
  const response = await fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
      },
      contents: [{
        role: 'user',
        parts: [{ text: prompt }],
      }],
    }),
  })
  if (!response.ok) throw new Error(`Gemini verification failed with ${response.status}`)
  const data: any = await response.json()
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((part: any) => part?.text || '')
    .join('\n')
  return parseJsonObject(text)
}

function applyAiPatches<T extends Record<string, any>>(
  targetTitle: string,
  targetAuthor: string | undefined,
  results: Array<T & { aiWarnings?: string[] }>,
  payload: any,
  provider: AiProviderConfig['provider'],
) {
  const patches: AiPatch[] = Array.isArray(payload?.items) ? payload.items : []
  if (!patches.length) return results

  const patched = results.map((result) => ({ ...result }))
  for (const patch of patches) {
    if (!Number.isSafeInteger(patch.index) || patch.index < 0 || patch.index >= patched.length) continue
    const item = patched[patch.index]
    const warnings = Array.isArray(patch.warnings) ? patch.warnings : []

    if (patch.isBookMatch === false) {
      item.aiWarnings = mergeWarnings(item.aiWarnings, 'AI could not verify that this result matches the requested book.', ...warnings)
      item.aiVerified = true
      item.aiProvider = provider
      continue
    }

    for (const key of ['title', 'author', 'genre', 'blurb'] as const) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        item[key] = patch[key] === null ? null : compact(patch[key])
      }
    }

    for (const key of ['series', 'seriesInstallment', 'seriesTotal'] as const) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        item[key] = patch[key] === null ? null : compact(patch[key])
      }
    }

    item.aiVerified = true
    item.aiProvider = provider
    item.aiWarnings = mergeWarnings(item.aiWarnings, ...warnings)
  }

  return patched.map((result) => sanitizeBookMetadataResult(targetTitle, targetAuthor, result))
}

export async function verifyBookMetadataResults<T extends Record<string, any>>(
  targetTitle: string,
  targetAuthor: string | undefined,
  results: T[],
  options: AiVerifierOptions = {},
): Promise<Array<T & { aiVerified?: boolean; aiProvider?: string; aiWarnings?: string[] }>> {
  const sanitized = results.map((result) => sanitizeBookMetadataResult(targetTitle, targetAuthor, result))
  const env = options.env || (typeof process !== 'undefined' ? process.env : {})
  const config = resolveConfig(env)
  if (!config || !sanitized.length) return sanitized

  const fetchFn = options.fetchFn || globalThis.fetch
  if (!fetchFn) return sanitized

  try {
    const prompt = buildVerificationPrompt(targetTitle, targetAuthor, sanitized)
    const payload = config.provider === 'groq'
      ? await callGroq(config, prompt, fetchFn)
      : await callGemini(config, prompt, fetchFn)
    return applyAiPatches(targetTitle, targetAuthor, sanitized, payload, config.provider)
  } catch (error) {
    console.warn('[AI metadata verifier] Falling back to deterministic metadata cleanup:', error)
    return sanitized
  }
}
