import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUserProfile } from './useUserProfile.js'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

describe('useUserProfile', () => {
  it('notifies mounted UI when the profile is updated', async () => {
    const listener = vi.fn()
    window.addEventListener('bookish:profile-updated', listener)

    const { updateProfile } = useUserProfile()
    await updateProfile({
      displayName: 'New Reader',
      avatarType: 'image',
      avatarValue: '/Images/User%20Avatars/E-commerce-1.svg',
    })

    expect(listener).toHaveBeenCalledTimes(1)

    window.removeEventListener('bookish:profile-updated', listener)
  })
})
