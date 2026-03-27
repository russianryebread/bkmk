// Reusable view mode management for list/card views
export type ViewMode = 'card' | 'list'

export function useViewMode() {
  // Store view preference in localStorage
  const viewMode = useState<ViewMode>('viewMode', () => 'card')
  
  // Initialize from localStorage on client
  onMounted(() => {
    const saved = localStorage.getItem('viewMode') as ViewMode
    if (saved && (saved === 'card' || saved === 'list')) {
      viewMode.value = saved
    }
  })
  
  function setViewMode(mode: ViewMode) {
    viewMode.value = mode
    if (import.meta.client) {
      localStorage.setItem('viewMode', mode)
    }
  }
  
  function toggleViewMode() {
    setViewMode(viewMode.value === 'card' ? 'list' : 'card')
  }
  
  return {
    viewMode,
    setViewMode,
    toggleViewMode,
  }
}
