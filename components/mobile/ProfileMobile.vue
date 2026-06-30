<template>
  <main class="profile-page">
    <section class="profile-hero" aria-label="Profile details">
      <div class="profile-identity">
        <button
          class="profile-avatar-button"
          type="button"
          aria-label="Choose avatar"
          @click="avatarModalOpen = true"
        >
          <span class="profile-avatar-ring">
            <img :src="profileAvatarSrc" :alt="`${profile.displayName} avatar`" />
          </span>
          <span class="avatar-edit-badge"><i class="ri-camera-line"></i></span>
        </button>

        <div class="profile-title">
          <p>Your reading profile</p>
          <h2>{{ profileDraftName || 'Reader' }}</h2>
          <span>Local to this browser</span>
        </div>
      </div>

      <div class="profile-form-card">
        <label class="profile-field" for="profile-display-name">
          <span>Display name</span>
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
        </label>

        <div class="profile-actions">
          <button class="profile-action primary" type="button" @click="saveProfileDetails">
            <i class="ri-save-3-line"></i>
            <span>Save profile</span>
          </button>
          <button class="profile-action" type="button" @click="avatarModalOpen = true">
            <i class="ri-image-line"></i>
            <span>Change avatar</span>
          </button>
        </div>
      </div>
    </section>

    <section class="appearance-panel" aria-labelledby="appearance-title">
      <div>
        <h2 id="appearance-title">Appearance</h2>
        <p>This is how your profile appears in the mobile header.</p>
      </div>

      <div class="profile-preview-card">
        <img :src="profileAvatarSrc" :alt="`${profileDraftName || 'Reader'} preview avatar`" />
        <div>
          <span>Welcome back</span>
          <strong>{{ firstName }}</strong>
        </div>
        <i class="ri-arrow-right-s-line"></i>
      </div>
    </section>

    <Teleport to="body">
      <div v-if="avatarModalOpen" class="avatar-modal-layer" role="presentation">
        <button class="avatar-modal-backdrop" type="button" aria-label="Close avatar picker" @click="avatarModalOpen = false"></button>
        <section class="avatar-modal" role="dialog" aria-modal="true" aria-labelledby="avatar-modal-title">
          <header>
            <div>
              <h2 id="avatar-modal-title">Choose an avatar</h2>
              <p>Select the image Bookish uses for your profile.</p>
            </div>
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
              <span class="avatar-option-name">{{ avatar.label }}</span>
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

const firstName = computed(() => {
  return profileDraftName.value.trim().split(/\s+/)[0] || 'Reader'
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
  color: var(--color-text-primary);
}

.profile-hero,
.appearance-panel {
  border: 1px solid var(--color-border-card);
  border-radius: 14px;
  background:
    radial-gradient(circle at 12% 8%, var(--color-brand-primary-faint), transparent 34%),
    var(--color-surface-card);
}

.profile-hero {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(280px, 1fr);
  gap: 1.25rem;
  align-items: stretch;
  padding: 1.1rem;
}

.profile-identity {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-height: 0;
  gap: 1.2rem;
  padding: 0.5rem;
}

.profile-avatar-button {
  position: relative;
  width: 112px;
  height: 112px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
}

.profile-avatar-ring {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  padding: 6px;
  background: linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary));
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
}

.profile-avatar-ring img {
  width: 100%;
  height: 100%;
  border: 4px solid var(--color-background-app);
  border-radius: 50%;
  object-fit: cover;
  background: var(--color-surface-primary);
}

.avatar-edit-badge {
  position: absolute;
  right: 2px;
  bottom: 10px;
  display: inline-flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--color-background-app);
  border-radius: 50%;
  background: var(--color-brand-primary);
  color: var(--color-text-on-brand);
}

.profile-title p,
.profile-title h2,
.profile-title span,
.appearance-panel h2,
.appearance-panel p,
.avatar-modal h2,
.avatar-modal p {
  margin: 0;
}

.profile-title p {
  color: var(--color-brand-primary-hover);
  font-size: 0.82rem;
}

.profile-title h2 {
  margin-top: 0.25rem;
  color: var(--color-text-primary);
  font-size: clamp(1.75rem, 4vw, 2.6rem);
  line-height: 1.02;
}

.profile-title span,
.appearance-panel p,
.avatar-modal p {
  display: block;
  margin-top: 0.4rem;
  color: var(--color-text-muted);
  font-size: 0.88rem;
  line-height: 1.45;
}

.profile-form-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: 12px;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.16);
}

.profile-field {
  display: block;
  min-width: 0;
}

.profile-field > span {
  display: block;
  margin-bottom: 0.45rem;
  color: var(--color-text-muted);
  font-size: 0.8rem;
}

.profile-name-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 44px;
  gap: 0.55rem;
}

.profile-name-control input {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  border: 1px solid var(--color-border-card);
  border-radius: 9px;
  background: var(--color-surface-input);
  color: var(--color-text-primary);
  padding: 0 0.9rem;
}

.profile-name-control button,
.profile-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border-card);
  border-radius: 9px;
  background: var(--color-surface-card);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.profile-name-control button {
  width: 44px;
  height: 44px;
  color: var(--color-text-on-brand);
  border-color: var(--color-brand-primary);
  background: var(--color-brand-primary);
}

.profile-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}

