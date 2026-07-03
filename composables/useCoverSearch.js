import { useApiEndpoint } from '~/composables/useApiEndpoint'
import { isNativeCapacitorPlatform } from '~/composables/useNativePlatform'

// Single entry point for web cover search. On the web it calls the Nuxt
// endpoint; in the native app (which has no bundled server) it runs the same
// provider pipeline on the device, dynamically imported so the web bundle
// stays lean. Returns the endpoint's shape: an array of
// { url, source, label } images.
export async function fetchCoverImageResults(title, author, publisher) {
  const { apiUrl, apiBaseUrl } = useApiEndpoint()
  const native = isNativeCapacitorPlatform()

  const searchOnDevice = async () => {
    const { searchBookCovers } = await import('~/server/utils/coverSearch')
    const data = await searchBookCovers(title, author || undefined, publisher || undefined)
    return data.images || []
  }

  if (native && !apiBaseUrl) return searchOnDevice()

  try {
    const query = new URLSearchParams({ title })
    if (author) query.append('author', author)
    if (publisher) query.append('publisher', publisher)

    const response = await fetch(apiUrl(`/api/books/search-covers?${query.toString()}`))
    if (!response.ok) throw new Error(`Cover search failed with ${response.status}`)
    const data = await response.json()
    return data.images || []
  } catch (error) {
    if (native) return searchOnDevice()
    throw error
  }
}
