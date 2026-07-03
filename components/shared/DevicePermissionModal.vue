<template>
  <Teleport to="body">
    <Transition name="perm-modal">
      <div v-if="visible" class="perm-overlay" @click.self="answer(false)">
        <section
          class="perm-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="perm-title"
        >
          <div class="perm-icon">
            <i class="ri-folder-open-line"></i>
          </div>

          <h2 id="perm-title">Find books on this phone</h2>
          <p>
            Bookish can scan your phone for PDF and EPUB books and add them to
            your library automatically — new books are picked up every time you
            open the app.
          </p>
          <p class="perm-note">
            On the next screen, allow <strong>“All files access”</strong> for
            Bookish so it can see your documents. Bookish only reads book
            files and never uploads them anywhere.
          </p>

          <div class="perm-actions">
            <button type="button" class="perm-btn secondary" @click="answer(false)">
              Not now
            </button>
            <button type="button" class="perm-btn primary" @click="answer(true)">
              Allow access
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { useDevicePermissionPrompt } from '~/composables/useDevicePermissionPrompt'

const { visible, answer } = useDevicePermissionPrompt()
</script>

<style scoped>
.perm-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
}

.perm-modal {
  width: min(100%, 360px);
  padding: 26px 22px 20px;
  border-radius: 18px;
  background: var(--color-surface-modal);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.35);
  text-align: center;
}

.perm-icon {
  display: grid;
  width: 58px;
  height: 58px;
  margin: 0 auto 14px;
  place-items: center;
  border-radius: 16px;
  background: var(--color-brand-primary-faint, rgba(138, 43, 226, 0.12));
  color: var(--color-brand-primary);
  font-size: 28px;
}

.perm-modal h2 {
  margin: 0 0 10px;
  color: var(--color-text-primary);
  font-size: 19px;
  font-weight: 600;
  line-height: 1.25;
}

.perm-modal p {
  margin: 0 0 10px;
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.5;
}

.perm-note {
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--color-surface-secondary);
  font-size: 13px;
}

.perm-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 16px;
}

.perm-btn {
  min-height: 44px;
  border: 0;
  border-radius: 11px;
  cursor: pointer;
  font-size: 14.5px;
  font-weight: 550;
}

.perm-btn.primary {
  background: var(--color-brand-primary);
  color: #fff;
  box-shadow: 0 6px 16px rgba(138, 43, 226, 0.28);
}

.perm-btn.secondary {
  background: var(--color-surface-secondary);
  color: var(--color-text-secondary);
}

.perm-modal-enter-active,
.perm-modal-leave-active {
  transition: opacity 0.22s ease;
}

.perm-modal-enter-active .perm-modal,
.perm-modal-leave-active .perm-modal {
  transition: transform 0.22s ease;
}

.perm-modal-enter-from,
.perm-modal-leave-to {
  opacity: 0;
}

.perm-modal-enter-from .perm-modal,
.perm-modal-leave-to .perm-modal {
  transform: translateY(14px) scale(0.97);
}
</style>
