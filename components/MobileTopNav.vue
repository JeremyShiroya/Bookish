<template>
  <header class="mobile-top-nav" aria-label="Profile navigation">
    <button
      class="profile-greeting"
      type="button"
      aria-label="Open profile"
      @click="openProfile"
    >
      <div class="profile-avatar" aria-hidden="true">
        <img :src="profileAvatarSrc" :alt="`${profile.displayName} avatar`" />
      </div>
      <div class="greeting-copy">
        <span>Hello {{ firstName }},</span>
        <strong>Welcome Back!</strong>
      </div>
    </button>

    <div class="nav-actions">
      <div class="streak-pill" title="Reading streak">
        <i class="ri-flashlight-fill"></i>
        <span>{{ streakCount }}</span>
      </div>
      <button
        class="mobile-menu-button"
        type="button"
        aria-label="Open settings"
        title="Open settings"
        @click="openSettings"
      >
        <i class="ri-menu-line"></i>
      </button>
    </div>
  </header>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted } from "vue";
import { useStreak } from "~/composables/useStreak";
import {
  BOOKISH_PROFILE_UPDATED_EVENT,
  useUserProfile,
} from "~/composables/useUserProfile";

const router = useRouter();
const { streakCount } = useStreak();
const { profile, activeAvatarPreset, loadProfile } = useUserProfile();

const profileAvatarSrc = computed(() => {
  return profile.value.avatarType === "image"
    ? profile.value.avatarValue
    : activeAvatarPreset.value.src;
});
const firstName = computed(() => {
  return profile.value.displayName.trim().split(/\s+/)[0] || "Reader";
});

const openProfile = () => {
  router.push("/profile");
};

const openSettings = () => {
  router.push("/settings");
};

const refreshProfile = () => {
  loadProfile();
};

onMounted(() => {
  refreshProfile();
  window.addEventListener(BOOKISH_PROFILE_UPDATED_EVENT, refreshProfile);
});

onBeforeUnmount(() => {
  window.removeEventListener(BOOKISH_PROFILE_UPDATED_EVENT, refreshProfile);
});
</script>

<style scoped>
.mobile-top-nav {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 1100;
  display: none;
  min-height: 74px;
  align-items: center;
  justify-content: space-between;
  gap: 0.7rem;
  padding: calc(12px + env(safe-area-inset-top)) 1rem 0.7rem;
  background: var(--color-background-app);
}

.profile-greeting,
.nav-actions {
  display: flex;
  align-items: center;
  min-width: 0;
}

.profile-greeting {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  gap: 0.7rem;
  text-align: left;
}

.profile-avatar {
  position: relative;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  overflow: hidden;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.08);
}

.profile-avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.greeting-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  color: var(--color-text-primary);
  line-height: 1.04;
}

.greeting-copy span,
.greeting-copy strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.greeting-copy span {
  max-width: min(42vw, 220px);
  font-size: 0.86rem;
}

.greeting-copy strong {
  max-width: min(48vw, 240px);
  font-size: 1.08rem;
}

.nav-actions {
  gap: 0.6rem;
  flex-shrink: 0;
}

.streak-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  min-width: 52px;
  min-height: 32px;
  padding: 0 0.75rem;
  border-radius: 999px;
  background: var(--color-brand-primary-muted);
  color: var(--color-brand-primary);
  font-size: 0.95rem;
  line-height: 1;
}

.streak-pill i {
  font-size: 1rem;
}

.mobile-menu-button {
  display: inline-flex;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: 1.85rem;
}

@media (max-width: 768px) {
  .mobile-top-nav {
    display: flex;
  }
}

@media (max-width: 360px) {
  .mobile-top-nav {
    padding-right: 0.85rem;
    padding-left: 0.85rem;
  }

  .profile-avatar {
    width: 40px;
    height: 40px;
    flex-basis: 40px;
  }

  .nav-actions {
    gap: 0.45rem;
  }

  .streak-pill {
    min-width: 50px;
    padding: 0 0.65rem;
  }
}
</style>
