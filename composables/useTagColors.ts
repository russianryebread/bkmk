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

// Re-export Tag type from useTags
export type { Tag } from './useTags'

export function useTagColors() {
  // Directly use the shared tags from useTags
  const { tags, getAllTags } = useTags()
  
  // Derive the allTags state from the centralized tags
  const allTags = computed(() => {
    return tags.value.map(t => ({
      id: t.id,
      name: t.name,
      color: t.color || undefined,
    }))
  })
  
  async function loadAllTags(forceRefresh = false) {
    await getAllTags(forceRefresh)
  }

  /**
   * Get color for a tag by name
   * @param tagName - The name of the tag
   * @returns Object with bg and text color
   */
  function getTagColor(tagName: string): { bg: string; text: string } {
    const tag = tags.value.find(t => t.name.toLowerCase() === tagName.toLowerCase())
    if (tag && tag.color && tagColorsMap[tag.color]) {
      return tagColorsMap[tag.color]!
    }
    // Generate color from name hash
    const hash = tagName.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
    return defaultColors[hash % defaultColors.length]!
  }

  /**
   * Get all unique tag colors as a map
   */
  function getTagColorsMap() {
    return tagColorsMap
  }

  return {
    allTags,
    loadAllTags,
    getTagColor,
    getTagColorsMap,
    tagColorsMap,
  }
}