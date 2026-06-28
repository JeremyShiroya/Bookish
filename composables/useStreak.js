import { computed, onMounted } from 'vue'
import { useState } from '#app'

const STORAGE_KEY = 'bookish:usage-streak'

const localDateKey = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const dayNumber = (dateKey) => {
  const [year, month, day] = String(dateKey || '').split('-').map(Number)
  if (!year || !month || !day) return null
  return Math.floor(new Date(year, month - 1, day).getTime() / 86400000)
}

export const useStreak = () => {
  const streakState = useState('bookish:usage-streak', () => ({
    count: 1,
    lastUsedDate: localDateKey(),
  }))

  const save = () => {
    if (!import.meta.client) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(streakState.value))
  }

  const registerUsage = () => {
    if (!import.meta.client) return

    const today = localDateKey()
    let stored = null

    try {
      stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    } catch {
      stored = null
    }

    const previousDate = stored?.lastUsedDate
    const previousCount = Math.max(0, Number(stored?.count) || 0)

    if (!previousDate) {
      streakState.value = { count: 1, lastUsedDate: today }
      save()
      return
    }

    const previousDay = dayNumber(previousDate)
    const currentDay = dayNumber(today)
    const diff = previousDay === null || currentDay === null ? null : currentDay - previousDay

    if (diff === 0) {
      streakState.value = { count: Math.max(1, previousCount), lastUsedDate: today }
      return
    }

    streakState.value = {
      count: diff === 1 ? previousCount + 1 : 1,
      lastUsedDate: today,
    }
    save()
  }

  onMounted(registerUsage)

  return {
    streakCount: computed(() => Math.max(1, Number(streakState.value.count) || 1)),
    registerUsage,
  }
}
