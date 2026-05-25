export function isRemoteCoverUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

export const useCoverImageCache = () => {
  const cacheCoverImage = async (coverUrl) => {
    if (!isRemoteCoverUrl(coverUrl)) return coverUrl

    try {
      const result = await $fetch('/api/books/cache-cover', {
        method: 'POST',
        body: { url: coverUrl },
      })

      return result?.dataUrl || coverUrl
    } catch (error) {
      console.warn('[Bookish] Failed to cache remote cover image:', error)
      return coverUrl
    }
  }

  return { cacheCoverImage }
}
