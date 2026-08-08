// Client-safe Series Repair & Reconciliation Composable for Pages v1.2.6 (Phase 3D)

import { isUserOverrideProtected } from '~/server/utils/migrationEngine'
import { reconcileSeriesRoster } from '~/server/utils/seriesRosterResolver'

export function normalizeText(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Evaluates candidate metadata search results against an existing book record
 * to determine whether series metadata should be repaired.
 */
export function reconcileAndRepairBookSeries(book, candidateResults = []) {
  const previousState = {
    series: book?.series ?? null,
    seriesInstallment: book?.seriesInstallment ?? null,
    seriesTotal: book?.seriesTotal ?? null,
    seriesChecked: Boolean(book?.seriesChecked),
  }

  // 1. User Override Protection Check
  if (isUserOverrideProtected(book)) {
    return {
      decision: 'PROTECTED',
      reason: 'Book has user-defined series overrides protecting it from automated repair.',
      confidence: 1.0,
      evidenceSources: ['userDefined'],
      previousState,
      proposedState: { ...previousState },
      record: book,
      fieldsModified: [],
    }
  }

  if (!candidateResults || !candidateResults.length) {
    return {
      decision: 'UNCHANGED',
      reason: 'No metadata provider candidates available for evaluation.',
      confidence: 0,
      evidenceSources: [],
      previousState,
      proposedState: { ...previousState },
      record: book,
      fieldsModified: [],
    }
  }

  // Filter candidates that match book title/author
  const bookTitleNorm = normalizeText(book.title)
  const bookAuthorNorm = normalizeText(book.author)

  const matchingCandidates = candidateResults.filter((cand) => {
    if (!cand?.title) return false
    const candTitleNorm = normalizeText(cand.title)
    const titleMatch = bookTitleNorm === candTitleNorm || bookTitleNorm.includes(candTitleNorm) || candTitleNorm.includes(bookTitleNorm)
    if (!titleMatch) return false

    if (bookAuthorNorm && cand.author) {
      const candAuthorNorm = normalizeText(cand.author)
      return bookAuthorNorm === candAuthorNorm || bookAuthorNorm.includes(candAuthorNorm) || candAuthorNorm.includes(bookAuthorNorm)
    }
    return true
  })

  if (!matchingCandidates.length) {
    return {
      decision: 'UNCHANGED',
      reason: 'Provider results did not match book title/author.',
      confidence: 0,
      evidenceSources: [],
      previousState,
      proposedState: { ...previousState },
      record: book,
      fieldsModified: [],
    }
  }

  // Extract series candidates from matching metadata results
  const seriesCandidates = []
  const providerTotals = []
  const sourcesSet = new Set()

  for (const cand of matchingCandidates) {
    const source = cand.primarySource || cand.source || 'provider'
    sourcesSet.add(source)

    if (cand.series) {
      seriesCandidates.push({
        entryType: 'MAIN',
        ordinal: { major: Number(cand.seriesInstallment) || 1, raw: String(cand.seriesInstallment || '1') },
        confidence: cand.confidence || 0.8,
        sourceTags: [source],
      })
    }

    if (cand.seriesTotal && Number(cand.seriesTotal) > 1) {
      providerTotals.push({ provider: source, reportedTotal: Number(cand.seriesTotal) })
    }
  }

  // Best candidate series name
  const bestSeriesName = matchingCandidates.find((c) => c.series)?.series || null
  const bestInstallment = Number(matchingCandidates.find((c) => c.seriesInstallment)?.seriesInstallment) || null

  const evidenceSources = Array.from(sourcesSet)

  if (!bestSeriesName) {
    // If provider match confirms no series, and book has no series
    if (!previousState.series) {
      const isAlreadyChecked = previousState.seriesChecked
      const proposedState = { series: null, seriesInstallment: null, seriesTotal: null, seriesChecked: true }
      if (isAlreadyChecked) {
        return {
          decision: 'UNCHANGED',
          reason: 'Confirmed standalone book already marked seriesChecked.',
          confidence: 0.9,
          evidenceSources,
          previousState,
          proposedState,
          record: book,
          fieldsModified: [],
        }
      }
      return {
        decision: 'REPAIRED',
        reason: 'Confirmed standalone status; marked seriesChecked = true.',
        confidence: 0.9,
        evidenceSources,
        previousState,
        proposedState,
        record: { ...book, series: null, seriesInstallment: null, seriesTotal: null, seriesChecked: true },
        fieldsModified: ['seriesChecked'],
      }
    }
  }

  // Run Series Roster Reconciliation
  const rosterResult = reconcileSeriesRoster(seriesCandidates, providerTotals)

  const reconciledSeriesName = bestSeriesName || previousState.series
  const reconciledInstallment = bestInstallment || previousState.seriesInstallment || 1
  const reconciledTotal = rosterResult.mainWorksCount || (providerTotals.length ? Math.max(...providerTotals.map((p) => p.reportedTotal)) : null)

  // Calculate evidence confidence
  const candConfidences = matchingCandidates.map((c) => (c.confidence !== undefined && c.confidence !== null ? Number(c.confidence) : 0.8))
  const maxCandConfidence = candConfidences.length ? Math.max(...candConfidences) : 0.5
  const confidence = Math.min(1.0, maxCandConfidence)

  const proposedState = {
    series: reconciledSeriesName,
    seriesInstallment: reconciledInstallment,
    seriesTotal: reconciledTotal,
    seriesChecked: true,
  }

  // Compare against previous state
  const seriesChanged = previousState.series !== proposedState.series
  const installmentChanged = previousState.seriesInstallment !== proposedState.seriesInstallment
  const totalChanged = previousState.seriesTotal !== proposedState.seriesTotal
  const checkedChanged = !previousState.seriesChecked

  const isDifferent = seriesChanged || installmentChanged || totalChanged || checkedChanged

  if (!isDifferent) {
    return {
      decision: 'UNCHANGED',
      reason: 'Book series metadata is already at canonical state.',
      confidence,
      evidenceSources,
      previousState,
      proposedState,
      record: book,
      fieldsModified: [],
    }
  }

  // Confidence Gate
  if (confidence < 0.85) {
    return {
      decision: 'LOW_CONFIDENCE',
      reason: `Reconciliation confidence (${confidence.toFixed(2)}) below required 0.85 threshold.`,
      confidence,
      evidenceSources,
      previousState,
      proposedState,
      record: book,
      fieldsModified: [],
    }
  }

  // Apply surgical repair
  const fieldsModified = []
  if (seriesChanged) fieldsModified.push('series')
  if (installmentChanged) fieldsModified.push('seriesInstallment')
  if (totalChanged) fieldsModified.push('seriesTotal')
  if (checkedChanged) fieldsModified.push('seriesChecked')

  const updatedRecord = {
    ...book,
    series: proposedState.series,
    seriesInstallment: proposedState.seriesInstallment,
    seriesTotal: proposedState.seriesTotal,
    seriesChecked: true,
  }

  return {
    decision: 'REPAIRED',
    reason: `Repaired series metadata (${previousState.series || 'None'} #${previousState.seriesInstallment || '?'}/${previousState.seriesTotal || '?'} -> ${proposedState.series} #${proposedState.seriesInstallment}/${proposedState.seriesTotal}).`,
    confidence,
    evidenceSources,
    previousState,
    proposedState,
    record: updatedRecord,
    fieldsModified,
  }
}

export function useSeriesRepair() {
  return {
    reconcileAndRepairBookSeries,
  }
}
