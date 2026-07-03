import { useState } from '#app'

// Promise-based bridge between the device-library sync flow and the styled
// permission modal rendered in app.vue.
let _resolver = null

export const useDevicePermissionPrompt = () => {
  const visible = useState('device-permission-prompt', () => false)

  const ask = () => {
    if (_resolver) return Promise.resolve(false) // already prompting
    visible.value = true
    return new Promise((resolve) => {
      _resolver = resolve
    })
  }

  const answer = (accepted) => {
    visible.value = false
    const resolve = _resolver
    _resolver = null
    resolve?.(accepted === true)
  }

  return { visible, ask, answer }
}
