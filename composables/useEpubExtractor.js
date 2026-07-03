import JSZip from 'jszip'
import { isRenderableSection } from '~/composables/useTTS'
import { sanitizeBookHtml } from '~/composables/useHtmlSanitizer'

function parseXml(text) {
  return new DOMParser().parseFromString(text, 'application/xml')
}

// Resolve a relative path against a base file path (POSIX-style)
function resolvePath(basePath, relPath) {
  if (!relPath) return basePath
  if (/^[a-z][a-z0-9+\-.]*:/i.test(relPath) || relPath.startsWith('#')) return relPath
  const base = basePath.split('/')
  base.pop() // remove filename, keep directory
  for (const seg of relPath.split('/')) {
    if (seg === '..') base.pop()
    else if (seg !== '.') base.push(seg)
  }
  return base.join('/')
}

// Uint8Array → base64 data URL
function toDataUrl(bytes, mime) {
  // btoa in chunks to avoid call-stack overflow on large images
  const CHUNK = 8192
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return `data:${mime};base64,${btoa(binary)}`
}

// Replace url(...) references in CSS with data URLs (for background images etc.)
function inlineCssUrls(css, cssZipPath, imageMap) {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (match, q, src) => {
    if (src.startsWith('data:') || /^https?:/.test(src)) return match
    const resolved = resolvePath(cssZipPath, decodeURIComponent(src))
    const url = imageMap[resolved]
    return url ? `url("${url}")` : match
  })
}

// ── Lightweight CSS scoper ─────────────────────────────────────────────────
// Prefixes every selector with `scope` so EPUB styles don't bleed into the
// reader's own UI.  Handles: regular rules, @media/@supports (recursive),
// @font-face/@keyframes (pass-through), @charset/@import (pass-through).

const PASSTHROUGH_AT = new Set([
  'font-face', 'keyframes', '-webkit-keyframes', '-moz-keyframes',
  'counter-style', 'page', 'viewport',
])

function scopeCss(css, scope) {
  let out = ''
  let i = 0
  const len = css.length

  while (i < len) {
    // Whitespace
    if (/\s/.test(css[i])) { out += css[i++]; continue }

    // Comment  /* ... */
    if (css.slice(i, i + 2) === '/*') {
      const end = css.indexOf('*/', i + 2)
      if (end < 0) break
      out += css.slice(i, end + 2); i = end + 2; continue
    }

    // At-rule
    if (css[i] === '@') {
      const atm = css.slice(i).match(/^@([\w-]+)/)
      const atName = (atm?.[1] || '').toLowerCase()

      const semi = css.indexOf(';', i)
      const brace = css.indexOf('{', i)

      // Statement at-rules: @charset, @import, @namespace (end with ;)
      if (semi >= 0 && (brace < 0 || semi < brace)) {
        out += css.slice(i, semi + 1); i = semi + 1; continue
      }
      if (brace < 0) break

      const header = css.slice(i, brace) // e.g. "@media screen and (...)"

      if (PASSTHROUGH_AT.has(atName)) {
        // Pass the whole block through unchanged
        const block = readBlock(css, brace)
        out += header + block.text; i = brace + block.len; continue
      }

      // @media, @supports: recurse into inner rules
      const block = readBlock(css, brace)
      out += header + '{' + scopeCss(block.inner, scope) + '}'; i = brace + block.len; continue
    }

    // Regular rule: find selector → block
    const brace = css.indexOf('{', i)
    if (brace < 0) break

    // Skip stray characters (closing brace from broken CSS, etc.)
    let stray = i
    while (stray < brace && css[stray] !== '}') stray++
    if (stray < brace) { out += css[i++]; continue }

    const rawSel = css.slice(i, brace).trim()
    if (!rawSel) { out += css[i++]; continue }

    const scopedSel = rawSel.split(',').map(s => {
      s = s.trim()
      if (!s) return s
      // Replace bare html/body with scope class
      if (/^(html|body)$/.test(s)) return scope
      s = s.replace(/\b(html|body)\b/g, scope)
      return s.includes(scope) ? s : `${scope} ${s}`
    }).filter(Boolean).join(',\n')

    const block = readBlock(css, brace)
    out += scopedSel + block.text; i = brace + block.len
  }

  return out
}

// Read the block starting at `start` (css[start] must be '{')
function readBlock(css, start) {
  let depth = 0, i = start
  while (i < css.length) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) { i++; break }
    i++
  }
  const text = css.slice(start, i)
  return { text, inner: text.slice(1, -1), len: i - start }
}
// ── end CSS scoper ─────────────────────────────────────────────────────────

