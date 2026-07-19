#!/usr/bin/env node
// Generates the version.json that the in-app update checker fetches.
//
// The version it publishes comes from the SAME two sources the APK and the
// About screen use — package.json for the name, the git commit count for the
// code — so a release can't advertise a version that doesn't match the binary.
//
//   node scripts/generate-version-manifest.mjs \
//     --apk-url https://github.com/<owner>/<repo>/releases/download/v1.3.0/bookish-1.3.0.apk \
//     --notes "Fixed playlist layout" \
//     [--mandatory] [--out version.json]
//
// With --apk-url omitted the url is derived from the git remote and the version
// (printed below, so it can be checked before publishing).

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeUpdateManifest } from '../composables/appUpdateManifest.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const parseArgs = (argv) => {
  const args = { mandatory: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--mandatory') { args.mandatory = true; continue }
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`)
    }
    args[key] = next
    i++
  }
  return args
}

const fail = (message) => {
  console.error(`\n  ✗ ${message}\n`)
  process.exit(1)
}

const gitCommitCount = () => {
  try {
    return execFileSync('git', ['rev-list', '--count', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

// Turns any of git@github.com:owner/repo.git / https://github.com/owner/repo.git
// into "owner/repo".
const githubSlug = () => {
  try {
    const remote = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    const match = /github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/.exec(remote)
    return match ? `${match[1]}/${match[2]}` : null
  } catch {
    return null
  }
}

const args = parseArgs(process.argv.slice(2))

const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const versionName = packageJson.version
if (!versionName) fail('package.json has no "version" field.')

// Mirrors resolveBuildNumber() in nuxt.config.ts and resolveVersionCode() in
// android/app/build.gradle.
const versionCode = process.env.BOOKISH_BUILD_NUMBER?.trim() || gitCommitCount()
if (!versionCode) {
  fail('Cannot resolve versionCode: git history unavailable. Set BOOKISH_BUILD_NUMBER instead.')
}

let apkUrl = args.apkUrl
let derived = false
if (!apkUrl) {
  const slug = githubSlug()
  if (!slug) {
    fail('Could not derive an APK url from the git remote. Pass --apk-url explicitly.')
  }
  apkUrl = `https://github.com/${slug}/releases/download/v${versionName}/bookish-${versionName}.apk`
  derived = true
}

const manifest = {
  versionCode: Number(versionCode),
  versionName,
  apkUrl,
  notes: args.notes || '',
  mandatory: args.mandatory,
  releasedAt: new Date().toISOString(),
}

// Validate with the app's own rules: if this fails, the app would silently
// ignore the release, which is far harder to debug in the field than here.
const accepted = normalizeUpdateManifest(manifest)
if (!accepted) {
  fail(
    'The generated manifest fails the app\'s own validation — it would be ignored.\n'
    + '    The APK url must be https, and versionCode must be a positive integer.\n'
    + `    Got: versionCode=${manifest.versionCode} apkUrl=${manifest.apkUrl}`,
  )
}

const outPath = resolve(root, args.out || 'version.json')
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`)

console.log(`
  ✓ ${outPath}

    versionName  ${manifest.versionName}      (package.json)
    versionCode  ${manifest.versionCode}${' '.repeat(Math.max(1, 10 - String(manifest.versionCode).length))}(git commit count)
    mandatory    ${manifest.mandatory}
    apkUrl       ${manifest.apkUrl}${derived ? '\n                 ^ derived — check this matches the asset you upload' : ''}

  Upload this file AND the APK to the release, so the manifest url stays stable.
`)
