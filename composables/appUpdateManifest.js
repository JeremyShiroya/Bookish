// Pure update-manifest rules, shared by the app and the release script.
//
// Deliberately free of Nuxt/Capacitor imports so scripts/generate-version-
// manifest.mjs can validate with the EXACT logic the app validates with — a
// manifest that the generator accepts is one the app is guaranteed to accept.

// Android's ceiling for versionCode; anything beyond it can't be a real build.
export const MAX_VERSION_CODE = 2_100_000_000
const MAX_NOTES_LENGTH = 2000

// Only whole positive numbers pass — rejects '12abc', '', null, 1.5, Infinity.
export function toVersionCode(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 && value <= MAX_VERSION_CODE ? value : null
  }
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const parsed = Number(trimmed)
  return parsed > 0 && parsed <= MAX_VERSION_CODE ? parsed : null
}

// The manifest names a url the app hands to the OS, so the scheme is restricted
// to https. Without this a tampered manifest could point at intent:// or
// javascript: and turn the update prompt into an attack surface.
export function isSafeApkUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false
  try {
    return new URL(value.trim()).protocol === 'https:'
  } catch {
    return false
  }
}

// Coerce a fetched manifest into a trusted shape, or null if it can't be
// trusted. Callers must treat null as "no update" rather than as an error.
export function normalizeUpdateManifest(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null

  const versionCode = toVersionCode(raw.versionCode)
  if (!versionCode) return null
  if (!isSafeApkUrl(raw.apkUrl)) return null

  const versionName = typeof raw.versionName === 'string' && raw.versionName.trim()
    ? raw.versionName.trim()
    : String(versionCode)

  const notes = typeof raw.notes === 'string' ? raw.notes.trim().slice(0, MAX_NOTES_LENGTH) : ''

  return {
    versionCode,
    versionName,
    apkUrl: raw.apkUrl.trim(),
    notes,
    // Only an explicit `true` forces the update, so a malformed value can't
    // trap the user in an undismissable dialog.
    mandatory: raw.mandatory === true,
  }
}

// Whether `manifest` describes a build newer than what's installed, and whether
// the user has already chosen to skip it.
export function shouldPromptForUpdate({ installedCode, manifest, skippedCode = null }) {
  if (!manifest) return false
  const installed = toVersionCode(installedCode)
  // An unknown installed version means we can't compare — staying silent beats
  // nagging someone who is already up to date.
  if (!installed) return false
  if (manifest.versionCode <= installed) return false
  // A mandatory update ignores an earlier skip.
  if (manifest.mandatory) return true
  const skipped = toVersionCode(skippedCode)
  return !skipped || skipped < manifest.versionCode
}
