import { watch } from 'vue'
import { registerPlugin } from '@capacitor/core'
import { isNativeCapacitorPlatform } from '~/composables/useNativePlatform'
import { useTTS } from '~/composables/useTTS'

// Mirrors narration into the Android media session, so the notification shade
// and lock screen show a Spotify-style player (cover, title, author, seekbar,
// transport controls) while the narrator keeps reading outside the app.
// Control presses come back as "mediaAction" events and drive useTTS.

const BookishMediaSession = registerPlugin('BookishMediaSession')

export default defineNuxtPlugin(() => {
  if (!import.meta.client || !isNativeCapacitorPlatform()) return

  const {
    ttsBook,
    ttsStatus,
    ttsSpeed,
    ttsElapsedSeconds,
    ttsTotalSeconds,
    pause,
    resume,
    stop,
    skipChunks,
    seekToProgress,
  } = useTTS()

  BookishMediaSession.addListener('mediaAction', ({ action, position }) => {
    if (ttsStatus.value === 'idle') return
    if (action === 'play') resume()
    else if (action === 'pause') pause()
    else if (action === 'next') skipChunks(1)
    else if (action === 'previous') skipChunks(-1)
    else if (action === 'stop') stop()
    else if (action === 'seekTo' && Number(ttsTotalSeconds.value) > 0) {
      const pct = (Number(position) / Number(ttsTotalSeconds.value)) * 100
      seekToProgress(Math.max(0, Math.min(100, pct)))
    }
  })

  // Cover art → base64, cached per source so it's fetched once per book.
  let artSrc = null
  let artBase64 = ''
  const coverArtBase64 = async (src) => {
    if (!src) return ''
    if (src === artSrc) return artBase64
    artSrc = src
    artBase64 = ''
    try {
      if (src.startsWith('data:image/')) {
        // SVG placeholders can't decode to an Android Bitmap — skip them.
        if (!src.startsWith('data:image/svg')) artBase64 = src.split(',')[1] || ''
      } else {
        const blob = await (await fetch(src)).blob()
        artBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
      }
    } catch {
      artBase64 = ''
    }
    return artBase64
  }

  let permissionRequested = false
  let lastSentElapsed = -100

  const pushState = async (includeArt) => {
    const book = ttsBook.value
    const status = ttsStatus.value

    if (!book || status === 'idle') {
      lastSentElapsed = -100
      try { await BookishMediaSession.clear() } catch {}
      return
    }

    if (!permissionRequested) {
      permissionRequested = true
      try { await BookishMediaSession.requestNotificationPermission() } catch {}
    }

    const payload = {
      title: book.title || 'Pages',
      artist: book.author || 'Narration',
      playing: status === 'playing',
      position: Math.max(0, Number(ttsElapsedSeconds.value) || 0),
      duration: Math.max(0, Number(ttsTotalSeconds.value) || 0),
      speed: Number(ttsSpeed.value) || 1,
    }
    if (includeArt) payload.artBase64 = await coverArtBase64(book.cover)

    try {
      await BookishMediaSession.update(payload)
    } catch (error) {
      console.warn('[MediaSession] update failed:', error)
    }
  }

  watch(
    [() => ttsBook.value?.id, ttsStatus, ttsSpeed],
    () => {
      lastSentElapsed = -100
      pushState(true)
    },
  )

  // Android extrapolates the seekbar from the last reported position and
  // speed — correct the drift every ~8 seconds of narration.
  watch(ttsElapsedSeconds, (elapsed) => {
    if (ttsStatus.value !== 'playing') return
    if (Math.abs((Number(elapsed) || 0) - lastSentElapsed) < 8) return
    lastSentElapsed = Number(elapsed) || 0
    pushState(false)
  })
})
