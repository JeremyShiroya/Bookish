import JSZip from 'jszip'

function parseXml(xmlString) {
  return new DOMParser().parseFromString(xmlString, 'application/xml')
}

export async function extractEpub(file) {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)

    // 1. Find OPF path from container.xml
    const containerXml = await zip.file('META-INF/container.xml').async('string')
    const containerDoc = parseXml(containerXml)
    const opfPath = containerDoc
      .querySelector('rootfile')
      .getAttribute('full-path')

    // 2. Parse OPF for manifest and spine
    const opfXml = await zip.file(opfPath).async('string')
    const opfDoc = parseXml(opfXml)

    // Build id -> href map from manifest
    const manifestMap = {}
    opfDoc.querySelectorAll('manifest item').forEach(item => {
      manifestMap[item.getAttribute('id')] = item.getAttribute('href')
    })

    // Get spine order
    const spineItems = Array.from(opfDoc.querySelectorAll('spine itemref'))
      .map(ref => ref.getAttribute('idref'))

    // 3. Base directory for relative hrefs (OPF may live in a subdirectory)
    const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : ''

    // 4. Read each chapter and extract body content
    const chapters = await Promise.all(
      spineItems.map(async (idref) => {
        const href = manifestMap[idref]
        if (!href) return ''
        const chapterPath = opfDir + href
        const chapterFile = zip.file(chapterPath)
        if (!chapterFile) return ''
        const html = await chapterFile.async('string')
        const doc = parseXml(html)
        const body = doc.querySelector('body')
        return body ? body.innerHTML : html
      })
    )

    return chapters.join('\n<hr class="chapter-break"/>\n')
  } catch (err) {
    throw new Error(`Failed to parse EPUB: ${err.message}`)
  }
}

export const useEpubExtractor = () => ({ extractEpub })
