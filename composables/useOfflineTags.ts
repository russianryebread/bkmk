import { useIdb, type Tag } from './idb'

export function useOfflineTags() {
  const { saveTag, saveTags, getTag, getAllTags, deleteTag: idbDeleteTag, addToSyncQueue } = useIdb()
  
  const isOnline = ref(true)
  const offlineError = ref<string | null>(null)

  // Initialize online status
  onMounted(() => {
    isOnline.value = navigator.onLine
    
    window.addEventListener('online', () => {
      console.log('[OfflineTags] Back online')
      isOnline.value = true
      offlineError.value = null
    })
    
    window.addEventListener('offline', () => {
      console.log('[OfflineTags] Gone offline')
      isOnline.value = false
    })
  })

  // Get tags - ALWAYS read from IndexedDB first (local-first)
  async function getTags(): Promise<Tag[]> {
    offlineError.value = null

    // First, read from IndexedDB (instant, local-first)
    console.log('[OfflineTags] Fetching tags from IndexedDB (local-first)')
    try {
      const tags = await getAllTags()
      console.log('[OfflineTags] Returning', tags.length, 'tags from IndexedDB')
      
      // Then refresh from server in background
      if (isOnline.value) {
        refreshFromServer()
      }
      
      return tags
    } catch (e: any) {
      console.error('[OfflineTags] IndexedDB fetch failed:', e)
      offlineError.value = 'Failed to load tags'
      return []
    }
  }

  // Refresh cache from server (background, non-blocking)
  async function refreshFromServer(): Promise<void> {
    if (!isOnline.value) return
    
    try {
      console.log('[OfflineTags] Refreshing cache from server (background)')
      const response = await $fetch<{ tags: any[] }>('/api/tags')
      
      if (response.tags && response.tags.length > 0) {
        const tags: Tag[] = response.tags.map(t => ({
          id: t.id,
          name: t.name,
          parentTagId: t.parentTagId,
          color: t.color,
          createdAt: t.createdAt,
          bookmarkCount: t.bookmarkCount,
        }))
        // Convert to plain object to avoid Vue proxy cloning issues with IndexedDB
        const plainTags = JSON.parse(JSON.stringify(tags))
        await saveTags(plainTags)
        console.log('[OfflineTags] Cache refreshed with', tags.length, 'tags')
      }
    } catch (e: any) {
      console.warn('[OfflineTags] Cache refresh failed:', e.message)
    }
  }

  // Get single tag - always from IndexedDB first
  async function getTagById(id: string): Promise<Tag | null> {
    offlineError.value = null
    
    // First, read from IndexedDB
    try {
      const cached = await getTag(id)
      if (cached) {
        console.log('[OfflineTags] Found tag in IndexedDB:', id)
        
        // Then refresh from server in background
        if (isOnline.value) {
          refreshTagFromServer(id)
        }
        
        return cached
      }
    } catch (e: any) {
      console.warn('[OfflineTags] IndexedDB lookup failed:', e.message)
    }
    
    // If not in cache and online, try server
    if (isOnline.value) {
      try {
        const tags = await getTags()
        return tags.find(t => t.id === id) || null
      } catch (e: any) {
        console.warn('[OfflineTags] Server fetch failed:', e.message)
      }
    }
    
    return null
  }

  // Refresh single tag from server (background, non-blocking)
  async function refreshTagFromServer(id: string): Promise<void> {
    if (!isOnline.value) return
    
    try {
      const tags = await getTags()
      const tag = tags.find(t => t.id === id)
      if (tag) {
        await saveTag(tag)
        console.log('[OfflineTags] Refreshed tag from server:', id)
      }
    } catch (e) {
      // Silently fail - we have cached version
    }
  }

  // Create tag - save locally and queue sync
  async function createTag(data: { name: string; parentTagId?: string | null; color?: string | null }): Promise<Tag | null> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    
    const tag: Tag = {
      id,
      name: data.name,
      parentTagId: data.parentTagId || null,
      color: data.color || null,
      createdAt: now,
      bookmarkCount: 0,
    }

    try {
      // Save to IndexedDB immediately
      await saveTag(tag)
      console.log('[OfflineTags] Created tag locally:', id)
      
      // Queue for sync if online
      if (isOnline.value) {
        try {
          const response = await $fetch<any>('/api/tags', {
            method: 'POST',
            body: { name: tag.name, parent_tag_id: tag.parentTagId, color: tag.color }
          })
          
          // Update with server ID if different
          if (response.tag && response.tag.id !== id) {
            // Delete local with temp ID and save with server ID
            await idbDeleteTag(id)
            tag.id = response.tag.id
            await saveTag(tag)
          }
          console.log('[OfflineTags] Synced tag to server')
        } catch (e) {
          console.warn('[OfflineTags] Failed to sync tag, queuing for later:', e)
          await addToSyncQueue({
            id,
            action: 'create',
            entity: 'tag',
            data: { name: tag.name, parent_tag_id: tag.parentTagId, color: tag.color },
            timestamp: Date.now(),
          })
        }
      } else {
        // Queue for sync when back online
        await addToSyncQueue({
          id,
          action: 'create',
          entity: 'tag',
          data: { name: tag.name, parent_tag_id: tag.parentTagId, color: tag.color },
          timestamp: Date.now(),
        })
      }
      
      return tag
    } catch (e: any) {
      console.error('[OfflineTags] Failed to create tag:', e)
      return null
    }
  }

  // Update tag - save locally and queue sync
  async function updateTag(id: string, data: { name?: string; parentTagId?: string | null; color?: string | null }): Promise<boolean> {
    try {
      // Get current tag
      const current = await getTag(id)
      if (!current) {
        console.error('[OfflineTags] Tag not found:', id)
        return false
      }

      const updated: Tag = {
        ...current,
        name: data.name ?? current.name,
        parentTagId: data.parentTagId !== undefined ? data.parentTagId : current.parentTagId,
        color: data.color !== undefined ? data.color : current.color,
      }

      // Save to IndexedDB immediately
      await saveTag(updated)
      console.log('[OfflineTags] Updated tag locally:', id)

      // Queue for sync if online
      if (isOnline.value) {
        try {
          await $fetch(`/api/tags/${id}`, {
            method: 'PUT',
            body: {
              name: updated.name,
              parent_tag_id: updated.parentTagId,
              color: updated.color,
            }
          })
          console.log('[OfflineTags] Synced tag update to server')
        } catch (e) {
          console.warn('[OfflineTags] Failed to sync tag update, queuing for later:', e)
          await addToSyncQueue({
            id,
            action: 'update',
            entity: 'tag',
            data: {
              name: updated.name,
              parent_tag_id: updated.parentTagId,
              color: updated.color,
            },
            timestamp: Date.now(),
          })
        }
      } else {
        // Queue for sync when back online
        await addToSyncQueue({
          id,
          action: 'update',
          entity: 'tag',
          data: {
            name: updated.name,
            parent_tag_id: updated.parentTagId,
            color: updated.color,
          },
          timestamp: Date.now(),
        })
      }
      
      return true
    } catch (e: any) {
      console.error('[OfflineTags] Failed to update tag:', e)
      return false
    }
  }

  // Delete tag - save locally and queue sync
  async function deleteTag(id: string): Promise<boolean> {
    try {
      // Remove from IndexedDB
      await idbDeleteTag(id)
      console.log('[OfflineTags] Deleted tag from IndexedDB:', id)

      // Queue for sync if online
      if (isOnline.value) {
        try {
          await $fetch(`/api/tags/${id}`, { method: 'DELETE' })
          console.log('[OfflineTags] Synced tag deletion to server')
        } catch (e) {
          console.warn('[OfflineTags] Failed to sync tag deletion, queuing for later:', e)
          await addToSyncQueue({
            id,
            action: 'delete',
            entity: 'tag',
            data: { id },
            timestamp: Date.now(),
          })
        }
      } else {
        // Queue for sync when back online
        await addToSyncQueue({
          id,
          action: 'delete',
          entity: 'tag',
          data: { id },
          timestamp: Date.now(),
        })
      }
      
      return true
    } catch (e: any) {
      console.error('[OfflineTags] Failed to delete tag:', e)
      return false
    }
  }

  return {
    isOnline,
    offlineError,
    getTags,
    getTagById,
    createTag,
    updateTag,
    deleteTag,
  }
}
