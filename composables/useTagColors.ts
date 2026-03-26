export interface Tag {
  id: string
  name: string
  color?: string
}

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
  const allTags = useState<Tag[]>('allTags', () => [])
  
  async function loadAllTags() {
    if (allTags.value.length > 0) return
    try {
      const response = await $fetch<{ tags: Tag[] }>('/api/tags')
      allTags.value = response.tags
    } catch (e) {
      console.error('Failed to load tags:', e)
    }
  }

  function getTagColor(tagName: string): { bg: string; text: string } {
    const tag = allTags.value.find(t => t.name.toLowerCase() === tagName.toLowerCase())
    if (tag && tag.color && tagColorsMap[tag.color]) {
      return tagColorsMap[tag.color]
    }
    // Generate color from name hash
    const hash = tagName.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
    return defaultColors[hash % defaultColors.length]
  }

  return {
    allTags,
    loadAllTags,
    getTagColor,
    tagColorsMap,
  }
}
