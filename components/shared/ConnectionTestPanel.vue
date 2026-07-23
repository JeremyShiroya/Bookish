<template>
  <div class="conn-test">
    <section class="card intro-card">
      <div class="card-head">
        <i class="ri-stethoscope-line"></i>
        <div>
          <h2>Connection test</h2>
          <p>Checks the online services Pages uses to find book covers, descriptions and series information.</p>
        </div>
      </div>

      <!-- Overall verdict, in one sentence, before any detail. -->
      <div v-if="finished" class="verdict" :class="`verdict-${overall}`">
        <i :class="statusIcon(overall)"></i>
        <div>
          <strong>{{ verdictTitle }}</strong>
          <span>{{ verdictBody }}</span>
        </div>
      </div>

      <div class="actions">
        <button class="primary-btn" type="button" :disabled="running" @click="runAll">
          <i :class="running ? 'ri-loader-4-line spin' : 'ri-play-circle-line'"></i>
          {{ running ? 'Testing…' : finished ? 'Test again' : 'Run the test' }}
        </button>
        <button
          v-if="finished"
          class="secondary-btn"
          type="button"
          @click="copyReport"
        >
          <i class="ri-file-copy-line"></i>
          Copy results
        </button>
      </div>

      <!-- Clipboard access is refused in some webviews and browsers. Falling
           back to a selectable box means the results can ALWAYS be got out,
           which is the entire point of this screen. -->
      <div v-if="showReportText" class="report-fallback">
        <p>Select all of this and copy it:</p>
        <textarea ref="reportBox" readonly rows="10" :value="reportText"></textarea>
      </div>

      <p v-if="running" class="progress-line">
        Testing {{ currentLabel }}… ({{ completedCount }} of {{ checks.length }})
      </p>
    </section>

    <section class="card">
      <ul class="check-list">
        <li
          v-for="check in checks"
          :key="check.id"
          class="check-row"
          :class="[`state-${stateOf(check.id)}`, { expanded: expanded === check.id }]"
        >
          <button type="button" class="check-main" @click="toggle(check.id)">
            <span class="check-icon">
              <i :class="rowIcon(check.id)"></i>
            </span>
            <span class="check-copy">
              <strong>{{ check.label }}</strong>
              <span class="check-sub">
                {{ results[check.id]?.summary || check.hint }}
              </span>
            </span>
            <i v-if="results[check.id]?.detail" class="ri-arrow-down-s-line chevron"></i>
          </button>

          <p v-if="expanded === check.id && results[check.id]?.detail" class="check-detail">
            {{ results[check.id].detail }}
          </p>
        </li>
      </ul>
    </section>

    <section v-if="finished" class="card note-card">
      <p>
        <i class="ri-information-line"></i>
        Only Google Books needs a key. Open Library, Internet Archive and
        Goodreads are free and open — there is nothing to sign up for.
      </p>
      <p v-if="anyWarn">
        A yellow result usually means a service is busy or has hit a daily
        limit. Pages uses several sources, so book details normally still work.
      </p>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { CHECK_STATUS, buildDiagnosticsReport, useConnectionChecks } from '~/composables/useConnectionChecks'
import { isNativeCapacitorPlatform } from '~/composables/useNativePlatform'
import { useToast } from '~/composables/useToast'

const { checks, runCheck } = useConnectionChecks()
const { addToast } = useToast()
const runtimeConfig = useRuntimeConfig()

const results = ref({})
const running = ref(false)
const finished = ref(false)
const currentLabel = ref('')
const expanded = ref('')
const reportText = ref('')
const showReportText = ref(false)
const reportBox = ref(null)

const completedCount = computed(() => Object.keys(results.value).length)

const stateOf = (id) => {
  if (running.value && currentLabel.value === labelFor(id) && !results.value[id]) return 'running'
  return results.value[id]?.status || 'idle'
}

const labelFor = (id) => checks.find((c) => c.id === id)?.label || ''

const rowIcon = (id) => {
  const state = stateOf(id)
  if (state === 'running') return 'ri-loader-4-line spin'
  return statusIcon(state)
}

const statusIcon = (status) => ({
  [CHECK_STATUS.pass]: 'ri-checkbox-circle-fill',
  [CHECK_STATUS.warn]: 'ri-error-warning-fill',
  [CHECK_STATUS.fail]: 'ri-close-circle-fill',
  [CHECK_STATUS.skipped]: 'ri-subtract-line',
}[status] || 'ri-circle-line')

const anyFail = computed(() => Object.values(results.value).some((r) => r.status === CHECK_STATUS.fail))
const anyWarn = computed(() => Object.values(results.value).some((r) => r.status === CHECK_STATUS.warn))

const overall = computed(() => {
  if (anyFail.value) return CHECK_STATUS.fail
  if (anyWarn.value) return CHECK_STATUS.warn
  return CHECK_STATUS.pass
})

const verdictTitle = computed(() => ({
  [CHECK_STATUS.pass]: 'Everything is working',
  [CHECK_STATUS.warn]: 'Working, with minor issues',
  [CHECK_STATUS.fail]: 'Something is not working',
}[overall.value]))

const verdictBody = computed(() => ({
  [CHECK_STATUS.pass]: 'All the online services Pages uses responded normally.',
  [CHECK_STATUS.warn]: 'One or more services are busy or limited, but book details should still work.',
  [CHECK_STATUS.fail]: 'Tap the failing row below to see the technical detail, then send it on.',
}[overall.value]))

const toggle = (id) => {
  expanded.value = expanded.value === id ? '' : id
}

