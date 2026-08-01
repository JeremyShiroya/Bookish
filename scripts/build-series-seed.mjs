#!/usr/bin/env node
// Rebuilds public/series-seed.json — the rosters shipped with the app.
//
// WHY A SEED EXISTS: resolving a series costs a rate-limited Goodreads scrape or
// an AI call from a shared quota, and every reader who owns that series pays it
// to learn the same unchanging answer. Bundling series that have already been
// resolved AND verified means a common series is complete the moment the app
// opens — no network, no quota, offline-safe.
//
// ONLY VERIFIED DATA GOES IN. The input is a dump of real resolved caches from a
// device, never a list written by hand or produced by a model: the whole point
// of the pipeline this feeds is that nothing is stored until a provider
// confirmed it, and seeding unverified titles would smuggle around that.
//
//   # 1. dump the caches from a device (Chrome devtools console, or via CDP):
//   #    copy(JSON.stringify(Object.fromEntries(
//   #      Object.keys(localStorage)
//   #        .filter(k => k.startsWith('bookish:series-suggestions:'))
//   #        .map(k => [k.replace('bookish:series-suggestions:',''),
//   #                   JSON.parse(localStorage[k]).installments]))))
//   #
//   # 2. save it, then merge it in:
//   node scripts/build-series-seed.mjs dump.json
//
// Existing seed entries are kept and topped up, so the file grows across runs
// rather than being replaced by whatever one device happened to know.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const seedPath = resolve(root, 'public/series-seed.json')

const input = process.argv[2]
if (!input) {
  console.error('\n  x Usage: node scripts/build-series-seed.mjs <dump.json>\n')
  process.exit(1)
}

const dump = JSON.parse(readFileSync(resolve(input), 'utf8'))
const current = existsSync(seedPath) ? JSON.parse(readFileSync(seedPath, 'utf8')) : { version: 1, series: {} }
const series = { ...(current.series || {}) }

// A slot is only worth shipping if it can actually be shown: a bare number with
// no title helps nobody, and a cover is most of the value.
const usable = (entry) => !!(entry && entry.title)

let addedSeries = 0
let addedBooks = 0

for (const [key, installments] of Object.entries(dump || {})) {
  if (!key || !installments || typeof installments !== 'object') continue

  const existing = series[key]?.installments || {}
  const merged = { ...existing }

  for (const [number, entry] of Object.entries(installments)) {
    if (!/^\d+$/.test(number) || !usable(entry)) continue
    const before = merged[number]
    // Field-by-field, so a thinner dump never strips detail already shipped.
    merged[number] = {
      title: before?.title || entry.title,
      author: before?.author || entry.author || null,
      cover: before?.cover || entry.cover || null,
      year: before?.year || entry.year || null,
    }
    if (!before) addedBooks += 1
  }

  if (!Object.keys(merged).length) continue
  if (!series[key]) addedSeries += 1
  series[key] = { name: series[key]?.name || key, installments: merged }
}

const output = {
  version: 1,
  generatedAt: new Date().toISOString().slice(0, 10),
  series,
}
writeFileSync(seedPath, `${JSON.stringify(output, null, 1)}\n`)

const totalBooks = Object.values(series).reduce((sum, s) => sum + Object.keys(s.installments).length, 0)
console.log(`\n  Seed written to public/series-seed.json`)
console.log(`  ${Object.keys(series).length} series (+${addedSeries}), ${totalBooks} installments (+${addedBooks})`)
console.log(`  ${(JSON.stringify(output).length / 1024).toFixed(1)} KB\n`)
