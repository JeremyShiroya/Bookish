import { describe, expect, test, vi } from 'vitest'
import {
  anchorsAgree,
  buildSeriesOrderPrompt,
  cleanProposedTitle,
  enumerateSeriesWithAi,
  parseSeriesOrderPayload,
  resolveAiSeriesConfig,
  resolveAiSeriesConfigs,
} from '../server/utils/aiSeriesEnumerator.ts'
import {
  confirmPlacement,
  dominantSeriesAuthor,
  sampleAnchors,
} from '../composables/useSeriesSuggestions.js'

const groqReply = (payload) => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
})

describe('provider selection matches the rest of the app', () => {
  test('BOOKISH_AI_PROVIDER=off disables it entirely', () => {
    expect(resolveAiSeriesConfig({ BOOKISH_AI_PROVIDER: 'off', GEMINI_API_KEY: 'k' })).toBeNull()
  })

  test('gemini is preferred when both keys exist', () => {
    const config = resolveAiSeriesConfig({ GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q' })
    expect(config).toMatchObject({ provider: 'gemini', apiKey: 'g' })
  })

  test('groq is used when it is the only key', () => {
    expect(resolveAiSeriesConfig({ GROQ_API_KEY: 'q' })).toMatchObject({ provider: 'groq' })
  })

  test('no key means no feature', () => {
    expect(resolveAiSeriesConfig({})).toBeNull()
  })

  test('the retired pinned model is not the default any more', () => {
    // gemini-2.5-flash 404s with "no longer available to new users" on newly
    // issued keys, which silently disabled the feature entirely.
    expect(resolveAiSeriesConfig({ GEMINI_API_KEY: 'g' }).model).toBe('gemini-flash-latest')
  })

  test('both providers are offered, the requested one first', () => {
    const env = { BOOKISH_AI_PROVIDER: 'groq', GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q' }
    expect(resolveAiSeriesConfigs(env).map((c) => c.provider)).toEqual(['groq', 'gemini'])
  })
})

describe('a second provider covers for the first', () => {
  const env = { GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q' }
  const anchors = { 16: 'Broken Prey', 30: 'Masked Prey' }
  const good = {
    books: [
      { installment: 16, title: 'Broken Prey', year: 2005 },
      { installment: 30, title: 'Masked Prey', year: 2020 },
      { installment: 31, title: 'Ocean Prey', year: 2021 },
    ],
  }
  const geminiReply = (payload) => ({
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }),
  })

  test('a rate-limited first provider hands over instead of giving up', async () => {
    // Exactly the real failure: Gemini quota gone, Groq still available.
    const fetchFn = vi.fn(async (url) => (String(url).includes('googleapis')
      ? { ok: false, status: 429, json: async () => ({}) }
      : groqReply(good)))

    const result = await enumerateSeriesWithAi({
      seriesName: 'Prey', author: 'John Sandford', anchors, env, fetchFn,
    })
    expect(result.provider).toBe('groq')
    expect(result.books.find((b) => b.installment === 31)).toMatchObject({ title: 'Ocean Prey' })
  })

  test('a provider that knows nothing hands over too', async () => {
    const fetchFn = vi.fn(async (url) => (String(url).includes('googleapis')
      ? geminiReply({ books: [] })
      : groqReply(good)))

    const result = await enumerateSeriesWithAi({ seriesName: 'Prey', anchors, env, fetchFn })
    expect(result.provider).toBe('groq')
    expect(result.books).toHaveLength(3)
  })

  test('a provider contradicting confirmed books hands over rather than corrupting', async () => {
    const fetchFn = vi.fn(async (url) => (String(url).includes('googleapis')
      ? geminiReply({ books: [{ installment: 16, title: 'Winter Prey' }, { installment: 30, title: 'Silent Prey' }] })
      : groqReply(good)))

    const result = await enumerateSeriesWithAi({ seriesName: 'Prey', anchors, env, fetchFn })
    expect(result.provider).toBe('groq')
    expect(result.anchored).toBe(true)
  })

  test('when both fail nothing is returned, and nothing throws', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))
    const result = await enumerateSeriesWithAi({ seriesName: 'Prey', anchors, env, fetchFn })
    expect(result.books).toEqual([])
  })
})

describe('the prompt constrains the model', () => {
  const prompt = buildSeriesOrderPrompt({
    seriesName: 'Prey',
    author: 'John Sandford',
    anchors: { 16: 'Broken Prey', 30: 'Masked Prey' },
    missing: [31, 32],
  })

  test('it pins the confirmed books so drift can be detected', () => {
    expect(prompt).toContain('16. Broken Prey')
    expect(prompt).toContain('30. Masked Prey')
  })

  test('it asks only for the numbers still needed', () => {
    expect(prompt).toContain('31, 32')
  })

  test('it forbids guessing — omission is the correct failure', () => {
    expect(prompt).toMatch(/OMIT it/)
    expect(prompt).toMatch(/Never invent a title/)
    expect(prompt).toMatch(/Exclude novellas/)
  })
})

