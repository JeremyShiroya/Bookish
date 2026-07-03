import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.bookish.app',
  appName: 'Bookish',
  webDir: '.output/public',
  bundledWebRuntime: false,
  // The Edge Read Aloud endpoint only accepts WebSocket handshakes from
  // user agents that advertise Microsoft Edge. Appending the Edge-on-Android
  // marker lets the WebView synthesize TTS on-device without a server.
  appendUserAgent: 'EdgA/143.0.0.0',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    // Routes window.fetch through the native HTTP stack, bypassing WebView
    // CORS so on-device metadata search can query Goodreads, Kobo, etc.
    CapacitorHttp: {
      enabled: true,
    },
  },
}

export default config
