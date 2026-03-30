import { useIdb } from './idb'
import type { Note, Secret, Tag } from './idb'

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline'

interface SyncQueueItem {
  id: string
  action: 'create' | 'update' | 'delete'
  entity: 'note' | 'secret' | 'tag'
  data: any
  timestamp: number
  retries: number
}

export function useSync() {
  // Get IDB instance directly without destructuring to avoid cloning refs
  const idb = useIdb()
  
  const isOnline = ref(true)
  const isSyncing = ref(false)
  const syncStatus = ref<SyncStatus>('idle')
  const lastSyncTime = ref<Date | null>(null)
  const pendingChanges = ref(0)
  const syncError = ref<string | null>(null)
  
  let syncInterval: ReturnType<typeof setInterval> | null = null

  // Initialize online status listeners
  function initOnlineStatus() {
    console.log('[Sync] Initializing online status listeners')
    
    isOnline.value = navigator.onLine
    
    // Sync when coming back online
    window.addEventListener('online', () => {
      console.log('[Sync] Online event received')
      isOnline.value = true
      syncStatus.value = 'idle'
      // Don't auto-sync on online - let user trigger manually or rely on page load
    })
    
    // Mark as offline
    window.addEventListener('offline', () => {
      console.log('[Sync] Offline event received')
      isOnline.value = false
      syncStatus.value = 'offline'
      syncError.value = null
    })
  }

  // Perform sync with server
  async function performSync(): Promise<boolean> {
    if (!isOnline.value || isSyncing.value) {
      console.log('[Sync] Skipping sync -', !isOnline.value ? 'offline' : 'already syncing')
      return false
    }

    console.log('[Sync] Starting sync...')
    isSyncing.value = true
    syncStatus.value = 'syncing'
    syncError.value = null

    try {
      // 1. Process pending sync queue
      const queue = await idb.getSyncQueue()
      console.log('[Sync] Processing', queue.length, 'queued operations')
      
      for (const item of queue) {
        try {
          await processSyncItem(item)
          await idb.removeFromSyncQueue(item.id)
          console.log('[Sync] Processed sync item:', item.action, item.entity, item.id)
        } catch (e) {
          console.error('[Sync] Failed to process item:', item.id, e)
          item.retries++
          if (item.retries >= 3) {
            console.error('[Sync] Max retries reached, removing item:', item.id)
            await idb.removeFromSyncQueue(item.id)
          } else {
            await idb.updateSyncQueueItem(item)
          }
        }
      }

      // 2. Fetch latest data from server for all entities
      console.log('[Sync] Fetching latest data from server')
      
      // Fetch bookmarks
      try {
        const bookmarksResponse = await $fetch<{ bookmarks: any[] }>('/api/bookmarks?limit=1000')
        if (bookmarksResponse.bookmarks && bookmarksResponse.bookmarks.length > 0) {
          await idb.saveBookmarks(bookmarksResponse.bookmarks)
          console.log('[Sync] Synced', bookmarksResponse.bookmarks.length, 'bookmarks to IndexedDB')
        }
      } catch (e) {
        console.warn('[Sync] Failed to fetch bookmarks:', e)
      }

      // Fetch notes
      try {
        const notesResponse = await $fetch<{ notes: any[] }>('/api/notes/markdown?limit=1000')
        if (notesResponse.notes && notesResponse.notes.length > 0) {
          const notes: Note[] = notesResponse.notes.map(n => ({
            id: n.id,
            title: n.title,
            content: n.content,
            tags: n.tags || [],
            isFavorite: n.isFavorite,
            createdAt: n.createdAt,
            updatedAt: n.updatedAt,
          }))
          await idb.saveNotes(notes)
          console.log('[Sync] Synced', notes.length, 'notes to IndexedDB')
        }
      } catch (e) {
        console.warn('[Sync] Failed to fetch notes:', e)
      }

      // Fetch secrets
      try {
        const secretsResponse = await $fetch<{ notes: any[] }>('/api/notes/secret')
        if (secretsResponse.notes && secretsResponse.notes.length > 0) {
          const secrets: Secret[] = secretsResponse.notes.map(s => ({
            id: s.id,
            title: s.title,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            lastAccessedAt: s.lastAccessedAt,
          }))
          await idb.saveSecrets(secrets)
          console.log('[Sync] Synced', secrets.length, 'secrets to IndexedDB')
        }
      } catch (e) {
        console.warn('[Sync] Failed to fetch secrets:', e)
      }

      // Fetch tags
      try {
        const tagsResponse = await $fetch<{ tags: any[] }>('/api/tags')
        if (tagsResponse.tags && tagsResponse.tags.length > 0) {
          const tags: Tag[] = tagsResponse.tags.map(t => ({
            id: t.id,
            name: t.name,
            parentTagId: t.parentTagId,
            color: t.color,
            createdAt: t.createdAt,
            bookmarkCount: t.bookmarkCount,
          }))
          // Convert to plain object to avoid Vue proxy cloning issues with IndexedDB
          const plainTags = JSON.parse(JSON.stringify(tags))
          await idb.saveTags(plainTags)
          console.log('[Sync] Synced', tags.length, 'tags to IndexedDB')
        }
      } catch (e: any) {
        console.warn('[Sync] Failed to fetch tags:', e?.message || e)
      }

      lastSyncTime.value = new Date()
      pendingChanges.value = (await idb.getSyncQueue()).length
      syncStatus.value = 'success'
      console.log('[Sync] Sync completed successfully')
      
      return true
    } catch (e: any) {
      console.error('[Sync] Sync failed:', e)
      syncError.value = e.message || 'Sync failed'
      syncStatus.value = 'error'
      return false
    } finally {
      isSyncing.value = false
    }
  }

  async function processSyncItem(item: SyncQueueItem): Promise<void> {
    switch (item.entity) {
      case 'note':
        await processNoteSync(item)
        break
      case 'secret':
        await processSecretSync(item)
        break
      case 'tag':
        await processTagSync(item)
        break
      default:
        console.warn('[Sync] Unknown entity type:', item.entity)
    }
  }

  async function processNoteSync(item: SyncQueueItem): Promise<void> {
    switch (item.action) {
      case 'create':
        await $fetch('/api/notes/markdown', {
          method: 'POST',
          body: item.data
        })
        break
      case 'update':
        await $fetch(`/api/notes/markdown/${item.id}`, {
          method: 'PUT',
          body: item.data
        })
        break
      case 'delete':
        await $fetch(`/api/notes/markdown/${item.id}`, {
          method: 'DELETE'
        })
        break
    }
  }

  async function processSecretSync(item: SyncQueueItem): Promise<void> {
    switch (item.action) {
      case 'create':
        await $fetch('/api/notes/secret', {
          method: 'POST',
          body: item.data
        })
        break
      case 'update':
        await $fetch(`/api/notes/secret/${item.id}`, {
          method: 'PUT',
          body: item.data
        })
        break
      case 'delete':
        await $fetch(`/api/notes/secret/${item.id}`, {
          method: 'DELETE'
        })
        break
    }
  }

  async function processTagSync(item: SyncQueueItem): Promise<void> {
    switch (item.action) {
      case 'create':
        await $fetch('/api/tags', {
          method: 'POST',
          body: item.data
        })
        break
      case 'update':
        await $fetch(`/api/tags/${item.id}`, {
          method: 'PUT',
          body: item.data
        })
        break
      case 'delete':
        await $fetch(`/api/tags/${item.id}`, {
          method: 'DELETE'
        })
        break
    }
  }

  // Queue a change for sync
  async function queueChange(entity: 'note' | 'secret' | 'tag', action: 'create' | 'update' | 'delete', id: string, data?: any): Promise<void> {
    console.log('[Sync] Queueing change:', action, entity, id)
    
    const item = {
      id: `${entity}-${action}-${id}-${Date.now()}`,
      action,
      entity,
      data: data || { id },
      timestamp: Date.now(),
    }
    
    await idb.addToSyncQueue(item)
    pendingChanges.value++
    
    if (isOnline.value) {
      performSync()
    }
  }

  // One-time sync on init only - no periodic timer
  function startPeriodicSync(): void {
    console.log('[Sync] Starting one-time sync on init')
    
    // Run initial sync if online (background, non-blocking)
    if (isOnline.value) {
      performSync()
    }
  }

  // Stop periodic sync (no-op since no timer)
  function stopPeriodicSync(): void {
    console.log('[Sync] Stop periodic sync (no-op)')
  }

  // Manual sync trigger
  async function triggerSync(): Promise<boolean> {
    console.log('[Sync] Manual sync triggered')
    return performSync()
  }

  // Auto-initialize on client
  onMounted(() => {
    console.log('[Sync] Initializing sync service')
    initOnlineStatus()
    startPeriodicSync()
  })

  onUnmounted(() => {
    stopPeriodicSync()
  })

  return {
    isOnline,
    isSyncing,
    syncStatus,
    lastSyncTime,
    pendingChanges,
    syncError,
    performSync,
    queueChange,
    triggerSync,
    startPeriodicSync,
    stopPeriodicSync,
  }
}