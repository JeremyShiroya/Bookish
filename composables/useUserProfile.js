import { computed, readonly, ref } from 'vue'
import { useLibraryStore } from '~/composables/useLibraryStore'

export const DEFAULT_USER_PROFILE = Object.freeze({
  id: 'local',
  displayName: 'Reader',
  avatarType: 'image',
  avatarValue: '/Images/User%20Avatars/default-user.jpeg',
})

export const BOOKISH_PROFILE_UPDATED_EVENT = 'bookish:profile-updated'

export const USER_AVATAR_OPTIONS = Object.freeze([
  'Cranks.png',
  'Cranks-1.png',
  'Cranks-2.png',
  'Delivery boy.png',
  'Delivery boy-1.png',
  'Funny Bunny.png',
  'Funny Bunny-4.png',
  'Funny Bunny-6.png',
  'Upstream-1.png',
  'Upstream-2.png',
  'Upstream-4.png',
  'Upstream-5.png',
].map((filename) => ({
  id: filename,
  label: filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
  src: `/Images/User%20Avatars/${encodeURIComponent(filename)}`,
})))

export const PROFILE_AVATAR_PRESETS = Object.freeze([
  {
    id: 'default-user',
    label: 'Default user',
    src: DEFAULT_USER_PROFILE.avatarValue,
  },
  ...USER_AVATAR_OPTIONS,
])

const profileState = ref({ ...DEFAULT_USER_PROFILE })
let loadedFromStorage = false
const USER_AVATAR_PATH_PREFIX = '/Images/User%20Avatars/'

function notifyProfileUpdated(profile) {
  if (!import.meta.client || typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(BOOKISH_PROFILE_UPDATED_EVENT, { detail: profile }))
}

function normalizeProfile(value) {
  const source = value && typeof value === 'object' ? value : {}
  const displayName = String(source.displayName ?? DEFAULT_USER_PROFILE.displayName)
    .trim()
    .slice(0, 32)
  const rawAvatarValue = String(source.avatarValue ?? DEFAULT_USER_PROFILE.avatarValue).trim()
  const avatarValue = rawAvatarValue.startsWith(USER_AVATAR_PATH_PREFIX)
    ? rawAvatarValue
    : DEFAULT_USER_PROFILE.avatarValue

  return {
    ...DEFAULT_USER_PROFILE,
    ...source,
    id: 'local',
    displayName: displayName || DEFAULT_USER_PROFILE.displayName,
    avatarType: 'image',
    avatarValue: avatarValue || DEFAULT_USER_PROFILE.avatarValue,
  }
}

export function getProfileInitial(profile = profileState.value) {
  return profile.displayName?.trim()?.[0]?.toUpperCase() || 'R'
}

export const useUserProfile = () => {
  const { getProfile, saveProfile } = useLibraryStore()

  const loadProfile = async () => {
    if (!import.meta.client || typeof indexedDB === 'undefined') {
      profileState.value = { ...DEFAULT_USER_PROFILE }
      return profileState.value
    }

    profileState.value = normalizeProfile(await getProfile())
    loadedFromStorage = true
    return profileState.value
  }

  if (!loadedFromStorage && import.meta.client) {
    loadProfile()
  }

  const updateProfile = async (patch) => {
    const nextProfile = normalizeProfile({
      ...profileState.value,
      ...patch,
    })

    if (!import.meta.client || typeof indexedDB === 'undefined') {
      profileState.value = nextProfile
      return profileState.value
    }

    profileState.value = normalizeProfile(await saveProfile(nextProfile))
    loadedFromStorage = true
    notifyProfileUpdated(profileState.value)
    return profileState.value
  }

  const activeAvatarPreset = computed(() => {
    return PROFILE_AVATAR_PRESETS.find(preset => preset.src === profileState.value.avatarValue)
      || PROFILE_AVATAR_PRESETS[0]
  })

  return {
    profile: readonly(profileState),
    avatarPresets: USER_AVATAR_OPTIONS,
    activeAvatarPreset,
    getProfileInitial,
    loadProfile,
    updateProfile,
  }
}
