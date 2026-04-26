export interface ReaderSettings {
  fontSize: number
  fontFamily: 'sans-serif' | 'serif'
  lineHeight: 'compact' | 'normal' | 'relaxed'
}

const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 16,
  fontFamily: 'serif',
  lineHeight: 'normal',
}

export const useReaderSettings = () => {
  const settings = useState<ReaderSettings>('readerSettings', () => ({ ...DEFAULT_SETTINGS }))

  const loadSettings = () => {
    if (import.meta.client) {
      const saved = localStorage.getItem('readerSettings')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          settings.value = { ...DEFAULT_SETTINGS, ...parsed }
        } catch (e) {
          console.error('Failed to parse reader settings:', e)
        }
      }
    }
  }

  const saveSettings = () => {
    if (import.meta.client) {
      localStorage.setItem('readerSettings', JSON.stringify(settings.value))
    }
  }

  const setFontSize = (size: number) => {
    settings.value = {
      ...settings.value,
      fontSize: Math.min(Math.max(size, 12), 24)
    }
  }

  const setFontFamily = (family: 'sans-serif' | 'serif') => {
    settings.value = {
      ...settings.value,
      fontFamily: family
    }
  }

  const setLineHeight = (height: 'compact' | 'normal' | 'relaxed') => {
    settings.value = {
      ...settings.value,
      lineHeight: height
    }
  }

  const resetSettings = () => {
    settings.value = { ...DEFAULT_SETTINGS }
    saveSettings()
  }

  // Line height CSS value
  const lineHeightValue = computed(() => {
    switch (settings.value.lineHeight) {
      case 'compact': return 1.3
      case 'normal': return 1.6
      case 'relaxed': return 1.8
      default: return 1.6
    }
  })

  // Initialize on mount
  onMounted(() => {
    loadSettings()
  })

  // Watch for changes and save
  watch(settings, () => {
    saveSettings()
  }, { deep: true })

  return {
    settings,
    fontSize: computed(() => settings.value.fontSize),
    fontFamily: computed(() => settings.value.fontFamily),
    lineHeight: computed(() => settings.value.lineHeight),
    lineHeightValue,
    loadSettings,
    saveSettings,
    setFontSize,
    setFontFamily,
    setLineHeight,
    resetSettings,
  }
}
