<template>
  <main class="profile-page">
    <header class="profile-header">
      <button type="button" aria-label="Back" title="Back" @click="goBack">
        <i class="ri-arrow-left-s-line"></i>
      </button>
      <h1>Profile</h1>
      <span aria-hidden="true"></span>
    </header>

    <section class="profile-card" aria-label="Profile details">
      <button
        class="profile-avatar-button"
        type="button"
        aria-label="Choose avatar"
        @click="avatarModalOpen = true"
      >
        <img :src="profileAvatarSrc" :alt="`${profile.displayName} avatar`" />
        <span><i class="ri-image-edit-line"></i></span>
      </button>

      <div class="profile-field">
        <label for="profile-display-name">Display name</label>
        <div class="profile-name-control">
          <input
            id="profile-display-name"
            v-model="profileDraftName"
            type="text"
            maxlength="32"
            placeholder="Reader"
            @keyup.enter="saveProfileDetails"
          />
          <button type="button" aria-label="Save profile" title="Save profile" @click="saveProfileDetails">
            <i class="ri-check-line"></i>
          </button>
        </div>
      </div>

      <button class="choose-avatar-button" type="button" @click="avatarModalOpen = true">
        <i class="ri-image-line"></i>
        <span>Choose an avatar</span>
      </button>
    </section>

    <Teleport to="body">
      <div v-if="avatarModalOpen" class="avatar-modal-layer" role="presentation">
        <button class="avatar-modal-backdrop" type="button" aria-label="Close avatar picker" @click="avatarModalOpen = false"></button>
        <section class="avatar-modal" role="dialog" aria-modal="true" aria-labelledby="avatar-modal-title">
          <header>
            <h2 id="avatar-modal-title">Choose an avatar</h2>
            <button type="button" aria-label="Close avatar picker" @click="avatarModalOpen = false">
              <i class="ri-close-line"></i>
            </button>
          </header>

          <div class="avatar-grid">
            <button
              v-for="avatar in avatarPresets"
              :key="avatar.id"
              type="button"
              :aria-label="`Use ${avatar.label}`"
              :class="{ active: selectedAvatar === avatar.src }"
              @click="selectAvatar(avatar.src)"
            >
              <img :src="avatar.src" :alt="avatar.label" />
            </button>
          </div>
        </section>
      </div>
    </Teleport>
  </main>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useToast } from '~/composables/useToast'
import { useUserProfile } from '~/composables/useUserProfile'

const router = useRouter()
const { addToast } = useToast()
const {
  profile,
  avatarPresets,
  activeAvatarPreset,
  loadProfile,
  updateProfile,
} = useUserProfile()

const avatarModalOpen = ref(false)
const profileDraftName = ref('Reader')
const selectedAvatar = ref('/Images/User%20Avatars/default-user.jpeg')

const profileAvatarSrc = computed(() => {
  return selectedAvatar.value || activeAvatarPreset.value.src
})

const syncProfileDraft = (nextProfile = profile.value) => {
  profileDraftName.value = nextProfile.displayName || 'Reader'
  selectedAvatar.value = nextProfile.avatarValue || '/Images/User%20Avatars/default-user.jpeg'
}

const persistProfile = async (patch, toastMessage) => {
  try {
    await updateProfile({
      displayName: profileDraftName.value,
      avatarType: 'image',
      avatarValue: selectedAvatar.value,
      ...patch,
    })
    syncProfileDraft()
    if (toastMessage) addToast(toastMessage, 'success')
  } catch (error) {
    console.error('[Profile] Failed to save profile:', error)
    addToast(error?.message || 'Could not save profile', 'error')
  }
}

const saveProfileDetails = () => persistProfile({}, 'Profile updated')

const selectAvatar = async (avatarSrc) => {
  selectedAvatar.value = avatarSrc
  avatarModalOpen.value = false
  await persistProfile({ avatarValue: avatarSrc }, 'Avatar updated')
}

const goBack = () => {
  if (window.history.length > 1) router.back()
  else router.push('/')
}

watch(profile, syncProfileDraft, { immediate: true })

onMounted(async () => {
  syncProfileDraft(await loadProfile())
})
</script>

<style scoped>
.profile-page {
  width: 100%;
  min-height: calc(100vh - 88px - env(safe-area-inset-bottom));
  background: var(--color-background-app);
}

.profile-header {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 42px;
  align-items: center;
  min-height: 42px;
  margin-bottom: 1rem;
}

.profile-header button {
  display: inline-flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: 1.35rem;
}

.profile-header h1 {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.98rem;
  line-height: 1;
  text-align: center;
}

.profile-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 0.4rem;
}

.profile-avatar-button {
  position: relative;
  width: 92px;
  height: 92px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
}

.profile-avatar-button img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.08);
}

.profile-avatar-button span {
  position: absolute;
  right: 0;
  bottom: 4px;
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--color-background-app);
  border-radius: 50%;
  background: var(--color-brand-primary);
  color: var(--color-text-on-brand);
}

.profile-field {
  width: min(100%, 360px);
}

.profile-field label {
  display: block;
  margin-bottom: 0.35rem;
  color: var(--color-text-muted);
  font-size: 0.78rem;
}

.profile-name-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 40px;
  gap: 0.5rem;
}

.profile-name-control input {
  width: 100%;
  min-width: 0;
  min-height: 40px;
  border: 1px solid var(--color-border-card);
  border-radius: 8px;
  background: var(--color-surface-input);
  color: var(--color-text-primary);
  padding: 0 0.8rem;
}

.profile-name-control button,
.choose-avatar-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-brand-primary);
  border-radius: 8px;
  background: var(--color-brand-primary);
  color: var(--color-text-on-brand);
  cursor: pointer;
}

.profile-name-control button {
  width: 40px;
  height: 40px;
}

.choose-avatar-button {
  min-height: 40px;
  gap: 0.45rem;
  padding: 0 0.9rem;
}

.avatar-modal-layer {
  position: fixed;
  inset: 0;
  z-index: 1250;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.avatar-modal-backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(15, 23, 42, 0.42);
}

.avatar-modal {
  position: relative;
  width: min(100%, 430px);
  max-height: min(74vh, 580px);
  overflow: auto;
  border-radius: 18px 18px 0 0;
  background: var(--color-background-app);
  padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom));
  box-shadow: var(--shadow-modal);
}

.avatar-modal header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.8rem;
}

.avatar-modal h2 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 1rem;
}

.avatar-modal header button {
  display: inline-flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 1.2rem;
}

.avatar-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.85rem;
}

.avatar-grid button {
  aspect-ratio: 1;
  overflow: hidden;
  border: 2px solid transparent;
  border-radius: 16px;
  background: var(--color-surface-input);
  cursor: pointer;
  padding: 0.35rem;
}

.avatar-grid button.active {
  border-color: var(--color-brand-primary);
}

.avatar-grid img {
  width: 100%;
  height: 100%;
  border-radius: 12px;
  object-fit: cover;
}

@media (min-width: 769px) {
  .profile-page {
    max-width: 640px;
    margin: 0 auto;
  }

  .avatar-modal {
    align-self: center;
    border-radius: 18px;
  }
}
</style>
