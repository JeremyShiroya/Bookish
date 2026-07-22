import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.bookish.app',
  // Display name only. appId stays com.bookish.app on purpose: it is the
  // installed app's identity, and changing it would land on devices as a
  // brand-new app, orphaning every existing library, setting and import.
  appName: 'Pages',
  webDir: '.output/public',
  bundledWebRuntime: false,
  // The Edge Read Aloud endpoint only accepts WebSocket handshakes from
  // user agents that advertise Microsoft Edge. Appending the Edge-on-Android
  // marker lets the WebView synthesize TTS on-device without a server.
  appendUserAgent: 'EdgA/143.0.0.0',
  server: {
    androidScheme: 'https',
  },
  // Capacitor's verbose bridge logging stringifies EVERY plugin argument into
  // a log line — including a whole book's base64 when writing a PDF. That
  // StringBuilder.toString() was itself a ~54MB allocation and crashed the app
  // inside Capacitor's own Bridge. Nothing needs those megabytes echoed.
  loggingBehavior: 'production',
  plugins: {
    // Routes window.fetch through the native HTTP stack, bypassing WebView
    // CORS so on-device metadata search can query Goodreads, Kobo, etc.
    CapacitorHttp: {
      enabled: true,
    },
  },
}

export default config
