import { useApiEndpoint } from '~/composables/useApiEndpoint'
import { fetchBookMetadataResults } from '~/composables/useBookMetadataSearch'
import { isNativeCapacitorPlatform } from '~/composables/useNativePlatform'

// Single entry point for web cover search. On the web it calls the Nuxt
// endpoint; in the native app (which has no bundled server) it runs the same
// provider pipeline on the device, dynamically imported so the web bundle
// stays lean. Returns the endpoint's shape: an array of
// { url, source, label } images.
async function fetchWebCoverImages(title, author, publisher) {
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

// The covers that ride along on metadata-fetch results (the options shown in
// Add/Edit's "Fetch Metadata"). They're often different editions than the
// image search surfaces, so the picker offers both pools together.
async function fetchMetadataCoverImages(title, author, publisher) {
  const results = await fetchBookMetadataResults(title, author || undefined, publisher || undefined)
  return (results || [])
    .filter((item) => item?.cover)
    .map((item) => ({
      url: item.cover,
      source: 'metadata',
      label: item.title ? `Metadata · ${item.title}` : 'Metadata match',
    }))
}

export async function fetchCoverImageResults(title, author, publisher) {
  // Both pools in parallel; either failing alone must not sink the other.
  const [webImages, metadataImages] = await Promise.allSettled([
    fetchWebCoverImages(title, author, publisher),
    fetchMetadataCoverImages(title, author, publisher),
  ])

  const web = webImages.status === 'fulfilled' ? webImages.value : []
  const metadata = metadataImages.status === 'fulfilled' ? metadataImages.value : []

  // Web-search results keep their original order first (the existing
  // behaviour), metadata covers append after, deduped by URL.
  const seen = new Set()
  const merged = []
  for (const image of [...web, ...metadata]) {
    const url = typeof image === 'string' ? image : image?.url
    if (!url || seen.has(url)) continue
    seen.add(url)
    merged.push(typeof image === 'string' ? { url, source: 'unknown', label: '' } : image)
  }

  // Preserve the old contract: if BOTH pools failed, surface the web error.
  if (!merged.length && webImages.status === 'rejected' && metadataImages.status === 'rejected') {
    throw webImages.reason
  }

  return merged
}
