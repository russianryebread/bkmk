export const useDarkMode = () => {
  const isDark = useState<boolean>('darkMode', () => false)

  const init = () => {
    if (import.meta.client) {
      const stored = localStorage.getItem('darkMode')
      if (stored !== null) {
        isDark.value = stored === 'true'
      } else {
        isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
      }
      updateHtmlClass()
    }
  }

  const updateHtmlClass = () => {
    if (import.meta.client) {
      if (isDark.value) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  }

  const toggle = () => {
    isDark.value = !isDark.value
    if (import.meta.client) {
      localStorage.setItem('darkMode', String(isDark.value))
      updateHtmlClass()
    }
  }

  // Initialize on client mount
  onMounted(() => {
    init()
  })

  // Watch for changes and update class
  watch(isDark, () => {
    updateHtmlClass()
  })

  return {
    isDark,
    toggle,
    init
  }
}
