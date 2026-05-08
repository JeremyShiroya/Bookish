import JSZip from 'jszip'

function parseXml(xmlString) {
  return new DOMParser().parseFromString(xmlString, 'application/xml')
}

export async function extractEpub(file) {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)

    const containerXml = await zip.file('META-INF/container.xml').async('string')
    const containerDoc = parseXml(containerXml)
    const opfPath = containerDoc
      .querySelector('rootfile')
      .getAttribute('full-path')

    const opfXml = await zip.file(opfPath).async('string')
    const opfDoc = parseXml(opfXml)

    const manifestMap = {}
    opfDoc.querySelectorAll('manifest item').forEach(item => {
      manifestMap[item.getAttribute('id')] = item.getAttribute('href')
    })

    const spineItems = Array.from(opfDoc.querySelectorAll('spine itemref'))
      .map(ref => ref.getAttribute('idref'))

    const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : ''

    const chapters = await Promise.all(
      spineItems.map(async (idref) => {
        const href = manifestMap[idref]
        if (!href) return ''
        const chapterPath = opfDir + decodeURIComponent(href)
        const chapterFile = zip.file(chapterPath)
        if (!chapterFile) return ''
        const html = await chapterFile.async('string')
        const doc = parseXml(html)
        const body = doc.querySelector('body')
        return body ? body.innerHTML : html
      })
    )

    const content = chapters.join('\n<hr class="chapter-break"/>\n')

    // Estimate pages: count total characters and divide by ~1500 chars per page (average)
    const textOnly = content.replace(/<[^>]+>/g, '')
    const estimatedPages = Math.max(1, Math.round(textOnly.length / 1500))

    return { content, pages: estimatedPages }
  } catch (err) {
    throw new Error(`Failed to parse EPUB: ${err.message}`)
  }
}

export const useEpubExtractor = () => ({ extractEpub })
