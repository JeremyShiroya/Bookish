import { isNativeCapacitorPlatform } from '~/composables/useNativePlatform'

// The PWA service worker is great on the web (installable, offline), but in the
// Capacitor native app it is actively harmful: Capacitor already serves the
// bundled assets locally and offline, so the SW just adds a redundant cache
// layer that serves STALE app bundles after an APK update — which once shipped
// a removed plugin's old code and broke the whole app on launch.
//
// On native we therefore unregister any service worker and drop its caches, so
// every launch runs the fresh assets baked into the APK.
export default defineNuxtPlugin(() => {
  if (!isNativeCapacitorPlatform()) return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  navigator.serviceWorker.getRegistrations()
    .then((registrations) => {
      for (const registration of registrations) registration.unregister()
    })
    .catch(() => {})

  if (typeof caches !== 'undefined') {
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => {})
  }
})
