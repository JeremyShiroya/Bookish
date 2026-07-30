import { useAppUpdate } from '~/composables/useAppUpdate'
import { isNativeCapacitorPlatform } from '~/composables/useNativePlatform'

// Checks for a newer sideloaded APK on every app OPEN. Native only — the web
// and desktop builds update themselves by reloading.
//
// "Open" means two different things on a phone, and both have to count:
//   - a cold start, which mounts the app (the timed check below), and
//   - returning to a backgrounded app, which mounts nothing at all.
// Only the first was checked before, so an app left resident for days never
// looked for a release again.
//
// Re-checking on resume is only safe because "Later" is remembered for the
// session (see useAppUpdate.dismiss) — otherwise every task-switch would
// re-open a dialog the user had just dismissed.

// Resumes come in bursts (a resume event plus a visibility change), and the
// manifest does not change second to second.
export const RESUME_RECHECK_INTERVAL_MS = 60 * 1000

export default defineNuxtPlugin((nuxtApp) => {
  if (!isNativeCapacitorPlatform()) return

  let lastCheck = 0

  const check = () => {
    const now = Date.now()
    if (now - lastCheck < RESUME_RECHECK_INTERVAL_MS) return
    lastCheck = now
    // setTimeout and native listeners both drop the Nuxt context, and
    // useAppUpdate is useState-backed — restore it or the composable throws.
    nuxtApp.runWithContext(() => useAppUpdate().checkForUpdate())
  }

  nuxtApp.hook('app:mounted', () => {
    // The delay keeps the network call off the critical path to first paint,
    // and lands after the device-library scan (2.5s) so the two don't compete.
    setTimeout(check, 4000)

    // Coming back from the background.
    import('@capacitor/app')
      .then(({ App }) => App.addListener('resume', check))
      .catch(() => {
        // Plugin unavailable — the visibility listener below still covers it.
      })

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
  })
})
