import { createError, defineEventHandler, readBody } from 'h3'

const MAX_COVER_BYTES = 6 * 1024 * 1024
const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])

function isCacheableCoverUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ url?: string }>(event)

  if (!isCacheableCoverUrl(body?.url)) {
    throw createError({ statusCode: 400, statusMessage: 'A valid cover URL is required.' })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)

  try {
    const response = await fetch(body.url, {
      signal: controller.signal,
      headers: {
        accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8',
        'user-agent': 'Bookish/1.0 cover-cache',
      },
    })

    if (!response.ok) {
      throw createError({ statusCode: 502, statusMessage: 'Could not fetch cover image.' })
    }

    const contentType = (response.headers.get('content-type') || 'image/jpeg').split(';')[0].toLowerCase()
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw createError({ statusCode: 415, statusMessage: 'Cover URL did not return an image.' })
    }

    const contentLength = Number(response.headers.get('content-length') || 0)
    if (contentLength > MAX_COVER_BYTES) {
      throw createError({ statusCode: 413, statusMessage: 'Cover image is too large.' })
    }

    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.byteLength > MAX_COVER_BYTES) {
      throw createError({ statusCode: 413, statusMessage: 'Cover image is too large.' })
    }

    return {
      dataUrl: `data:${contentType};base64,${bytes.toString('base64')}`,
    }
  } finally {
    clearTimeout(timeout)
  }
})
