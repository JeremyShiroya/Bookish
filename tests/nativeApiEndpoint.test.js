import { describe, expect, test } from 'vitest'
import {
  BOOKISH_API_BASE_URL_KEY,
  joinApiUrl,
  normalizeApiBaseUrl,
  readStoredApiBaseUrl,
  resolveApiBaseUrl,
  writeStoredApiBaseUrl,
} from '../composables/useApiEndpoint.js'

const fakeStorage = (initial = {}) => {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  }
}

describe('native API endpoint helper', () => {
  test('keeps browser relative API paths when no backend base URL is configured', () => {
    expect(joinApiUrl('/api/books/metadata?title=Gone+Girl', '')).toBe('/api/books/metadata?title=Gone+Girl')
  })

  test('joins Capacitor API paths onto the configured backend base URL', () => {
    expect(joinApiUrl('/api/tts', ' http://192.168.1.20:3000/ ')).toBe('http://192.168.1.20:3000/api/tts')
    expect(joinApiUrl('api/books/metadata', 'http://192.168.1.20:3000///')).toBe('http://192.168.1.20:3000/api/books/metadata')
  })

  test('does not rewrite already absolute provider URLs', () => {
    expect(joinApiUrl('https://openlibrary.org/search.json', 'http://192.168.1.20:3000')).toBe('https://openlibrary.org/search.json')
  })

  test('normalizes blank and trailing-slash base URLs', () => {
    expect(normalizeApiBaseUrl('   ')).toBe('')
    expect(normalizeApiBaseUrl('https://bookish.example.com/api///')).toBe('https://bookish.example.com/api')
  })

  test('a runtime server URL saved from Settings wins over the build-time value', () => {
    expect(resolveApiBaseUrl('https://built-in.example', 'https://runtime.example/')).toBe('https://runtime.example')
    expect(resolveApiBaseUrl('https://built-in.example', '')).toBe('https://built-in.example')
    expect(resolveApiBaseUrl('', '')).toBe('')
  })

  test('persists, reads, and clears the runtime server URL', () => {
    const storage = fakeStorage()

    expect(writeStoredApiBaseUrl(' https://phone-server.example// ', storage)).toBe('https://phone-server.example')
    expect(storage.getItem(BOOKISH_API_BASE_URL_KEY)).toBe('https://phone-server.example')
    expect(readStoredApiBaseUrl(storage)).toBe('https://phone-server.example')

    expect(writeStoredApiBaseUrl('', storage)).toBe('')
    expect(storage.getItem(BOOKISH_API_BASE_URL_KEY)).toBeNull()
    expect(readStoredApiBaseUrl(storage)).toBe('')
  })
})
