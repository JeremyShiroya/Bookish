import { describe, expect, it, vi } from 'vitest'
import { verifyAuthorDetails } from './aiAuthorVerifier'

const authorDetails = {
  bio: 'Stephen Hawking was an English theoretical physicist and cosmologist.',
  birthDate: '8 Jan 1942',
  deathDate: '14 Mar 2018',
  nationality: 'United Kingdom',
  notableWorks: ['A Brief History of Time'],
  validatedBooksCount: null,
  validatedSeriesCount: null,
  latestWork: 'A Brief History of Time',
  spouseName: null,
  hasChildren: null,
  childrenCount: null,
  source: 'wikipedia',
  version: 6,
}

describe('AI author verifier', () => {
  it('clears author details when Groq says the fetched profile is the wrong person', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            isAuthorMatch: false,
            warnings: ['Profile is for Stephen Hawking, not Stephen King.'],
          }),
        },
      }],
    }), { status: 200 }))

    const verified = await verifyAuthorDetails('Stephen King', ['The Shining'], authorDetails, {
      fetchFn,
      env: {
        BOOKISH_AI_PROVIDER: 'groq',
        GROQ_API_KEY: 'test-key',
        GROQ_MODEL: 'llama-3.3-70b-versatile',
      },
    })

    expect(fetchFn).toHaveBeenCalled()
    expect(verified).toMatchObject({
      bio: null,
      birthDate: null,
      nationality: null,
      notableWorks: [],
      source: 'none',
      aiRejected: true,
    })
    expect(verified.aiWarnings).toContain('Profile is for Stephen Hawking, not Stephen King.')
  })

  it('keeps verified author details and applies normalized fields', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            isAuthorMatch: true,
            bio: 'Stephen King is an American author of horror, supernatural fiction, suspense, crime, science-fiction, and fantasy novels.',
            notableWorks: ['The Shining', 'It'],
            warnings: [],
          }),
        },
      }],
    }), { status: 200 }))

    const verified = await verifyAuthorDetails('Stephen King', ['The Shining'], {
      ...authorDetails,
      bio: 'Stephen King is an American author.',
      birthDate: '21 Sep 1947',
      deathDate: null,
      nationality: 'United States of America',
      notableWorks: ['The Shining'],
      latestWork: 'You Like It Darker',
    }, {
      fetchFn,
      env: {
        BOOKISH_AI_PROVIDER: 'groq',
        GROQ_API_KEY: 'test-key',
      },
    })

    expect(verified.bio).toContain('American author of horror')
    expect(verified.notableWorks).toEqual(['The Shining', 'It'])
    expect(verified.aiVerified).toBe(true)
    expect(verified.source).toBe('wikipedia')
  })

  it('applies Groq-cross-checked book and series totals', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            isAuthorMatch: true,
            booksCount: 65,
            seriesCount: 4,
            warnings: [],
          }),
        },
      }],
    }), { status: 200 }))

    const verified = await verifyAuthorDetails('Stephen King', ['The Shining'], {
      ...authorDetails,
      validatedBooksCount: null,
      validatedSeriesCount: 2,
    }, {
      fetchFn,
      env: { BOOKISH_AI_PROVIDER: 'groq', GROQ_API_KEY: 'test-key' },
    })

    expect(verified.validatedBooksCount).toBe(65)
    expect(verified.validatedSeriesCount).toBe(4)
  })

  it('keeps the scraped total when Groq returns a null count', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            isAuthorMatch: true,
            booksCount: null,
            seriesCount: null,
            warnings: [],
          }),
        },
      }],
    }), { status: 200 }))

    const verified = await verifyAuthorDetails('Stephen King', ['The Shining'], {
      ...authorDetails,
      validatedBooksCount: 12,
      validatedSeriesCount: 3,
    }, {
      fetchFn,
      env: { BOOKISH_AI_PROVIDER: 'groq', GROQ_API_KEY: 'test-key' },
    })

    expect(verified.validatedBooksCount).toBe(12)
    expect(verified.validatedSeriesCount).toBe(3)
  })
})
