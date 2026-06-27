type FetchLike = typeof fetch

type AuthorDetails = {
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

type AiAuthorOptions = {
  env?: Record<string, string | undefined>
  fetchFn?: FetchLike
}

type AiProviderConfig = {
  provider: 'gemini' | 'groq'
  apiKey: string
  model: string
}

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile'

function compact(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
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

function emptyRejectedDetails(details: AuthorDetails, provider: AiProviderConfig['provider'], warnings: string[]): AuthorDetails {
  return {
    bio: null,
    birthDate: null,
    deathDate: null,
    nationality: null,
    notableWorks: [],
    validatedBooksCount: null,
    validatedSeriesCount: null,
    latestWork: null,
    spouseName: null,
    hasChildren: null,
    childrenCount: null,
    source: 'none',
    version: details.version,
    aiVerified: true,
    aiRejected: true,
    aiProvider: provider,
    aiWarnings: mergeWarnings(details.aiWarnings, ...warnings),
  }
}

function buildPrompt(name: string, knownBooks: string[], details: AuthorDetails) {
  return `Verify fetched author profile data for a personal library app.

Target author: ${name}
Known books in this user's library: ${JSON.stringify(knownBooks.slice(0, 8))}

Rules:
- Return only JSON.
- JSON shape: {"isAuthorMatch": boolean, "bio": string|null, "notableWorks": string[], "latestWork": string|null, "warnings": string[]}
- Do not invent facts. Only accept, reject, or lightly normalize supplied fields.
- If the profile appears to be for a different person with the same or similar name, set isAuthorMatch to false.
- Known books are strong evidence that the profile is correct, but absence of a known book is not automatic failure.
- Keep bio concise and only if it describes the target author.

Fetched details:
${JSON.stringify(details, null, 2)}`
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
      max_tokens: 1000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a strict author identity verifier. Respond with valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  })
  if (!response.ok) throw new Error(`Groq author verification failed with ${response.status}`)
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
  if (!response.ok) throw new Error(`Gemini author verification failed with ${response.status}`)
  const data: any = await response.json()
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((part: any) => part?.text || '')
    .join('\n')
  return parseJsonObject(text)
}

function applyPatch(details: AuthorDetails, payload: any, provider: AiProviderConfig['provider']) {
  const warnings = Array.isArray(payload?.warnings) ? payload.warnings.map(compact).filter(Boolean) : []
  if (payload?.isAuthorMatch === false) {
    return emptyRejectedDetails(details, provider, warnings)
  }

  const next: AuthorDetails = {
    ...details,
    aiVerified: true,
    aiProvider: provider,
    aiWarnings: mergeWarnings(details.aiWarnings, ...warnings),
  }

  if (Object.prototype.hasOwnProperty.call(payload || {}, 'bio')) {
    next.bio = payload.bio === null ? null : compact(payload.bio).slice(0, 600)
  }
  if (Array.isArray(payload?.notableWorks)) {
    next.notableWorks = payload.notableWorks.map(compact).filter(Boolean).slice(0, 6)
  }
  if (Object.prototype.hasOwnProperty.call(payload || {}, 'latestWork')) {
    next.latestWork = payload.latestWork === null ? null : compact(payload.latestWork)
  }
  if (!next.aiWarnings?.length) delete next.aiWarnings
  return next
}

export async function verifyAuthorDetails(
  name: string,
  knownBooks: string[],
  details: AuthorDetails,
  options: AiAuthorOptions = {},
): Promise<AuthorDetails> {
  const env = options.env || process.env
  const config = resolveConfig(env)
  if (!config || details.source === 'none') return details

  const fetchFn = options.fetchFn || globalThis.fetch
  if (!fetchFn) return details

  try {
    const prompt = buildPrompt(name, knownBooks, details)
    const payload = config.provider === 'groq'
      ? await callGroq(config, prompt, fetchFn)
      : await callGemini(config, prompt, fetchFn)
    return applyPatch(details, payload, config.provider)
  } catch (error) {
    console.warn('[AI author verifier] Keeping fetched author details after verifier fallback:', error)
    return details
  }
}
