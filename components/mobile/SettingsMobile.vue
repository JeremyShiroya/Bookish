<template>
  <div class="profile">
    <MobileSettingsNav title="Settings" back-to="/" aria-label="Settings navigation" />

    <div class="profile-container">
      <section class="section">
        <div
          v-for="row in mobileSettingsRows"
          :key="row.label"
          class="setting-item"
          @click="handleSettingsRow(row)"
        >
          <div class="setting-info">
            <i :class="row.icon"></i>
            <span>{{ row.label }}</span>
          </div>

          <span
            v-if="row.type === 'theme'"
            class="theme-toggle"
            role="switch"
            aria-label="Toggle dark mode"
            :aria-checked="settings.readerTheme === 'dark'"
          >
            <span></span>
          </span>
          <i v-else class="ri-arrow-right-s-line right-icon"></i>
        </div>

        <div class="about-item">
          <span>Version {{ appVersion }}</span>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import MobileSettingsNav from '~/components/mobile/MobileSettingsNav.vue'
import { useBookishSettings } from '~/composables/useBookishSettings'
import { useToast } from '~/composables/useToast'

const runtimeConfig = useRuntimeConfig()
const { settings, updateSettings } = useBookishSettings()
const { addToast } = useToast()
const router = useRouter()
const appVersion = computed(() => runtimeConfig.public.appVersion || '0.0.0')

const mobileSettingsRows = [
  { label: 'Theme', icon: 'ri-moon-line', type: 'theme' },
  { label: 'Preferences', icon: 'ri-edit-box-line', to: '/settings/preferences' },
  { label: 'Storage', icon: 'ri-database-2-line', to: '/settings/storage' },
  { label: 'About', icon: 'ri-information-line', to: '/settings/about' },
  { label: 'Privacy Policy', icon: 'ri-lock-line', to: '/settings/privacy' },
  { label: 'Support the Project', icon: 'ri-hand-heart-line', comingSoon: true },
]

const navigate = (path) => {
  router.push(path)
}

const handleSettingsRow = (row) => {
  if (row.type === 'theme') {
    setReaderTheme(settings.value.readerTheme === 'dark' ? 'light' : 'dark')
    return
  }

  if (row.to) {
    navigate(row.to)
    return
  }

  addToast(`${row.label} page is coming later.`, 'info')
}

const setReaderTheme = (readerTheme) => updateSettings({ readerTheme })
</script>

<style scoped>
.profile {
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  background-color: var(--color-background-app);
  font-family: var(--mobile-font-family);
}

.profile-container {
  flex: 1;
  padding: 10px 0 100px;
}

.section {
  margin-bottom: 24px;
}

.setting-item {
  display: grid;
  width: 100%;
  align-items: center;
  grid-template-columns: minmax(0, 1fr) auto;
  margin-bottom: 8px;
  padding: 14px 0;
  background-color: var(--color-background-app);
  cursor: pointer;
}

.setting-item:active {
  background-color: var(--color-surface-hover);
}

.setting-info {
  display: grid;
  align-items: center;
  grid-template-columns: 20px minmax(0, 1fr);
  column-gap: 12px;
  min-width: 0;
  padding-left: 16px;
}

.setting-info span {
  min-width: 0;
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: 18px;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.setting-info i {
  color: var(--color-text-primary);
  font-size: 20px;
  line-height: 1;
  text-align: center;
}

.right-icon {
  padding-right: 16px;
  color: var(--color-text-muted);
  font-size: 20px;
  line-height: 1;
}

.theme-toggle {
  position: relative;
  width: 42px;
  height: 24px;
  margin-right: 16px;
  border-radius: 999px;
  background: var(--color-border-card);
  transition: background-color 0.2s ease;
}

.theme-toggle span {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: var(--color-surface-primary);
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.18);
  transition: transform 0.2s ease;
}

.theme-toggle[aria-checked='true'] {
  background: var(--color-brand-primary);
}

.theme-toggle[aria-checked='true'] span {
  transform: translateX(18px);
}

.about-item {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  background-color: var(--color-background-app);
  color: var(--color-text-muted);
  font-size: 16px;
}
</style>
