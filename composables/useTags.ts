// Re-export Tag type from idb for convenience
export type { Tag } from './idb'

// Lazy initialization - tags are only fetched when needed
let _tags: import('./idb').Tag[] | null = null
let _loading = false
let _error: string | null = null

export function useTags() {
  // Create refs that will hold state - these will sync with module-level vars
  const tags = ref<import('./idb').Tag[]>(_tags || [])
  const loading = ref(_loading)
  const error = ref<string | null>(_error)

  // Sync local refs to module-level cache when they change
  watch(() => tags.value, (val) => { _tags = val }, { deep: true, immediate: true })
  watch(() => loading.value, (val) => { _loading = val }, { immediate: true })
  watch(() => error.value, (val) => { _error = val }, { immediate: true })

  // Get IDB instance for offline access
  const idb = useIdb()

  // Server response type (snake_case)
  interface ServerTag {
    id: string
    name: string
    parent_tag_id: string | null
    color: string | null
    created_at: string
    bookmark_count?: number
  }

  async function fetchTags() {
    loading.value = true
    error.value = null

    try {
      // Try online first
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const response = await $fetch<{ tags: ServerTag[] }>('/api/tags')
        // Transform from server format (snake_case) to idb format (camelCase)
        tags.value = response.tags.map(t => ({
          id: t.id,
          name: t.name,
          parentTagId: t.parent_tag_id,
          color: t.color,
          createdAt: t.created_at,
          bookmarkCount: t.bookmark_count,
        }))
        // Cache to IndexedDB
        await cacheTagsToIndexedDB(tags.value)
        return
      }
      
      // Fall back to IndexedDB
      await loadTagsFromIndexedDB()
    } catch (e: any) {
      // Try offline fallback
      await loadTagsFromIndexedDB()
      if (tags.value.length === 0) {
        error.value = e.message || 'Failed to fetch tags'
      }
    } finally {
      loading.value = false
    }
  }

  async function loadTagsFromIndexedDB() {
    try {
      const offlineTags = await idb.getAllTags()
      tags.value = offlineTags
    } catch (e: any) {
      console.error('[Tags] Failed to load from IndexedDB:', e)
    }
  }

  async function cacheTagsToIndexedDB(serverTags: import('./idb').Tag[]) {
    try {
      // Convert to plain object to avoid Vue proxy cloning issues with IndexedDB
      const plainTags = JSON.parse(JSON.stringify(serverTags))
      await idb.saveTags(plainTags)
    } catch (e: any) {
      console.error('[Tags] Failed to cache to IndexedDB:', e)
    }
  }

  async function fetchTagTree() {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<{ tags: ServerTag[] }>('/api/tags/tree')
      tags.value = response.tags.map(t => ({
        id: t.id,
        name: t.name,
        parentTagId: t.parent_tag_id,
        color: t.color,
        createdAt: t.created_at,
        bookmarkCount: t.bookmark_count,
      }))
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch tag tree'
    } finally {
      loading.value = false
    }
  }

  async function createTag(name: string, parentTagId?: string, color?: string): Promise<import('./idb').Tag | null> {
    try {
      const response = await $fetch<{ tag: ServerTag }>('/api/tags', {
        method: 'POST',
        body: { name, parent_tag_id: parentTagId, color },
      })
      await fetchTags()
      return {
        id: response.tag.id,
        name: response.tag.name,
        parentTagId: response.tag.parent_tag_id,
        color: response.tag.color,
        createdAt: response.tag.created_at,
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to create tag'
      return null
    }
  }

  async function updateTag(id: string, updates: { name?: string; parent_tag_id?: string; color?: string }): Promise<import('./idb').Tag | null> {
    try {
      const response = await $fetch<{ tag: ServerTag }>(`/api/tags/${id}`, {
        method: 'PUT',
        body: updates,
      })
      await fetchTags()
      return {
        id: response.tag.id,
        name: response.tag.name,
        parentTagId: response.tag.parent_tag_id,
        color: response.tag.color,
        createdAt: response.tag.created_at,
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to update tag'
      return null
    }
  }

  async function deleteTag(id: string): Promise<boolean> {
    try {
      await $fetch(`/api/tags/${id}`, {
        method: 'DELETE',
      })
      tags.value = tags.value.filter(t => t.id !== id)
      return true
    } catch (e: any) {
      error.value = e.message || 'Failed to delete tag'
      return false
    }
  }

  async function addTagsToBookmark(bookmarkId: string, tagIds: string[]): Promise<boolean> {
    try {
      await $fetch(`/api/bookmarks/${bookmarkId}/tags`, {
        method: 'POST',
        body: { tag_ids: tagIds },
      })
      return true
    } catch (e: any) {
      error.value = e.message || 'Failed to add tags'
      return false
    }
  }

  async function removeTagsFromBookmark(bookmarkId: string, tagIds: string[]): Promise<boolean> {
    try {
      await $fetch(`/api/bookmarks/${bookmarkId}/tags`, {
        method: 'DELETE',
        body: { tag_ids: tagIds },
      })
      return true
    } catch (e: any) {
      error.value = e.message || 'Failed to remove tags'
      return false
    }
  }

  // ============================================
  // CENTRALIZED TAG FUNCTIONS
  // Used by both bookmarks and notes
  // ============================================

  /**
   * Get all tags from the server or local cache
   * Works for both bookmarks and notes
   */
  async function getAllTags(forceRefresh = false): Promise<import('./idb').Tag[]> {
    if (!forceRefresh && tags.value.length > 0) {
      return tags.value
    }
    await fetchTags()
    return tags.value
  }

  /**
   * Add a tag by name - creates the tag if it doesn't exist
   * Works for both bookmarks (via API) and notes (stored locally)
   */
  async function addTagByName(
    tagName: string,
    itemId?: string,
    itemType: 'bookmark' | 'note' = 'bookmark'
  ): Promise<{ id: string; name: string } | null> {
    const normalizedName = tagName.trim().toLowerCase()
    
    const existingTag = tags.value.find(
      t => t.name.toLowerCase() === normalizedName
    )

    let tagId: string

    if (existingTag) {
      tagId = existingTag.id
    } else {
      const newTag = await handleCreateTag(tagName)
      if (!newTag) return null
      tagId = newTag.id
    }

    if (itemId && itemType === 'bookmark') {
      try {
        await $fetch(`/api/bookmarks/${itemId}/tags`, {
          method: 'POST',
          body: { tag_ids: [tagId] },
        })
      } catch (e) {
        console.error('Failed to add tag to bookmark:', e)
        return null
      }
    }

    return { id: tagId, name: tagName.trim() }
  }

  /**
   * Create a new tag on the server
   */
  async function handleCreateTag(name: string): Promise<{ id: string; name: string } | null> {
    try {
      const response = await $fetch<{ tag: ServerTag }>('/api/tags', {
        method: 'POST',
        body: { name: name.trim() },
      })
      
      const newTag: import('./idb').Tag = {
        id: response.tag.id,
        name: response.tag.name,
        parentTagId: response.tag.parent_tag_id,
        color: response.tag.color,
        createdAt: response.tag.created_at,
      }
      
      if (!tags.value.find(t => t.id === newTag.id)) {
        tags.value.push(newTag)
      }
      
      return { id: newTag.id, name: newTag.name }
    } catch (e: any) {
      console.error('Failed to create tag:', e)
      error.value = e.message || 'Failed to create tag'
      return null
    }
  }

  /**
   * Remove a tag from an item
   */
  async function removeTagByName(
    tagName: string,
    itemId?: string,
    itemType: 'bookmark' | 'note' = 'bookmark'
  ): Promise<boolean> {
    const tag = tags.value.find(t => t.name.toLowerCase() === tagName.toLowerCase())
    if (!tag) return false

    if (itemId && itemType === 'bookmark') {
      try {
        await $fetch(`/api/bookmarks/${itemId}/tags`, {
          method: 'DELETE',
          body: { tag_ids: [tag.id] },
        })
        return true
      } catch (e) {
        console.error('Failed to remove tag from bookmark:', e)
        return false
      }
    }

    return true
  }

  /**
   * Sync tags for an item
   */
  async function syncTags(
    oldTags: string[],
    newTags: string[],
    itemId: string,
    itemType: 'bookmark' | 'note' = 'bookmark'
  ): Promise<boolean> {
    const tagsToAdd = newTags.filter(t => !oldTags.includes(t))
    const tagsToRemove = oldTags.filter(t => !newTags.includes(t))

    for (const tagName of tagsToAdd) {
      await addTagByName(tagName, itemId, itemType)
    }

    for (const tagName of tagsToRemove) {
      await removeTagByName(tagName, itemId, itemType)
    }

    return true
  }

  return {
    tags,
    loading,
    error,
    fetchTags,
    fetchTagTree,
    createTag,
    updateTag,
    deleteTag,
    addTagsToBookmark,
    removeTagsFromBookmark,
    getAllTags,
    addTagByName,
    handleCreateTag,
    removeTagByName,
    syncTags,
  }
}