// Centralized tag colors map
// Used by both client and server code

export interface TagColorSet {
  bg: string
  text: string
}

export const tagColorsMap: Record<string, TagColorSet> = {
  red: { bg: '#fee2e2', text: '#991b1b' },
  orange: { bg: '#ffedd5', text: '#9a3412' },
  yellow: { bg: '#fef9c3', text: '#854d0e' },
  green: { bg: '#dcfce7', text: '#166534' },
  blue: { bg: '#dbeafe', text: '#1e40af' },
  purple: { bg: '#f3e8ff', text: '#6b21a8' },
  pink: { bg: '#fce7f3', text: '#9d174d' },
  gray: { bg: '#f3f4f6', text: '#374151' },
}

export const tagColorNames = Object.keys(tagColorsMap)

export const defaultColors = Object.values(tagColorsMap)

/**
 * Get color for a tag by name
 * Uses the tag's color property if available, otherwise generates from name hash
 */
export function getTagColorByName(
  tagName: string,
  tagColor?: string | null
): TagColorSet {
  if (tagColor && tagColorsMap[tagColor]) {
    return tagColorsMap[tagColor]!
  }
  // Generate color from name hash
  const hash = tagName.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
  return defaultColors[hash % defaultColors.length]!
}

/**
 * Get all tag colors map
 */
export function getTagColorsMap(): Record<string, TagColorSet> {
  return tagColorsMap
}
