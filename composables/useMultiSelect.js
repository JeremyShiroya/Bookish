// Long-press multi-select for a grid or list of items.
//
// Selection mode is entered by pressing and holding one item, and it leaves on
// its own as soon as the last item is deselected — there is no separate "done"
// button to hunt for, and no way to be stuck in a mode with nothing selected.

import { computed, ref } from 'vue'

export const LONG_PRESS_MS = 450
// A finger never holds perfectly still; anything past this is a scroll.
const MOVE_TOLERANCE_PX = 12

export function useMultiSelect() {
  const selectedIds = ref([])
  const selectionMode = ref(false)

  const selectedCount = computed(() => selectedIds.value.length)
  const isSelected = (id) => selectedIds.value.some((item) => String(item) === String(id))

  const clear = () => {
    selectedIds.value = []
    selectionMode.value = false
  }

  const toggle = (id) => {
    const key = String(id)
    selectedIds.value = isSelected(key)
      ? selectedIds.value.filter((item) => String(item) !== key)
      : [...selectedIds.value, key]
    // Emptying the selection is how the user says they are done.
    if (!selectedIds.value.length) selectionMode.value = false
  }

  const start = (id) => {
    selectionMode.value = true
    if (!isSelected(id)) selectedIds.value = [...selectedIds.value, String(id)]
  }

  // Drop ids that no longer exist — a bulk delete or hide removes the very
  // items that were selected.
  const retain = (existingIds) => {
    const alive = new Set((existingIds || []).map(String))
    selectedIds.value = selectedIds.value.filter((id) => alive.has(String(id)))
    if (!selectedIds.value.length) selectionMode.value = false
  }

  return { selectedIds, selectionMode, selectedCount, isSelected, toggle, start, clear, retain }
}

// Touch/mouse plumbing for "press and hold this card". Kept separate from the
// selection state so a component can own several pressable items with one
// timer between them.
export function useLongPress(onLongPress, { delay = LONG_PRESS_MS } = {}) {
  let timer = null
  let origin = null
  let fired = false

  const cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
    origin = null
  }

  const onPointerDown = (event, payload) => {
    // Secondary buttons already have the context menu; only a primary press
    // (or a finger) starts the hold.
    if (event.button !== undefined && event.button !== 0) return
    const point = event.touches?.[0] || event
    origin = { x: point.clientX, y: point.clientY }
    fired = false
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fired = true
      if (navigator.vibrate) navigator.vibrate(12)
      onLongPress(payload, event)
    }, delay)
  }

  const onPointerMove = (event) => {
    if (!origin) return
    const point = event.touches?.[0] || event
    if (Math.hypot(point.clientX - origin.x, point.clientY - origin.y) > MOVE_TOLERANCE_PX) cancel()
  }

  const onPointerUp = () => cancel()

  // A long press must not also count as a tap — otherwise holding a book both
  // selects it and opens it.
  const consumedTap = () => {
    if (!fired) return false
    fired = false
    return true
  }

  return { onPointerDown, onPointerMove, onPointerUp, cancel, consumedTap }
}
