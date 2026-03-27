import { useIdb } from './idb'

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline'

export function useSync() {
  const { saveBookmark, saveBookmarks, getAllBookmarks, deleteBookmark, addToSyncQueue, getSyncQueue, removeFromSyncQueue, updateSyncQueueItem } = useIdb()
  
  const isOnline = ref(true)
  const isSyncing = ref(false)
  const syncStatus = ref<SyncStatus>('idle')
  const lastSyncTime = ref<Date | null>(null)
  const pendingChanges = ref(0)
  const syncError = ref<string | null>(null)
  
  let syncInterval: NodeJS.Timeout | null = null

  // Initialize online status listeners
  function initOnlineStatus() {
    console.log('[Sync] Initializing online status listeners')
    
    isOnline.value = navigator.onLine
    
    window.addEventListener('online', () => {
      console.log('[Sync] Online event received')
      isOnline.value = true
      syncStatus.value = 'idle'
      // Trigger sync when coming back online
      performSync()
    })
    
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
      const queue = await getSyncQueue()
      console.log('[Sync] Processing', queue.length, 'queued operations')
      
      for (const item of queue) {
        try {
          await processSyncItem(item)
          await removeFromSyncQueue(item.id)
          console.log('[Sync] Processed sync item:', item.action, item.id)
        } catch (e) {
          console.error('[Sync] Failed to process item:', item.id, e)
          // Increment retry count
          item.retries++
          if (item.retries >= 3) {
            console.error('[Sync] Max retries reached, removing item:', item.id)
            await removeFromSyncQueue(item.id)
          } else {
            await updateSyncQueueItem(item)
          }
        }
      }

      // 2. Fetch latest data from server
      console.log('[Sync] Fetching latest data from server')
      const response = await $fetch<{ bookmarks: any[] }>('/api/bookmarks?limit=1000')
      
      // 3. Update local IndexedDB
      if (response.bookmarks && response.bookmarks.length > 0) {
        await saveBookmarks(response.bookmarks)
        console.log('[Sync] Synced', response.bookmarks.length, 'bookmarks to IndexedDB')
      }

      lastSyncTime.value = new Date()
      pendingChanges.value = (await getSyncQueue()).length
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

  async function processSyncItem(item: any): Promise<void> {
    switch (item.action) {
      case 'create':
        await $fetch('/api/scrape', {
          method: 'POST',
          body: item.data
        })
        break
      case 'update':
        await $fetch(`/api/bookmarks/${item.id}`, {
          method: 'PUT',
          body: item.data
        })
        break
      case 'delete':
        await $fetch(`/api/bookmarks/${item.id}`, {
          method: 'DELETE'
        })
        break
    }
  }

  // Queue a change for sync
  async function queueChange(action: 'create' | 'update' | 'delete', id: string, data?: any): Promise<void> {
    console.log('[Sync] Queueing change:', action, id)
    
    const item = {
      id: `${action}-${id}-${Date.now()}`,
      action,
      data: data || { id },
      timestamp: Date.now(),
    }
    
    await addToSyncQueue(item)
    pendingChanges.value++
    
    // If online, trigger immediate sync
    if (isOnline.value) {
      performSync()
    }
  }

  // Start periodic sync
  function startPeriodicSync(intervalMs: number = 60000): void {
    console.log('[Sync] Starting periodic sync, interval:', intervalMs)
    
    // Clear existing interval
    if (syncInterval) {
      clearInterval(syncInterval)
    }
    
    // Initial sync
    performSync()
    
    // Set up interval
    syncInterval = setInterval(() => {
      if (isOnline.value && !isSyncing.value) {
        performSync()
      }
    }, intervalMs)
  }

  // Stop periodic sync
  function stopPeriodicSync(): void {
    if (syncInterval) {
      clearInterval(syncInterval)
      syncInterval = null
      console.log('[Sync] Stopped periodic sync')
    }
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
