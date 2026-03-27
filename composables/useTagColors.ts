const tagColorsMap: Record<string, { bg: string; text: string }> = {
  red: { bg: '#fee2e2', text: '#991b1b' },
  orange: { bg: '#ffedd5', text: '#9a3412' },
  yellow: { bg: '#fef9c3', text: '#854d0e' },
  green: { bg: '#dcfce7', text: '#166534' },
  blue: { bg: '#dbeafe', text: '#1e40af' },
  purple: { bg: '#f3e8ff', text: '#6b21a8' },
  pink: { bg: '#fce7f3', text: '#9d174d' },
  gray: { bg: '#f3f4f6', text: '#374151' },
}

const defaultColors = Object.values(tagColorsMap)

export function useTagColors() {
  // Import Tag from useTags to share the interface
  const { tags: allTagsData } = useTags()
  const allTags = useState<{ id: string; name: string; color?: string }[]>('allTagsColor', () => [])
  
  // Get IDB instance to access offline tags
  const idb = useIdb()
  
  async function loadAllTags(forceRefresh = false) {
    // Check online status
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : false
    
    // Only skip loading if we have cached data and not forcing refresh
    if (!forceRefresh && allTags.value.length > 0) {
      // If we're offline and have cached data, we're good
      if (!isOnline) {
        return
      }
      // If online, still refresh if data is stale (older than 5 minutes)
      // For simplicity, just return if we have data and are online
      return
    }
    
    // If online, try server first
    if (isOnline) {
      try {
        const response = await $fetch<{ tags: { id: string; name: string; color?: string }[] }>('/api/tags')
        allTags.value = response.tags
        // Also save to IndexedDB for offline use
        if (response.tags && response.tags.length > 0) {
          await idb.saveTags(response.tags.map(t => ({
            id: t.id,
            name: t.name,
            parentTagId: null,
            color: t.color || null,
            createdAt: new Date().toISOString(),
          })))
        }
        return
      } catch (e) {
        console.warn('[TagColors] Failed to fetch tags from server, falling back to IndexedDB:', e)
      }
    }
    
    // Fallback to IndexedDB when offline or server fetch failed
    try {
      const offlineTags = await idb.getAllTags()
      allTags.value = offlineTags.map(t => ({
        id: t.id,
        name: t.name,
        color: t.color || undefined,
      }))
    } catch (e) {
      console.error('[TagColors] Failed to load tags from IndexedDB:', e)
    }
  }



  function getTagColor(tagName: string): { bg: string; text: string } {
    const tag = allTags.value.find(t => t.name.toLowerCase() === tagName.toLowerCase())
    if (tag && tag.color && tagColorsMap[tag.color]) {
      return tagColorsMap[tag.color]!
    }
    // Generate color from name hash
    const hash = tagName.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
    return defaultColors[hash % defaultColors.length]!
  }


  return {
    allTags,
    loadAllTags,
    getTagColor,
    tagColorsMap,
  }
}