.profile-action {
  min-height: 44px;
  gap: 0.45rem;
  padding: 0 0.8rem;
}

.profile-action.primary {
  border-color: var(--color-brand-primary);
  background: var(--color-brand-primary);
  color: var(--color-text-on-brand);
}

.appearance-panel {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 340px);
  gap: 1rem;
  align-items: center;
  padding: 1rem;
}

.appearance-panel h2 {
  color: var(--color-text-primary);
  font-size: 1.1rem;
}

.profile-preview-card {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) 20px;
  align-items: center;
  gap: 0.75rem;
  min-height: 68px;
  border: 1px solid var(--color-border-subtle);
  border-radius: 12px;
  padding: 0.65rem;
  background: var(--color-surface-input);
}

.profile-preview-card img {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  object-fit: cover;
}

.profile-preview-card div {
  min-width: 0;
}

.profile-preview-card span,
.profile-preview-card strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-preview-card span {
  color: var(--color-text-muted);
  font-size: 0.76rem;
}

.profile-preview-card strong {
  color: var(--color-text-primary);
  font-size: 1rem;
}

.profile-preview-card i {
  color: var(--color-text-muted);
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
  width: min(100%, 520px);
  max-height: min(78vh, 620px);
  overflow: auto;
  border-radius: 18px 18px 0 0;
  background: var(--color-background-app);
  padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom));
  box-shadow: var(--shadow-modal);
}

.avatar-modal header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.avatar-modal h2 {
  color: var(--color-text-primary);
  font-size: 1.05rem;
}

.avatar-modal header button {
  display: inline-flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  background: var(--color-surface-input);
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
  display: grid;
  gap: 0.5rem;
  min-width: 0;
  overflow: hidden;
  border: 2px solid transparent;
  border-radius: 16px;
  background: var(--color-surface-input);
  cursor: pointer;
  padding: 0.45rem;
  color: var(--color-text-secondary);
}

.avatar-grid button.active {
  border-color: var(--color-brand-primary);
  background: var(--color-brand-primary-faint);
}

.avatar-grid img {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 12px;
  object-fit: cover;
}

.avatar-option-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.72rem;
}

  .profile-page {
    font-family: var(--mobile-font-family);
  }

  .profile-hero,
  .appearance-panel {
    grid-template-columns: 1fr;
    border-radius: var(--mobile-card-radius);
    padding: 16px;
  }

  .profile-hero {
    gap: 16px;
  }

  .profile-identity {
    flex-direction: row;
    align-items: center;
    min-height: 0;
    gap: 16px;
    padding: 0;
  }

  .profile-avatar-button {
    width: 116px;
    height: 116px;
  }

  .profile-title p,
  .profile-title span,
  .appearance-panel p,
  .avatar-modal p {
    font-size: var(--mobile-subtext-size);
  }

  .profile-title h2 {
    font-size: 28px;
    line-height: 1.08;
  }

  .profile-form-card {
    gap: 16px;
    border-radius: var(--mobile-control-radius);
    padding: 16px;
  }

  .profile-field > span {
    font-size: var(--mobile-subtext-size);
  }

  .profile-name-control {
    grid-template-columns: minmax(0, 1fr) var(--mobile-touch-target);
    gap: 8px;
  }

  .profile-name-control input {
    min-height: var(--mobile-touch-target);
    border-radius: var(--mobile-control-radius);
    padding: 0 12px;
    font-size: var(--mobile-body-size);
  }

  .profile-name-control button,
  .profile-action {
    border-radius: var(--mobile-control-radius);
    font-size: var(--mobile-body-size);
  }

  .profile-name-control button {
    width: var(--mobile-touch-target);
    height: var(--mobile-touch-target);
  }

  .profile-actions {
    gap: 8px;
  }

  .profile-action {
    min-height: var(--mobile-touch-target);
  }

  .appearance-panel {
    gap: 16px;
    margin-top: 16px;
  }

  .appearance-panel h2 {
    font-size: var(--mobile-section-title-size);
    line-height: 1.25;
  }

  .profile-preview-card {
    grid-template-columns: var(--mobile-list-icon-size) minmax(0, 1fr) 20px;
    gap: 12px;
    min-height: 68px;
    border-radius: var(--mobile-control-radius);
    padding: 12px;
  }

  .profile-preview-card img {
    width: var(--mobile-list-icon-size);
    height: var(--mobile-list-icon-size);
  }

  .profile-preview-card span {
    font-size: var(--mobile-caption-size);
  }

  .profile-preview-card strong {
    font-size: var(--mobile-body-size);
  }

  .avatar-modal {
    border-radius: var(--mobile-card-radius) var(--mobile-card-radius) 0 0;
    padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
  }

  .avatar-modal h2 {
    font-size: var(--mobile-section-title-size);
  }

  .avatar-modal header button {
    width: var(--mobile-touch-target);
    height: var(--mobile-touch-target);
    font-size: var(--mobile-icon-size);
  }

  .avatar-grid {
    gap: 12px;
  }

  .avatar-grid button {
    border-radius: var(--mobile-panel-radius);
    padding: 8px;
  }

  .avatar-option-name {
    font-size: var(--mobile-caption-size);
  }


@media (max-width: 430px) {
  .profile-actions {
    grid-template-columns: 1fr;
  }

  .avatar-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

</style>