describe('proposed titles are cleaned before they are searched', () => {
  test('series decoration is stripped', () => {
    expect(cleanProposedTitle('Ocean Prey (Prey, #31)', 'Prey')).toBe('Ocean Prey')
    expect(cleanProposedTitle('Ocean Prey (A Prey Novel)', 'Prey')).toBe('Ocean Prey')
    expect(cleanProposedTitle('Prey #31: Ocean Prey', 'Prey')).toBe('Ocean Prey')
  })

  test('a plain title is untouched', () => {
    expect(cleanProposedTitle('Toxic Prey', 'Prey')).toBe('Toxic Prey')
  })
})

describe('the payload parser rejects junk', () => {
  test('it normalizes and sorts real entries', () => {
    const books = parseSeriesOrderPayload({
      books: [
        { installment: 32, title: 'Righteous Prey', year: 2022 },
        { installment: 31, title: 'Ocean Prey (Prey, #31)', year: '2021' },
      ],
    }, 'Prey')
    expect(books).toEqual([
      { installment: 31, title: 'Ocean Prey', year: 2021 },
      { installment: 32, title: 'Righteous Prey', year: 2022 },
    ])
  })

  test('duplicate numbers, blank titles and absurd years are dropped', () => {
    const books = parseSeriesOrderPayload({
      books: [
        { installment: 1, title: 'Rules of Prey', year: 1989 },
        { installment: 1, title: 'Duplicate', year: 1990 },
        { installment: 2, title: '   ', year: 1990 },
        { installment: 0, title: 'Zero', year: 1990 },
        { installment: 3, title: 'Eyes of Prey', year: 99999 },
      ],
    }, 'Prey')
    expect(books).toEqual([
      { installment: 1, title: 'Rules of Prey', year: 1989 },
      { installment: 3, title: 'Eyes of Prey', year: null },
    ])
  })

  test('a title that is just the series name carries no information', () => {
    expect(parseSeriesOrderPayload({ books: [{ installment: 4, title: 'Prey' }] }, 'Prey')).toEqual([])
  })
})

describe('the anchor gate catches a model that is reconstructing', () => {
  const anchors = { 16: 'Broken Prey', 30: 'Masked Prey' }

  test('reproducing the known books passes', () => {
    expect(anchorsAgree(anchors, [
      { installment: 16, title: 'Broken Prey', year: 2005 },
      { installment: 30, title: 'Masked Prey', year: 2020 },
    ])).toBe(true)
  })

  test('contradicting the known books fails', () => {
    expect(anchorsAgree(anchors, [
      { installment: 16, title: 'Naked Prey', year: 2003 },
      { installment: 30, title: 'Twisted Prey', year: 2018 },
    ])).toBe(false)
  })

  test('echoing no anchors at all cannot be trusted', () => {
    expect(anchorsAgree(anchors, [{ installment: 31, title: 'Ocean Prey', year: 2021 }])).toBe(false)
  })
})

describe('enumerateSeriesWithAi end to end', () => {
  const config = { provider: 'groq', apiKey: 'test', model: 'test-model' }
  const anchors = { 16: 'Broken Prey', 30: 'Masked Prey' }

  test('an anchored answer returns the proposed gap books', async () => {
    const fetchFn = vi.fn(async () => groqReply({
      books: [
        { installment: 16, title: 'Broken Prey', year: 2005 },
        { installment: 30, title: 'Masked Prey', year: 2020 },
        { installment: 31, title: 'Ocean Prey', year: 2021 },
      ],
    }))

    const result = await enumerateSeriesWithAi({
      seriesName: 'Prey', author: 'John Sandford', anchors, missing: [31], config, fetchFn,
    })
    expect(result.anchored).toBe(true)
    expect(result.books.find((b) => b.installment === 31)).toMatchObject({ title: 'Ocean Prey' })
  })

  test('an answer that contradicts the anchors is discarded WHOLESALE', async () => {
    // The dangerous case: the gap title may look plausible, but if the model
    // misplaced books we already know, its ordering cannot be trusted at all.
    const fetchFn = vi.fn(async () => groqReply({
      books: [
        { installment: 16, title: 'Winter Prey', year: 1993 },
        { installment: 30, title: 'Silent Prey', year: 1992 },
        { installment: 31, title: 'Something Plausible', year: 2021 },
      ],
    }))

    const result = await enumerateSeriesWithAi({
      seriesName: 'Prey', author: 'John Sandford', anchors, missing: [31], config, fetchFn,
    })
    expect(result.anchored).toBe(false)
    expect(result.books).toEqual([])
  })

  test('no key means the feature is simply off', async () => {
    const fetchFn = vi.fn()
    const result = await enumerateSeriesWithAi({ seriesName: 'Prey', config: null, env: {}, fetchFn })
    expect(fetchFn).not.toHaveBeenCalled()
    expect(result.books).toEqual([])
  })

  test('a provider failure never throws — the roster path must survive', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) }))
    const result = await enumerateSeriesWithAi({
      seriesName: 'Prey', anchors, config, fetchFn,
    })
    expect(result.books).toEqual([])
  })
})

