import { describe, expect, it, vi } from 'vitest'
import {
  sanitizeBookMetadataResult,
  verifyBookMetadataResults,
} from './aiMetadataVerifier'

const baseResult = {
  googleId: 'test:1',
  sourceTags: ['goodreads'],
  publisherSource: null,
  primarySource: 'goodreads',
  title: 'Standoffs',
  author: 'S. B. Smith',
  cover: null,
  blurb: 'A tense standalone thriller with a confirmed publisher description.',
  series: null,
  seriesInstallment: null,
  seriesTotal: null,
  genre: 'Thriller',
  publishYear: 2024,
  publisher: 'Test Publisher',
  blurbOptions: [],
  webReview: null,
}

describe('AI metadata verifier', () => {
  it('removes byline-shaped series values and clears dependent series fields', () => {
    const sanitized = sanitizeBookMetadataResult('Standoffs', 'S. B. Smith', {
      ...baseResult,
      series: 'Standoffs by S. B. Smith',
      seriesInstallment: '1',
      seriesTotal: '1',
    })

    expect(sanitized.series).toBeNull()
    expect(sanitized.seriesInstallment).toBeNull()
    expect(sanitized.seriesTotal).toBeNull()
    expect(sanitized.aiWarnings).toContain('Removed a series value that looked like a title/byline instead of a series.')
  })

  it('keeps title-matching series names when installment evidence says it is a real series', () => {
    const sanitized = sanitizeBookMetadataResult('Dune', 'Frank Herbert', {
      ...baseResult,
      title: 'Dune',
      author: 'Frank Herbert',
      series: 'Dune',
      seriesInstallment: '1',
      seriesTotal: '6',
    })

    expect(sanitized.series).toBe('Dune')
    expect(sanitized.seriesInstallment).toBe('1')
    expect(sanitized.seriesTotal).toBe('6')
    expect(sanitized.aiWarnings || []).toEqual([])
  })

  it('applies a Groq verification patch when an API key is configured', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            items: [{
              index: 0,
              isBookMatch: true,
              series: null,
              seriesInstallment: null,
              seriesTotal: null,
              blurb: 'A verified publisher-style description for Standoffs.',
              warnings: ['Series candidate was title/byline noise.'],
            }],
          }),
        },
      }],
    }), { status: 200 }))

    const [verified] = await verifyBookMetadataResults('Standoffs', 'S. B. Smith', [{
      ...baseResult,
      series: 'Standoffs by S. B. Smith',
      seriesInstallment: '1',
      seriesTotal: '1',
      blurb: 'Search result text.',
    }], {
      fetchFn,
      env: {
        BOOKISH_AI_PROVIDER: 'groq',
        GROQ_API_KEY: 'test-key',
        GROQ_MODEL: 'llama-3.3-70b-versatile',
      },
    })

    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      }),
    )
    expect(verified.series).toBeNull()
    expect(verified.blurb).toBe('A verified publisher-style description for Standoffs.')
    expect(verified.aiVerified).toBe(true)
    expect(verified.aiWarnings).toContain('Series candidate was title/byline noise.')
  })
})
