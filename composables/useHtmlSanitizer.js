const BLOCKED_TAGS = ['script', 'iframe', 'object', 'embed', 'form', 'meta', 'link', 'base']
const URL_ATTRIBUTES = ['href', 'src', 'action', 'formaction', 'poster', 'xlink:href']

const compactScheme = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '')

export function sanitizeBookHtml(html) {
  if (!import.meta.client && typeof document === 'undefined') {
    return String(html || '')
  }

  const container = document.createElement('div')
  container.innerHTML = String(html || '')

  for (const tag of BLOCKED_TAGS) {
    container.querySelectorAll(tag).forEach((element) => element.remove())
  }

  container.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase()
      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name)
        return
      }

      if (URL_ATTRIBUTES.includes(name) && compactScheme(attribute.value).startsWith('javascript:')) {
        element.removeAttribute(attribute.name)
      }
    })
  })

  return container.innerHTML
}
