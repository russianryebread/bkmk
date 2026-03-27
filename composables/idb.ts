import type { Bookmark } from './useBookmarks'

const DB_NAME = 'bkmk-offline-db'
const DB_VERSION = 1
const BOOKMARKS_STORE = 'bookmarks'
const SYNC_QUEUE_STORE = 'sync-queue'
const SETTINGS_STORE = 'settings'

interface DBSchema {
  bookmarks: Bookmark
  'sync-queue': SyncQueueItem
  settings: SettingItem
}

interface SyncQueueItem {
  id: string
  action: 'create' | 'update' | 'delete'
  data: any
  timestamp: number
  retries: number
}

interface SettingItem {
  key: string
  value: any
}

let dbInstance: IDBDatabase | null = null

export function useIdb() {
  const isReady = ref(false)
  const error = ref<string | null>(null)

  async function openDatabase(): Promise<IDBDatabase> {
    if (dbInstance) return dbInstance

    return new Promise((resolve, reject) => {
      console.log('[IDB] Opening database...')
      
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        const err = `Failed to open database: ${request.error?.message}`
        console.error('[IDB] Error:', err)
        error.value = err
        reject(new Error(err))
      }

      request.onsuccess = () => {
        dbInstance = request.result
        console.log('[IDB] Database opened successfully')
        isReady.value = true
        resolve(dbInstance)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        console.log('[IDB] Upgrading database...')
        
        // Create bookmarks store
        if (!db.objectStoreNames.contains(BOOKMARKS_STORE)) {
          const bookmarksStore = db.createObjectStore(BOOKMARKS_STORE, { keyPath: 'id' })
          bookmarksStore.createIndex('saved_at', 'saved_at', { unique: false })
          bookmarksStore.createIndex('is_favorite', 'is_favorite', { unique: false })
          bookmarksStore.createIndex('is_read', 'is_read', { unique: false })
          console.log('[IDB] Created bookmarks store')
        }

        // Create sync queue store
        if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
          const syncStore = db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id' })
          syncStore.createIndex('timestamp', 'timestamp', { unique: false })
          console.log('[IDB] Created sync-queue store')
        }

        // Create settings store
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' })
          console.log('[IDB] Created settings store')
        }
      }
    })
  }

  async function initialize(): Promise<void> {
    console.log('[IDB] Initializing...')
    try {
      await openDatabase()
      console.log('[IDB] Initialization complete')
    } catch (e) {
      console.error('[IDB] Initialization failed:', e)
      throw e
    }
  }

  // Bookmarks operations
  async function saveBookmark(bookmark: Bookmark): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BOOKMARKS_STORE, 'readwrite')
      const store = tx.objectStore(BOOKMARKS_STORE)
      const request = store.put(bookmark)
      
      request.onsuccess = () => {
        console.log('[IDB] Saved bookmark:', bookmark.id)
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  async function saveBookmarks(bookmarks: Bookmark[]): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BOOKMARKS_STORE, 'readwrite')
      const store = tx.objectStore(BOOKMARKS_STORE)
      
      bookmarks.forEach(bookmark => store.put(bookmark))
      
      tx.oncomplete = () => {
        console.log('[IDB] Saved', bookmarks.length, 'bookmarks')
        resolve()
      }
      tx.onerror = () => reject(tx.error)
    })
  }

  async function getBookmark(id: string): Promise<Bookmark | null> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BOOKMARKS_STORE, 'readonly')
      const store = tx.objectStore(BOOKMARKS_STORE)
      const request = store.get(id)
      
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  async function getAllBookmarks(): Promise<Bookmark[]> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BOOKMARKS_STORE, 'readonly')
      const store = tx.objectStore(BOOKMARKS_STORE)
      const request = store.getAll()
      
      request.onsuccess = () => {
        console.log('[IDB] Retrieved', request.result.length, 'bookmarks')
        resolve(request.result)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async function deleteBookmark(id: string): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BOOKMARKS_STORE, 'readwrite')
      const store = tx.objectStore(BOOKMARKS_STORE)
      const request = store.delete(id)
      
      request.onsuccess = () => {
        console.log('[IDB] Deleted bookmark:', id)
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  async function clearBookmarks(): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BOOKMARKS_STORE, 'readwrite')
      const store = tx.objectStore(BOOKMARKS_STORE)
      const request = store.clear()
      
      request.onsuccess = () => {
        console.log('[IDB] Cleared all bookmarks')
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Sync queue operations
  async function addToSyncQueue(item: Omit<SyncQueueItem, 'retries'>): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite')
      const store = tx.objectStore(SYNC_QUEUE_STORE)
      const request = store.put({ ...item, retries: 0 })
      
      request.onsuccess = () => {
        console.log('[IDB] Added to sync queue:', item.action, item.id)
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  async function getSyncQueue(): Promise<SyncQueueItem[]> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SYNC_QUEUE_STORE, 'readonly')
      const store = tx.objectStore(SYNC_QUEUE_STORE)
      const request = store.getAll()
      
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async function removeFromSyncQueue(id: string): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite')
      const store = tx.objectStore(SYNC_QUEUE_STORE)
      const request = store.delete(id)
      
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async function updateSyncQueueItem(item: SyncQueueItem): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite')
      const store = tx.objectStore(SYNC_QUEUE_STORE)
      const request = store.put(item)
      
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // Settings operations
  async function setSetting(key: string, value: any): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SETTINGS_STORE, 'readwrite')
      const store = tx.objectStore(SETTINGS_STORE)
      const request = store.put({ key, value })
      
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async function getSetting<T>(key: string): Promise<T | null> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SETTINGS_STORE, 'readonly')
      const store = tx.objectStore(SETTINGS_STORE)
      const request = store.get(key)
      
      request.onsuccess = () => resolve(request.result?.value ?? null)
      request.onerror = () => reject(request.error)
    })
  }

  return {
    isReady,
    error,
    initialize,
    // Bookmarks
    saveBookmark,
    saveBookmarks,
    getBookmark,
    getAllBookmarks,
    deleteBookmark,
    clearBookmarks,
    // Sync queue
    addToSyncQueue,
    getSyncQueue,
    removeFromSyncQueue,
    updateSyncQueueItem,
    // Settings
    setSetting,
    getSetting,
  }
}