// Fixtures taken from the REAL replies a model gave for the Lucas Davenport
// books a rate-limited roster could not supply. It recited the confirmed books
// perfectly, then answered "33: Ocean Prey" (really #31), "31: Righteous Prey"
// (really #32) and "34: Hellfire" (not in the series). Its titles are useful;
// its numbering is not — so the provider decides where a book goes.
describe('the PROVIDER decides the position, never the model', () => {
  const author = 'John Sandford'
  const seriesName = 'Lucas Davenport'

  test('a confirmed book reports the number the provider states', () => {
    const results = [
      { title: 'Ocean Prey', author, series: 'Lucas Davenport', seriesInstallment: '31', cover: 'c.jpg', publishYear: 2021 },
    ]
    // The model had put Ocean Prey at 33; the provider corrects it to 31.
    expect(confirmPlacement(results, { title: 'Ocean Prey', author, seriesName }))
      .toMatchObject({ installment: 31 })
  })

  test('a real book the model misnumbered still lands correctly', () => {
    const results = [
      { title: 'Righteous Prey', author, series: 'Lucas Davenport', seriesInstallment: '32', cover: 'c.jpg' },
    ]
    expect(confirmPlacement(results, { title: 'Righteous Prey', author, seriesName }))
      .toMatchObject({ installment: 32 })
  })

  test('an invented title nothing can confirm is refused', () => {
    // The model offered "Hellish Prey", which does not exist.
    expect(confirmPlacement([], { title: 'Hellish Prey', author, seriesName })).toBeNull()
  })

  test('a book no provider will place is refused', () => {
    const results = [{ title: 'Ocean Prey', author, series: 'Lucas Davenport', seriesInstallment: null }]
    expect(confirmPlacement(results, { title: 'Ocean Prey', author, seriesName })).toBeNull()
  })

  test('a book from a DIFFERENT series by the same author is refused', () => {
    // "Deadline" is a Virgil Flowers book; it must never enter this series.
    const results = [
      { title: 'Deadline', author, series: 'Virgil Flowers', seriesInstallment: '8', cover: 'c.jpg' },
    ]
    expect(confirmPlacement(results, { title: 'Deadline', author, seriesName })).toBeNull()
  })

  test('a novella half-number never claims a whole slot', () => {
    const results = [
      { title: 'Extra Prey', author, series: 'Lucas Davenport', seriesInstallment: '4.5' },
    ]
    expect(confirmPlacement(results, { title: 'Extra Prey', author, seriesName })).toBeNull()
  })

  test('it scans past a non-matching result to find the confirming one', () => {
    const results = [
      { title: 'The Prey Collection', author, series: 'Lucas Davenport', seriesInstallment: '31' },
      { title: 'Ocean Prey', author, series: 'Lucas Davenport', seriesInstallment: '31', cover: 'c.jpg' },
    ]
    expect(confirmPlacement(results, { title: 'Ocean Prey', author, seriesName }))
      .toMatchObject({ result: { cover: 'c.jpg' }, installment: 31 })
  })
})

describe('anchors are sampled so long series stay cheap and URL-safe', () => {
  const roster = Object.fromEntries(
    Array.from({ length: 30 }, (_, i) => [i + 1, `Book ${i + 1}`]),
  )

  test('a long roster is trimmed to the cap', () => {
    const sampled = sampleAnchors(roster, 12)
    expect(Object.keys(sampled)).toHaveLength(12)
  })

  test('the sample spans the whole series, not just the start', () => {
    // Catching drift in the LATE stretch is the point — that is where gaps are.
    const keys = Object.keys(sampleAnchors(roster, 12)).map(Number)
    expect(Math.min(...keys)).toBe(1)
    expect(Math.max(...keys)).toBe(30)
  })

  test('a short roster is passed through untouched', () => {
    expect(sampleAnchors({ 1: 'A', 2: 'B' }, 12)).toEqual({ 1: 'A', 2: 'B' })
  })
})

describe('the author every AI proposal is verified against', () => {
  test('owned books decide it', () => {
    expect(dominantSeriesAuthor(
      [{ author: 'John Sandford' }, { author: 'John Sandford' }],
      { 1: { author: 'Someone Else' } },
    )).toBe('John Sandford')
  })

  test('the roster is the fallback when no book is owned', () => {
    expect(dominantSeriesAuthor([], { 1: { author: 'Kjell Eriksson' } })).toBe('Kjell Eriksson')
  })

  test('an unknown author blocks AI writes entirely', () => {
    expect(dominantSeriesAuthor([], {})).toBeNull()
  })
})
