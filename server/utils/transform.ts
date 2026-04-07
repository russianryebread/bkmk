/**
 * Shared transformation utilities for API responses
 */

/**
 * Transform raw database bookmark row to API response format
 */
export function transformBookmark(row: any): any {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    description: row.description,
    cleaned_markdown: row.cleanedMarkdown,
    original_html: row.originalHtml,
    reading_time_minutes: row.readingTimeMinutes,
    saved_at: row.savedAt,
    last_accessed_at: row.lastAccessedAt,
    is_favorite: Boolean(row.isFavorite),
    sort_order: row.sortOrder,
    thumbnail_image_path: row.thumbnailImagePath,
    is_read: Boolean(row.isRead),
    read_at: row.readAt,
    source_domain: row.sourceDomain,
    word_count: row.wordCount,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    tags: [],
    tag_ids: [],
  }
}

/**
 * Add tags to already-transformed bookmark
 */
export function addTagsToBookmark(bookmark: any, tagName: string | null, tagId: string | null): any {
  if (tagName) {
    bookmark.tags.push(tagName)
  }
  if (tagId) {
    bookmark.tag_ids.push(tagId)
  }
  return bookmark
}

/**
 * Transform raw database note row to API response format
 */
export function transformNote(row: any): any {
  return {
    ...row,
    isFavorite: Boolean(row.isFavorite),
  }
}

/**
 * Add tags to already-transformed note
 */
export function addTagsToNote(note: any, tagNames: string[]): any {
  return {
    ...note,
    tags: tagNames,
  }
}

/**
 * Group rows by entity ID and aggregate related data
 */
export function groupByEntity<T extends Record<string, any>>(
  rows: T[],
  idKey: keyof T,
  transformFn: (entity: T, accumulated: any) => any
): any[] {
  const entityMap = new Map<string, any>()
  
  for (const row of rows) {
    const id = String(row[idKey])
    if (!entityMap.has(id)) {
      entityMap.set(id, transformFn(row, { tags: [], tag_ids: [] }))
    }
  }
  
  return Array.from(entityMap.values())
}