export async function extractEpub(file) {
  try {
    const ab = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(ab)

    // ── 1. Locate OPF ──────────────────────────────────────────────────────
    const containerXml = await zip.file('META-INF/container.xml').async('string')
    const opfPath = parseXml(containerXml).querySelector('rootfile').getAttribute('full-path')
    if (!opfPath || opfPath.includes('..')) {
      throw new Error('Invalid EPUB: suspicious OPF path')
    }
    const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : ''

    // ── 2. Parse OPF manifest ──────────────────────────────────────────────
    const opfXml = await zip.file(opfPath).async('string')
    const opfDoc = parseXml(opfXml)

    // Dublin Core book metadata — lets auto-import name books properly
    // instead of falling back to the file name.
    const DC_NS = 'http://purl.org/dc/elements/1.1/'
    const dcValue = (tag) => {
      const byNs = opfDoc.getElementsByTagNameNS?.(DC_NS, tag)?.[0]?.textContent
      const byPrefix = opfDoc.getElementsByTagName(`dc:${tag}`)?.[0]?.textContent
      return (byNs || byPrefix || '').replace(/\s+/g, ' ').trim() || null
    }
    const bookTitle = dcValue('title')
    const bookAuthor = dcValue('creator')

    const manifest = {}
    opfDoc.querySelectorAll('manifest item').forEach(el => {
      manifest[el.getAttribute('id')] = {
        href: el.getAttribute('href') || '',
        mediaType: (el.getAttribute('media-type') || '').toLowerCase(),
        properties: (el.getAttribute('properties') || '').toLowerCase(),
      }
    })

    // ── 3. Load all images as base64 data URLs ─────────────────────────────
    // Key: normalized zip path; value: data URL
    const imageMap = {}
    await Promise.all(
      Object.values(manifest)
        .filter(m => m.mediaType.startsWith('image/'))
        .map(async m => {
          const zipPath = opfDir + decodeURIComponent(m.href)
          const entry = zip.file(zipPath)
          if (!entry) return
          try {
            const bytes = await entry.async('uint8array')
            const url = toDataUrl(bytes, m.mediaType)
            imageMap[zipPath] = url
            // Also store by href relative to opfDir (for url() resolution in CSS)
            imageMap[decodeURIComponent(m.href)] = url
          } catch { /* skip corrupt entries */ }
        })
    )

    // ── 4. Extract cover image ─────────────────────────────────────────────
    let cover = null

    // EPUB3: manifest item with properties="cover-image"
    const coverItem = Object.values(manifest).find(
      m => m.properties.includes('cover-image') && m.mediaType.startsWith('image/')
    )
    if (coverItem) {
      cover = imageMap[opfDir + decodeURIComponent(coverItem.href)] ?? null
    }

    // EPUB2 fallback: <meta name="cover" content="cover-image-id"/>
    if (!cover) {
      const metaEl = opfDoc.querySelector('metadata meta[name="cover"]')
      const coverId = metaEl?.getAttribute('content')
      if (coverId && manifest[coverId]) {
        cover = imageMap[opfDir + decodeURIComponent(manifest[coverId].href)] ?? null
      }
    }

    // Last resort: use the first image in the manifest
    if (!cover) {
      const firstImg = Object.values(manifest).find(m => m.mediaType.startsWith('image/'))
      if (firstImg) cover = imageMap[opfDir + decodeURIComponent(firstImg.href)] ?? null
    }

    // ── 5. Load, inline-url, and scope CSS ────────────────────────────────
    const cssTexts = await Promise.all(
      Object.values(manifest)
        .filter(m => m.mediaType === 'text/css')
        .map(async m => {
          const zipPath = opfDir + decodeURIComponent(m.href)
          const entry = zip.file(zipPath)
          if (!entry) return ''
          let css = await entry.async('string')
          css = inlineCssUrls(css, zipPath, imageMap) // resolve url() to data URLs
          return css
        })
    )
    const rawCss = cssTexts.filter(Boolean).join('\n')
    const scopedCss = rawCss ? scopeCss(rawCss, '.epub-content') : ''

    // ── 6. Spine order ─────────────────────────────────────────────────────
    const spineIds = Array.from(opfDoc.querySelectorAll('spine itemref'))
      .map(el => el.getAttribute('idref'))

    // ── 6b. Parse TOC for real chapter titles (EPUB3 nav or EPUB2 NCX) ────
    const normHref = h => decodeURIComponent((h || '').replace(/#.*$/, '').replace(/\\/g, '/'))
    const hrefTitle = {}

    // Try EPUB3 nav document first
    const navManifestItem = Object.values(manifest).find(m => m.properties.includes('nav'))
    if (navManifestItem) {
      const navZipPath = opfDir + decodeURIComponent(navManifestItem.href)
      const navEntry = zip.file(navZipPath)
      if (navEntry) {
        const navHtml = await navEntry.async('string')
        const navDoc = parseXml(navHtml)
        const navEls = Array.from(navDoc.querySelectorAll('nav'))
        const tocNav = navEls.find(el =>
          el.getAttribute('epub:type') === 'toc' ||
          el.getAttribute('type') === 'toc' ||
          (el.id || '').toLowerCase() === 'toc' ||
          (el.className || '').toLowerCase().includes('toc')
        ) ?? navEls[0]
        if (tocNav) {
          tocNav.querySelectorAll('a[href]').forEach(a => {
            const href = normHref(a.getAttribute('href'))
            const title = (a.textContent || '').replace(/\s+/g, ' ').trim()
            if (href && title && !hrefTitle[href]) hrefTitle[href] = title
          })
        }
      }
    }

    // EPUB2 NCX fallback
    if (!Object.keys(hrefTitle).length) {
      const ncxManifestItem = Object.values(manifest).find(m => m.mediaType === 'application/x-dtbncx+xml')
      if (ncxManifestItem) {
        const ncxZipPath = opfDir + decodeURIComponent(ncxManifestItem.href)
        const ncxEntry = zip.file(ncxZipPath)
        if (ncxEntry) {
          const ncxXml = await ncxEntry.async('string')
          const ncxDoc = parseXml(ncxXml)
          ncxDoc.querySelectorAll('navPoint').forEach(np => {
            const src = normHref(np.querySelector('content')?.getAttribute('src') || '')
            const title = (np.querySelector('navLabel text')?.textContent || '').replace(/\s+/g, ' ').trim()
            if (src && title && !hrefTitle[src]) hrefTitle[src] = title
          })
        }
      }
    }

    // Map each spine item to its TOC title (null if not in TOC)
    const tocTitles = spineIds.map(idref => {
      const item = manifest[idref]
      if (!item) return null
      const itemHref = normHref(item.href)
      return hrefTitle[itemHref] ?? hrefTitle[itemHref.split('/').pop()] ?? null
    })

    // ── 7. Extract chapters, resolve images ────────────────────────────────
    const chapters = await Promise.all(
      spineIds.map(async idref => {
        const item = manifest[idref]
        if (!item) return ''
        const zipPath = opfDir + decodeURIComponent(item.href)
        const entry = zip.file(zipPath)
        if (!entry) return ''

        const html = await entry.async('string')
        const doc = parseXml(html)
        const body = doc.querySelector('body')
        if (!body) return html

        // Resolve <img src> to data URLs
        body.querySelectorAll('img[src]').forEach(img => {
          const src = img.getAttribute('src')
          if (!src || src.startsWith('data:') || /^https?:/.test(src)) return
          const resolved = resolvePath(zipPath, decodeURIComponent(src))
          if (resolved.includes('..')) return
          const url = imageMap[resolved] ?? imageMap[opfDir + decodeURIComponent(src)]
          if (url) img.setAttribute('src', url)
          // No url found → leave as broken-img placeholder (doesn't cause errors)
        })

        // Resolve SVG <image href> / <image xlink:href>
        body.querySelectorAll('image').forEach(img => {
          for (const attr of ['href', 'xlink:href']) {
            const src = img.getAttribute(attr)
            if (!src || src.startsWith('data:') || /^https?:/.test(src)) continue
            const resolved = resolvePath(zipPath, decodeURIComponent(src))
            if (resolved.includes('..')) continue
            const url = imageMap[resolved]
            if (url) { img.setAttribute(attr, url); break }
          }
        })

        // Scope inline <style> blocks inside chapter bodies
        body.querySelectorAll('style').forEach(styleEl => {
          let css = styleEl.textContent || ''
          css = inlineCssUrls(css, zipPath, imageMap)
          css = scopeCss(css, '.epub-content')
          styleEl.textContent = css
        })

        // Strip epub-internal navigation hrefs (keep link text)
        body.querySelectorAll('a[href]').forEach(a => {
          const href = a.getAttribute('href')
          if (href && !/^(https?:|mailto:)/.test(href)) a.removeAttribute('href')
        })

        return sanitizeBookHtml(body.innerHTML)
      })
    )

    // ── 8. Assemble final self-contained HTML ──────────────────────────────
    // Filter sections and their TOC titles TOGETHER so tocTitles stays
    // index-aligned with the chapter-break sections in the joined content.
    const sections = chapters
      .map((html, i) => ({ html, title: tocTitles[i] ?? null }))
      .filter(section => isRenderableSection(section.html))
    const bodyHtml = sections.map(section => section.html).join('\n<hr class="chapter-break"/>\n')
    const styleTag = scopedCss ? `<style>${scopedCss}</style>` : ''
    const content = `${styleTag}<div class="epub-content">${bodyHtml}</div>`

    // Estimate page count from plain text length
    const textOnly = bodyHtml.replace(/<[^>]+>/g, '')
    const pages = Math.max(1, Math.round(textOnly.length / 1500))

    return {
      content,
      pages,
      cover,
      tocTitles: sections.map(section => section.title),
      title: bookTitle,
      author: bookAuthor,
    }
  } catch (err) {
    throw new Error(`Failed to parse EPUB: ${err.message}`)
  }
}

export const useEpubExtractor = () => ({ extractEpub })
