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

  // Get tags - try online first, fallback to IndexedDB
  async function getTags(): Promise<Tag[]> {
    offlineError.value = null

    // Try online fetch first
    if (isOnline.value) {
      try {
        console.log('[OfflineTags] Fetching tags from server')
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
          
          // Cache in IndexedDB
          await saveTags(tags)
          console.log('[OfflineTags] Cached', tags.length, 'tags')
          return tags
        }
        
        return []
      } catch (e: any) {
        console.warn('[OfflineTags] Server fetch failed:', e)
        offlineError.value = e?.data?.message || 'Server unavailable, using cached data'
      }
    }

    // Fallback to IndexedDB
    console.log('[OfflineTags] Fetching tags from IndexedDB')
    try {
      const tags = await getAllTags()
      console.log('[OfflineTags] Returning', tags.length, 'tags from IndexedDB')
      return tags
    } catch (e: any) {
      console.error('[OfflineTags] IndexedDB fetch failed:', e)
      offlineError.value = 'Failed to load tags'
      return []
    }
  }

  // Get single tag
  async function getTagById(id: string): Promise<Tag | null> {
    offlineError.value = null
    
    // Try online first
    if (isOnline.value) {
      try {
        const tags = await getTags()
        return tags.find(t => t.id === id) || null
      } catch (e: any) {
        console.warn('[OfflineTags] Server fetch failed, falling back to IndexedDB:', e.message)
      }
    }

    // Fallback to IndexedDB
    try {
      return await getTag(id)
    } catch (e: any) {
      console.error('[OfflineTags] IndexedDB fetch failed:', e)
      return null
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
