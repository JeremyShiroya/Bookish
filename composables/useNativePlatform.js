// True when running inside the Capacitor native shell (Android/iOS WebView),
// false on the web app and during SSR/tests.
export function isNativeCapacitorPlatform() {
  if (typeof window === 'undefined') return false
  const capacitor = window.Capacitor
  if (!capacitor) return false
  if (typeof capacitor.isNativePlatform === 'function') return capacitor.isNativePlatform()
  return typeof capacitor.getPlatform === 'function' && capacitor.getPlatform() !== 'web'
}
