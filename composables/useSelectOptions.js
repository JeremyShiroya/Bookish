export function normalizeSelectOptions(options = []) {
  return options.map(option => {
    if (typeof option === 'string' || typeof option === 'number') {
      return { value: option, label: String(option), disabled: false }
    }
    return {
      value: option?.value,
      label: String(option?.label ?? option?.value ?? ''),
      disabled: !!option?.disabled,
    }
  })
}

export function nextEnabledOptionIndex(options = [], currentIndex = -1, direction = 1) {
  if (!options.length) return -1
  const step = direction < 0 ? -1 : 1
  let index = currentIndex

  for (let attempts = 0; attempts < options.length; attempts += 1) {
    index = (index + step + options.length) % options.length
    if (!options[index]?.disabled) return index
  }
  return currentIndex
}