const runAll = async () => {
  if (running.value) return
  running.value = true
  finished.value = false
  results.value = {}
  expanded.value = ''
  showReportText.value = false
  reportText.value = ''

  try {
    for (const check of checks) {
      currentLabel.value = check.label
      // Assigning a fresh object keeps the list reactive as each result lands,
      // so the user watches it fill in rather than staring at a spinner.
      results.value = { ...results.value, [check.id]: await runCheck(check) }
    }
    finished.value = true
  } finally {
    running.value = false
    currentLabel.value = ''
  }
}

const copyReport = async () => {
  const report = buildDiagnosticsReport(results.value, {
    appVersion: runtimeConfig.public?.appVersion,
    platform: isNativeCapacitorPlatform() ? 'Android app' : 'Web',
  })
  reportText.value = report

  try {
    await navigator.clipboard.writeText(report)
    addToast('Results copied — paste them into your message.', 'success')
    return
  } catch {
    // Clipboard permission is refused in plenty of webviews; fall through.
  }

  // Show the text and pre-select it, so copying is one long-press away.
  showReportText.value = true
  await nextTick()
  try {
    reportBox.value?.focus()
    reportBox.value?.select()
  } catch {}
  addToast('Select the text below and copy it.', 'info')
}
</script>

<style scoped>
.conn-test {
  display: grid;
  gap: 14px;
}

.card {
  padding: 16px;
  border-radius: var(--mobile-card-radius, 20px);
  background: var(--color-surface-primary);
}

.card-head {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.card-head i {
  color: var(--color-brand-primary);
  font-size: 24px;
}

.card-head h2 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--mobile-section-title-size, 1.05rem);
  font-weight: 600;
}

.card-head p {
  margin: 4px 0 0;
  color: var(--color-text-muted);
  font-size: var(--mobile-subtext-size, 0.85rem);
  line-height: 1.4;
}

/* Verdict — the one thing to read if you read nothing else. */
.verdict {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  margin-top: 14px;
  padding: 12px;
  border-radius: 14px;
}

.verdict i {
  font-size: 20px;
}

.verdict strong {
  display: block;
  color: var(--color-text-primary);
  font-size: 0.95rem;
}

.verdict span {
  display: block;
  margin-top: 2px;
  color: var(--color-text-secondary);
  font-size: var(--mobile-subtext-size, 0.85rem);
  line-height: 1.4;
}

.verdict-pass { background: color-mix(in srgb, #16a34a 12%, transparent); }
.verdict-pass i { color: #16a34a; }
.verdict-warn { background: color-mix(in srgb, #d97706 14%, transparent); }
.verdict-warn i { color: #d97706; }
.verdict-fail { background: color-mix(in srgb, #dc2626 12%, transparent); }
.verdict-fail i { color: #dc2626; }

.actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}

.primary-btn,
.secondary-btn {
  display: inline-flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border: 0;
  border-radius: 12px;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
}

.primary-btn {
  background: var(--color-brand-primary);
  color: var(--color-text-on-brand);
}

.primary-btn:disabled { opacity: 0.65; }

.secondary-btn {
  border: 1px solid var(--color-border-subtle);
  background: transparent;
  color: var(--color-text-primary);
}

.progress-line {
  margin: 10px 0 0;
  color: var(--color-text-muted);
  font-size: var(--mobile-subtext-size, 0.85rem);
}

.check-list {
  display: grid;
  margin: 0;
  padding: 0;
  gap: 2px;
  list-style: none;
}

.check-row {
  border-radius: 12px;
}

.check-main {
  display: grid;
  width: 100%;
  grid-template-columns: 26px minmax(0, 1fr) 18px;
  gap: 10px;
  align-items: center;
  padding: 12px 6px;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.check-icon i {
  font-size: 19px;
  color: var(--color-text-muted);
}

.state-pass .check-icon i { color: #16a34a; }
.state-warn .check-icon i { color: #d97706; }
.state-fail .check-icon i { color: #dc2626; }
.state-running .check-icon i { color: var(--color-brand-primary); }

.check-copy strong {
  display: block;
  color: var(--color-text-primary);
  font-size: 0.95rem;
  font-weight: 600;
}

.check-sub {
  display: block;
  margin-top: 2px;
  color: var(--color-text-muted);
  font-size: var(--mobile-subtext-size, 0.82rem);
  line-height: 1.35;
}

.chevron {
  color: var(--color-text-muted);
  font-size: 18px;
  transition: transform 0.18s ease;
}

.expanded .chevron { transform: rotate(180deg); }

/* Monospace so codes and URLs stay readable when copied out. */
.check-detail {
  margin: 0 6px 12px 42px;
  padding: 10px;
  border-radius: 10px;
  background: var(--color-surface-secondary);
  color: var(--color-text-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.75rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.report-fallback {
  margin-top: 12px;
}

.report-fallback p {
  margin: 0 0 6px;
  color: var(--color-text-muted);
  font-size: var(--mobile-subtext-size, 0.85rem);
}

.report-fallback textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--color-border-subtle);
  border-radius: 10px;
  background: var(--color-surface-secondary);
  color: var(--color-text-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.72rem;
  line-height: 1.5;
  resize: vertical;
}

.note-card p {
  display: flex;
  gap: 8px;
  margin: 0 0 8px;
  color: var(--color-text-muted);
  font-size: var(--mobile-subtext-size, 0.85rem);
  line-height: 1.45;
}

.note-card p:last-child { margin-bottom: 0; }
.note-card i { color: var(--color-brand-primary); }

.spin { animation: conn-spin 1s linear infinite; }

@keyframes conn-spin {
  to { transform: rotate(360deg); }
}
</style>
