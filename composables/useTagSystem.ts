// Centralized Tag System Composable
// Consolidates useTags, useOfflineTags, and useTagColors functionality
// Supports filtering by type (bookmark/note/both), hierarchical tree structure, and unified offline sync

import { useIdb, type Tag, type TagNode, type TagType } from './idb'
import { tagColorsMap, defaultColors } from '~/utils/tagColors'


// Module-level state for shared access
let _tags: Tag[] | null = null
let _loading = false
let _error: string | null = null
let _isOnline = true

export function useTagSystem() {
  const idb = useIdb()

  // Create refs that sync with module-level state
  const tags = ref<Tag[]>(_tags || [])
  const loading = ref(_loading)
  const error = ref<string | null>(_error)
  const isOnline = ref(_isOnline)

  // Sync refs to module-level cache
  watch(() => tags.value, (val) => { _tags = val }, { deep: true, immediate: true })
  watch(() => loading.value, (val) => { _loading = val }, { immediate: true })
  watch(() => error.value, (val) => { _error = val }, { immediate: true })
  watch(() => isOnline.value, (val) => { _isOnline = val }, { immediate: true })

  // Initialize online status
  onMounted(() => {
    if (typeof navigator !== 'undefined') {
      isOnline.value = navigator.onLine

      const handleOnline = () => {
        isOnline.value = true
        // Refresh from server when back online
        if (tags.value.length > 0) {
          refreshFromServer()
        }
      }

      const handleOffline = () => {
        isOnline.value = false
      }

      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)

      onUnmounted(() => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      })
    }
  })

  // ==================== TREE STRUCTURE ====================

  /**
   * Build a hierarchical tree structure from flat tags
   */
  function buildTree(tagList: Tag[], filterType?: TagType): TagNode[] {
    // Filter by type if specified
    let filtered = tagList
    if (filterType && filterType !== 'both') {
      filtered = tagList.filter(t => t.type === filterType || t.type === 'both')
    }

    const tagMap = new Map<string, TagNode>()
    const rootTags: TagNode[] = []

    // Create nodes with default properties
    filtered.forEach(tag => {
      tagMap.set(tag.id, {
        ...tag,
        children: [],
        depth: 0,
        expanded: false,
      })
    })

    // Build tree structure
    filtered.forEach(tag => {
      const node = tagMap.get(tag.id)!
      if (tag.parentTagId && tagMap.has(tag.parentTagId)) {
        const parent = tagMap.get(tag.parentTagId)!
        parent.children.push(node)
        node.depth = parent.depth + 1
      } else {
        rootTags.push(node)
      }
    })

    // Sort children alphabetically
    const sortChildren = (nodes: TagNode[]) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name))
      nodes.forEach(node => sortChildren(node.children))
    }
    sortChildren(rootTags)

    return rootTags
  }

  /**
   * Flatten tree to array (for display purposes)
   */
  function flattenTree(tree: TagNode[]): TagNode[] {
    const result: TagNode[] = []
    const flatten = (nodes: TagNode[]) => {
      nodes.forEach(node => {
        result.push(node)
        if (node.children.length > 0) {
          flatten(node.children)
        }
      })
    }
    flatten(tree)
    return result
  }

  // ==================== FILTERING ====================

  /**
   * Get tags filtered by type
   */
  function getTagsByType(type: TagType): Tag[] {
    if (type === 'both') return tags.value
    return tags.value.filter(t => t.type === type || t.type === 'both')
  }

  /**
   * Search tags by name
   */
  function searchTags(query: string, filterType?: TagType): Tag[] {
    let result = tags.value
    if (filterType && filterType !== 'both') {
      result = result.filter(t => t.type === filterType || t.type === 'both')
    }
    if (query) {
      const lowerQuery = query.toLowerCase()
      result = result.filter(t => t.name.toLowerCase().includes(lowerQuery))
    }
    return result
  }

  // ==================== COLORS ====================

  /**
   * Get color for a tag by name
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
   * Get all tag colors map
   */
  function getTagColorsMap() {
    return tagColorsMap
  }

  // ==================== CRUD OPERATIONS ====================

  /**
   * Fetch tags from server or IndexedDB
   */
  async function fetchTags(forceRefresh = false): Promise<Tag[]> {
    if (!forceRefresh && tags.value.length > 0) {
      return tags.value
    }

    loading.value = true
    error.value = null

    try {
      // Try online first
      if (isOnline.value) {
        const response = await $fetch<{ tags: any[] }>('/api/tags')
        tags.value = response.tags.map(t => ({
          id: t.id,
          name: t.name,
          parentTagId: t.parent_tag_id || t.parentTagId || null,
          color: t.color || null,
          type: t.type || 'both',
          description: t.description || null,
          icon: t.icon || null,
          createdAt: t.created_at || t.createdAt,
          bookmarkCount: t.bookmark_count || t.bookmarkCount,
        }))
        // Cache to IndexedDB
        await cacheTagsToIndexedDB(tags.value)
        return tags.value
      }

      // Fall back to IndexedDB
      await loadTagsFromIndexedDB()
      return tags.value
    } catch (e: any) {
      // Try offline fallback
      await loadTagsFromIndexedDB()
      if (tags.value.length === 0) {
        error.value = e.message || 'Failed to fetch tags'
      }
      return tags.value
    } finally {
      loading.value = false
    }
  }

  /**
   * Load tags from IndexedDB
   */
  async function loadTagsFromIndexedDB(): Promise<void> {
    try {
      const offlineTags = await idb.getAllTags()
      tags.value = offlineTags
    } catch (e: any) {
      console.error('[TagSystem] Failed to load from IndexedDB:', e)
    }
  }

  /**
   * Cache tags to IndexedDB
   */
  async function cacheTagsToIndexedDB(serverTags: Tag[]): Promise<void> {
    try {
      const plainTags = JSON.parse(JSON.stringify(serverTags))
      await idb.saveTags(plainTags)
    } catch (e: any) {
      console.error('[TagSystem] Failed to cache to IndexedDB:', e)
    }
  }

  /**
   * Refresh from server (background, non-blocking)
   */
  async function refreshFromServer(): Promise<void> {
    if (!isOnline.value) return

    try {
      const response = await $fetch<{ tags: any[] }>('/api/tags')
      if (response.tags && response.tags.length > 0) {
        const serverTags: Tag[] = response.tags.map(t => ({
          id: t.id,
          name: t.name,
          parentTagId: t.parent_tag_id || t.parentTagId || null,
          color: t.color || null,
          type: t.type || 'both',
          description: t.description || null,
          icon: t.icon || null,
          createdAt: t.created_at || t.createdAt,
          bookmarkCount: t.bookmark_count || t.bookmarkCount,
        }))
        const plainTags = JSON.parse(JSON.stringify(serverTags))
        await idb.saveTags(plainTags)
        tags.value = serverTags
      }
    } catch (e: any) {
      console.warn('[TagSystem] Cache refresh failed:', e.message)
    }
  }

  /**
   * Create a new tag
   */
  async function createTag(data: {
    name: string
    parentTagId?: string | null
    color?: string | null
    type?: TagType
    description?: string | null
    icon?: string | null
  }): Promise<Tag | null> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const tag: Tag = {
      id,
      name: data.name,
      parentTagId: data.parentTagId || null,
      color: data.color || null,
      type: data.type || 'both',
      description: data.description || null,
      icon: data.icon || null,
      createdAt: now,
      bookmarkCount: 0,
    }

    try {
      // Save to IndexedDB immediately
      await idb.saveTag(tag)
      tags.value.push(tag)

      // Queue for sync if online
      if (isOnline.value) {
        try {
          const response = await $fetch<any>('/api/tags', {
            method: 'POST',
            body: {
              name: tag.name,
              parent_tag_id: tag.parentTagId,
              color: tag.color,
              type: tag.type,
              description: tag.description,
              icon: tag.icon,
            }
          })

          // Update with server ID if different
          if (response.tag && response.tag.id !== id) {
            await idb.deleteTag(id)
            tag.id = response.tag.id
            await idb.saveTag(tag)
            // Update local tags array
            const idx = tags.value.findIndex(t => t.id === id)
            if (idx >= 0) tags.value[idx] = tag
          }
        } catch (e) {
          console.warn('[TagSystem] Failed to sync tag, queuing for later:', e)
          await idb.addToSyncQueue({
            id,
            action: 'create',
            entity: 'tag',
            data: {
              name: tag.name,
              parent_tag_id: tag.parentTagId,
              color: tag.color,
              type: tag.type,
              description: tag.description,
              icon: tag.icon,
            },
            timestamp: Date.now(),
          })
        }
      } else {
        // Queue for sync when back online
        await idb.addToSyncQueue({
          id,
          action: 'create',
          entity: 'tag',
          data: {
            name: tag.name,
            parent_tag_id: tag.parentTagId,
            color: tag.color,
            type: tag.type,
            description: tag.description,
            icon: tag.icon,
          },
          timestamp: Date.now(),
        })
      }

      return tag
    } catch (e: any) {
      console.error('[TagSystem] Failed to create tag:', e)
      error.value = e.message || 'Failed to create tag'
      return null
    }
  }

  /**
   * Update an existing tag
   */
  async function updateTag(id: string, data: {
    name?: string
    parentTagId?: string | null
    color?: string | null
    type?: TagType
    description?: string | null
    icon?: string | null
  }): Promise<boolean> {
    try {
      const current = await idb.getTag(id)
      if (!current) {
        console.error('[TagSystem] Tag not found:', id)
        return false
      }

      const updated: Tag = {
        ...current,
        name: data.name ?? current.name,
        parentTagId: data.parentTagId !== undefined ? data.parentTagId : current.parentTagId,
        color: data.color !== undefined ? data.color : current.color,
        type: data.type ?? current.type,
        description: data.description !== undefined ? data.description : current.description,
        icon: data.icon !== undefined ? data.icon : current.icon,
      }

      // Save to IndexedDB immediately
      await idb.saveTag(updated)

      // Update local tags array
      const idx = tags.value.findIndex(t => t.id === id)
      if (idx >= 0) tags.value[idx] = updated

      // Queue for sync if online
      if (isOnline.value) {
        try {
          await $fetch(`/api/tags/${id}`, {
            method: 'PUT',
            body: {
              name: updated.name,
              parent_tag_id: updated.parentTagId,
              color: updated.color,
              type: updated.type,
              description: updated.description,
              icon: updated.icon,
            }
          })
        } catch (e) {
          console.warn('[TagSystem] Failed to sync tag update, queuing for later:', e)
          await idb.addToSyncQueue({
            id,
            action: 'update',
            entity: 'tag',
            data: {
              name: updated.name,
              parent_tag_id: updated.parentTagId,
              color: updated.color,
              type: updated.type,
              description: updated.description,
              icon: updated.icon,
            },
            timestamp: Date.now(),
          })
        }
      } else {
        // Queue for sync when back online
        await idb.addToSyncQueue({
          id,
          action: 'update',
          entity: 'tag',
          data: {
            name: updated.name,
            parent_tag_id: updated.parentTagId,
            color: updated.color,
            type: updated.type,
            description: updated.description,
            icon: updated.icon,
          },
          timestamp: Date.now(),
        })
      }

      return true
    } catch (e: any) {
      console.error('[TagSystem] Failed to update tag:', e)
      error.value = e.message || 'Failed to update tag'
      return false
    }
  }

  /**
   * Delete a tag
   */
  async function deleteTag(id: string): Promise<boolean> {
    try {
      // Remove from IndexedDB
      await idb.deleteTag(id)

      // Remove from local tags array
      tags.value = tags.value.filter(t => t.id !== id)

      // Queue for sync if online
      if (isOnline.value) {
        try {
          await $fetch(`/api/tags/${id}`, { method: 'DELETE' })
        } catch (e) {
          console.warn('[TagSystem] Failed to sync tag deletion, queuing for later:', e)
          await idb.addToSyncQueue({
            id,
            action: 'delete',
            entity: 'tag',
            data: { id },
            timestamp: Date.now(),
          })
        }
      } else {
        // Queue for sync when back online
        await idb.addToSyncQueue({
          id,
          action: 'delete',
          entity: 'tag',
          data: { id },
          timestamp: Date.now(),
        })
      }

      return true
    } catch (e: any) {
      console.error('[TagSystem] Failed to delete tag:', e)
      error.value = e.message || 'Failed to delete tag'
      return false
    }
  }

  // ==================== TAG OPERATIONS FOR ITEMS ====================

  /**
   * Add tag by name to an item (bookmark or note)
   * Creates the tag if it doesn't exist
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
      const newTag = await createTag({ name: tagName.trim() })
      if (!newTag) return null
      tagId = newTag.id
    }

    if (itemId) {
      await addItemTag(itemId, tagId, itemType)
    }

    return { id: tagId, name: tagName.trim() }
  }

  /**
   * Add tag to item
   */
  async function addItemTag(itemId: string, tagId: string, itemType: 'bookmark' | 'note'): Promise<boolean> {
    try {
      const endpoint = itemType === 'bookmark'
        ? `/api/bookmarks/${itemId}/tags`
        : `/api/notes/markdown/${itemId}/tags`

      await $fetch(endpoint, {
        method: 'POST',
        body: { tag_ids: [tagId] },
      })
      return true
    } catch (e) {
      console.error(`[TagSystem] Failed to add tag to ${itemType}:`, e)
      return false
    }
  }

  /**
   * Remove tag from item
   */
  async function removeItemTag(itemId: string, tagId: string, itemType: 'bookmark' | 'note'): Promise<boolean> {
    try {
      const endpoint = itemType === 'bookmark'
        ? `/api/bookmarks/${itemId}/tags`
        : `/api/notes/markdown/${itemId}/tags`

      await $fetch(endpoint, {
        method: 'DELETE',
        body: { tag_ids: [tagId] },
      })
      return true
    } catch (e) {
      console.error(`[TagSystem] Failed to remove tag from ${itemType}:`, e)
      return false
    }
  }

  /**
   * Sync tags for an item (add new, remove old)
   */
  async function syncItemTags(
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
      const tag = tags.value.find(t => t.name.toLowerCase() === tagName.toLowerCase())
      if (tag) {
        await removeItemTag(itemId, tag.id, itemType)
      }
    }

    return true
  }

  // ==================== TREE OPERATIONS ====================

  /**
   * Toggle node expanded state
   */
  function toggleNodeExpanded(nodeId: string, tree: TagNode[]): void {
    const findAndToggle = (nodes: TagNode[]): boolean => {
      for (const node of nodes) {
        if (node.id === nodeId) {
          node.expanded = !node.expanded
          return true
        }
        if (node.children.length > 0 && findAndToggle(node.children)) {
          return true
        }
      }
      return false
    }
    findAndToggle(tree)
  }

  /**
   * Expand all nodes
   */
  function expandAll(tree: TagNode[]): void {
    const expand = (nodes: TagNode[]) => {
      nodes.forEach(node => {
        node.expanded = true
        if (node.children.length > 0) {
          expand(node.children)
        }
      })
    }
    expand(tree)
  }

  /**
   * Collapse all nodes
   */
  function collapseAll(tree: TagNode[]): void {
    const collapse = (nodes: TagNode[]) => {
      nodes.forEach(node => {
        node.expanded = false
        if (node.children.length > 0) {
          collapse(node.children)
        }
      })
    }
    collapse(tree)
  }

  return {
    // State
    tags,
    loading,
    error,
    isOnline,

    // Tree operations
    buildTree,
    flattenTree,
    toggleNodeExpanded,
    expandAll,
    collapseAll,

    // Filtering
    getTagsByType,
    searchTags,

    // Colors
    getTagColor,
    getTagColorsMap,
    tagColorsMap,

    // CRUD
    fetchTags,
    createTag,
    updateTag,
    deleteTag,

    // Item operations
    addTagByName,
    addItemTag,
    removeItemTag,
    syncItemTags,
  }
}
