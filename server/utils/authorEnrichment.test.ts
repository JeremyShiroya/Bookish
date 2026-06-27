import { describe, expect, it } from 'vitest'
import {
  extractAuthorBibliographySummary,
  extractAuthorLeadFacts,
  countDistinctAuthorSeries,
  extractValidatedAuthorTotals,
  selectAuthorCandidate,
} from './authorEnrichment'

describe('author enrichment helpers', () => {
  it('prefers an exact author name whose known work matches the library', () => {
    const candidate = selectAuthorCandidate([
      { key: 'wrong', name: 'John Green', top_work: 'A politician memoir', work_count: 4 },
      { key: 'right', name: 'John Green', top_work: 'The Fault in Our Stars', work_count: 12 },
      { key: 'near', name: 'Jon Green', top_work: 'The Fault in Our Stars', work_count: 20 },
    ], 'John Green', ['The Fault in Our Stars'])

    expect(candidate?.key).toBe('right')
  })

  it('returns null when no candidate has a compatible name', () => {
    expect(selectAuthorCandidate([
      { key: 'wrong', name: 'Richard Dawkins Jr.', top_work: 'Unknown' },
    ], 'Stephenie Meyer', ['Twilight'])).toBeNull()
  })

  it('counts distinct series names across author works', () => {
    expect(countDistinctAuthorSeries([
      { series: ['Twilight'] },
      { series: ['Twilight', 'The Twilight Saga'] },
      { series: [{ name: 'The Host' }] },
      { series: null },
    ])).toBe(3)
  })

  it('counts only explicitly classified full-length books and named series', () => {
    const totals = extractValidatedAuthorTotals(`
== Published works ==
=== Grant County series ===
* ''[[Blindsighted]]'' (2001)
* ''[[Beyond Reach (novel)|Beyond Reach]]'' (2007), ''Skin Privilege'' (UK title)
=== Will Trent series ===
* ''[[Triptych (novel)|Triptych]]'' (2006)
* ''[[Undone (Slaughter novel)|Undone]]'' (2009), ''Genesis'' (UK title)
=== Standalone novels ===
* ''[[Cop Town]]'' (2014)
=== Short stories and novellas ===
* ''Snatched'' (2012, digital novella)
* ''Cleaning the Gold'' (2019, anthology story)
=== Adaptations ===
* ''Pieces of Her'' (television series)
== References ==
* Not a book
`)

    expect(totals).toEqual({
      fullLengthBooks: 5,
      series: 2,
    })
  })

  it('deduplicates repeated titles and alternate regional titles', () => {
    expect(extractValidatedAuthorTotals(`
== Writing ==
=== Novels ===
* ''[[Beyond Reach (novel)|Beyond Reach]]'' / ''Skin Privilege'' (UK title)
* ''Beyond Reach'' (2007)
* ''[[Undone (Slaughter novel)|Undone]]'', ''Genesis'' (international title)
`)).toEqual({
      fullLengthBooks: 2,
      series: 0,
    })
  })

  it('returns unknown totals for an unclassified mixed bibliography', () => {
    expect(extractValidatedAuthorTotals(`
== Bibliography ==
* ''A Novel''
* ''A Short Story''
* ''An Edited Anthology''
`)).toEqual({
      fullLengthBooks: null,
      series: null,
    })
  })

  it('returns unknown totals when no bibliography can be established', () => {
    expect(extractValidatedAuthorTotals('== Biography ==\nKarin is an author.')).toEqual({
      fullLengthBooks: null,
      series: null,
    })
  })

  it('extracts birth date and minimum novel count from author lead text', () => {
    expect(extractAuthorLeadFacts(`
{{Short description|American crime writer (born 1971)}}
{{Infobox writer
| birth_date = {{Birth date and age|1971|1|6}}
}}
'''Karin Slaughter''' (born January 6, 1971) is an American crime writer.
She is the author of more than twenty-five novels, including ''Cop Town'', ''Pretty Girls'' and ''False Witness''.
    `)).toEqual({
      birthDate: '6 Jan 1971',
      minimumFullLengthBooks: 26,
      notableWorks: ['Cop Town', 'Pretty Girls', 'False Witness'],
    })
  })

  it('summarizes dated full-length bibliography sections without short stories', () => {
    expect(extractAuthorBibliographySummary(`
==Writing==
===North Falls series (2025 to present)===
*''We Are All Guilty Here'', 2025<ref>{{cite web|website=[[Amazon (company)|Amazon]]}}</ref>
*''The Secrets We Hide'', 2026
===Will Trent series (2006 to present)===
*''Triptych'', 2006
*''This is Why We Lied'', 2024
===Grant County series (2001 to 2007)===
* ''Blindsighted'', 2001
* ''Kisscut'', 2002
===Standalone Novels===
*''Cop Town'', 2014
*''Girl, Forgotten'', 2022
===Short Stories and Novellas===
*''Cleaning the Gold'', 2019
==References==
    `, 2025)).toEqual({
      fullLengthBooks: 7,
      series: 3,
      latestWork: 'We Are All Guilty Here',
    })
  })
})
