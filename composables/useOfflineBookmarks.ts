import { useIdb } from './idb'
import type { Bookmark, BookmarkFilters } from './useBookmarks'

export function useOfflineBookmarks() {
  const { saveBookmark, saveBookmarks, getBookmark, getAllBookmarks, deleteBookmark: idbDeleteBookmark } = useIdb()
  
  const isOnline = ref(true)
  const offlineError = ref<string | null>(null)

  // Initialize online status
  onMounted(() => {
    isOnline.value = navigator.onLine
    
    window.addEventListener('online', () => {
      console.log('[OfflineBookmarks] Back online')
      isOnline.value = true
      offlineError.value = null
    })
    
    window.addEventListener('offline', () => {
      console.log('[OfflineBookmarks] Gone offline')
      isOnline.value = false
    })
  })

  // ALWAYS read from IndexedDB first for local-first performance
  async function fetchBookmarks(filters: BookmarkFilters = {}): Promise<Bookmark[]> {
    offlineError.value = null
    
    // First, read from IndexedDB (instant, local-first)
    console.log('[OfflineBookmarks] Fetching bookmarks from IndexedDB (local-first)')
    try {
      let bookmarks = await getAllBookmarks()
      
      // Apply filters locally
      if (filters.favorite) {
        bookmarks = bookmarks.filter(b => b.is_favorite)
      }
      if (filters.unread) {
        bookmarks = bookmarks.filter(b => !b.is_read)
      }
      if (filters.tag) {
        bookmarks = bookmarks.filter(b => b.tags && b.tags.includes(filters.tag!))
      }
      
      // Sort
      const sort = filters.sort || 'saved_at'
      const order = filters.order || 'desc'
      bookmarks.sort((a, b) => {
        const aVal = (a as any)[sort] || ''
        const bVal = (b as any)[sort] || ''
        return order === 'desc' 
          ? (bVal > aVal ? 1 : -1)
          : (aVal > bVal ? 1 : -1)
      })
      
      // Paginate
      const page = filters.page || 1
      const limit = filters.limit || 20
      const start = (page - 1) * limit
      bookmarks = bookmarks.slice(start, start + limit)
      
      console.log('[OfflineBookmarks] Returning', bookmarks.length, 'bookmarks from IndexedDB')
      
      // THEN fetch from server in background to update cache
      if (isOnline.value) {
        refreshFromServer()
      }
      
      return bookmarks
    } catch (e: any) {
      console.error('[OfflineBookmarks] IndexedDB fetch failed:', e)
      offlineError.value = 'Failed to load bookmarks'
      return []
    }
  }

  // Refresh cache from server (background, non-blocking)
  async function refreshFromServer(): Promise<void> {
    if (!isOnline.value) return
    
    try {
      console.log('[OfflineBookmarks] Refreshing cache from server (background)')
      const response = await $fetch<{ bookmarks: Bookmark[] }>('/api/bookmarks?limit=1000')
      
      if (response.bookmarks && response.bookmarks.length > 0) {
        await saveBookmarks(response.bookmarks)
        console.log('[OfflineBookmarks] Cache refreshed with', response.bookmarks.length, 'bookmarks')
      }
    } catch (e: any) {
      console.warn('[OfflineBookmarks] Cache refresh failed:', e.message)
    }
  }

  // Fetch single bookmark - always from IndexedDB first
  async function fetchBookmark(id: string): Promise<Bookmark | null> {
    offlineError.value = null
    
    // First, read from IndexedDB
    try {
      const cached = await getBookmark(id)
      if (cached) {
        console.log('[OfflineBookmarks] Found bookmark in IndexedDB:', id)
        
        // Then refresh from server in background
        if (isOnline.value) {
          refreshBookmarkFromServer(id)
        }
        
        return cached
      }
    } catch (e: any) {
      console.warn('[OfflineBookmarks] IndexedDB lookup failed:', e.message)
    }
    
    // If not in cache and online, try server
    if (isOnline.value) {
      try {
        const response = await $fetch<Bookmark>(`/api/bookmarks/${id}`)
        await saveBookmark(response)
        return response
      } catch (e: any) {
        console.warn('[OfflineBookmarks] Server fetch failed:', e.message)
      }
    }
    
    return null
  }

  // Refresh single bookmark from server (background, non-blocking)
  async function refreshBookmarkFromServer(id: string): Promise<void> {
    if (!isOnline.value) return
    
    try {
      const response = await $fetch<Bookmark>(`/api/bookmarks/${id}`)
      await saveBookmark(response)
      console.log('[OfflineBookmarks] Refreshed bookmark from server:', id)
    } catch (e) {
      // Silently fail - we have cached version
    }
  }

  // Delete bookmark - always local first
  async function deleteBookmark(id: string): Promise<boolean> {
    // Always delete from local cache immediately
    await idbDeleteBookmark(id)
    console.log('[OfflineBookmarks] Deleted from IndexedDB')
    
    // Try to sync with server in background
    if (isOnline.value) {
      $fetch(`/api/bookmarks/${id}`, { method: 'DELETE' })
        .catch(e => console.warn('[OfflineBookmarks] Server delete failed:', e.message))
    }
    
    return true
  }

  // Update bookmark - always local first
  async function updateBookmark(id: string, updates: Partial<Bookmark>): Promise<boolean> {
    try {
      // Get current bookmark from cache
      const current = await getBookmark(id)
      if (!current) return false

      const updated = { ...current, ...updates, updated_at: new Date().toISOString() }
      
      // Save to local cache immediately (instant)
      await saveBookmark(updated)
      console.log('[OfflineBookmarks] Updated in IndexedDB')
      
      // Sync with server in background (non-blocking)
      if (isOnline.value) {
        $fetch(`/api/bookmarks/${id}`, {
          method: 'PUT',
          body: updates
        }).catch(e => console.warn('[OfflineBookmarks] Server update failed:', e.message))
      }
      
      return true
    } catch (e: any) {
      console.error('[OfflineBookmarks] Update failed:', e)
      return false
    }
  }

  return {
    isOnline,
    offlineError,
    fetchBookmarks,
    fetchBookmark,
    deleteBookmark,
    updateBookmark,
    refreshFromServer,
  }
}
