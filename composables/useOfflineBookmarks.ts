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

  // Fetch bookmarks with offline fallback
  async function fetchBookmarks(filters: BookmarkFilters = {}): Promise<Bookmark[]> {
    offlineError.value = null
    
    // Try online fetch first
    if (isOnline.value) {
      try {
        console.log('[OfflineBookmarks] Fetching bookmarks from server')
        const params = new URLSearchParams()
        
        if (filters.page) params.set('page', filters.page.toString())
        if (filters.limit) params.set('limit', filters.limit.toString())
        if (filters.sort) params.set('sort', filters.sort)
        if (filters.order) params.set('order', filters.order)
        if (filters.favorite) params.set('favorite', 'true')
        if (filters.tag) params.set('tag', filters.tag)
        if (filters.domain) params.set('domain', filters.domain)
        if (filters.unread) params.set('unread', 'true')

        const response = await $fetch<{ bookmarks: Bookmark[] }>(`/api/bookmarks?${params}`)
        
        // Cache in IndexedDB
        if (response.bookmarks && response.bookmarks.length > 0) {
          await saveBookmarks(response.bookmarks)
          console.log('[OfflineBookmarks] Cached', response.bookmarks.length, 'bookmarks')
        }
        
        return response.bookmarks || []
      } catch (e: any) {
        console.warn('[OfflineBookmarks] Server fetch failed, falling back to IndexedDB:', e.message)
        offlineError.value = 'Using cached data (server unavailable)'
      }
    }

    // Fallback to IndexedDB
    console.log('[OfflineBookmarks] Fetching bookmarks from IndexedDB')
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
      return bookmarks
    } catch (e: any) {
      console.error('[OfflineBookmarks] IndexedDB fetch failed:', e)
      offlineError.value = 'Failed to load bookmarks'
      return []
    }
  }

  // Fetch single bookmark with offline fallback
  async function fetchBookmark(id: string): Promise<Bookmark | null> {
    offlineError.value = null
    
    // Try online fetch first
    if (isOnline.value) {
      try {
        const response = await $fetch<Bookmark>(`/api/bookmarks/${id}`)
        // Cache in IndexedDB
        await saveBookmark(response)
        return response
      } catch (e: any) {
        console.warn('[OfflineBookmarks] Server fetch failed, falling back to IndexedDB:', e.message)
      }
    }

    // Fallback to IndexedDB
    try {
      return await getBookmark(id)
    } catch (e: any) {
      console.error('[OfflineBookmarks] IndexedDB fetch failed:', e)
      return null
    }
  }

  // Delete bookmark with offline support
  async function deleteBookmark(id: string): Promise<boolean> {
    try {
      // Try online delete first
      if (isOnline.value) {
        try {
          await $fetch(`/api/bookmarks/${id}`, { method: 'DELETE' })
          console.log('[OfflineBookmarks] Deleted from server')
        } catch (e) {
          console.warn('[OfflineBookmarks] Server delete failed, queuing for later:', e)
          // Queue for sync
          // await queueChange('delete', id)
        }
      }
      
      // Always remove from local cache
      await idbDeleteBookmark(id)
      console.log('[OfflineBookmarks] Deleted from IndexedDB')
      
      return true
    } catch (e: any) {
      console.error('[OfflineBookmarks] Delete failed:', e)
      return false
    }
  }

  // Update bookmark with offline support
  async function updateBookmark(id: string, updates: Partial<Bookmark>): Promise<boolean> {
    try {
      // Get current bookmark
      const current = await fetchBookmark(id)
      if (!current) return false

      const updated = { ...current, ...updates, updated_at: new Date().toISOString() }
      
      // Save to local cache immediately
      await saveBookmark(updated)
      
      // Try to sync with server
      if (isOnline.value) {
        try {
          await $fetch(`/api/bookmarks/${id}`, {
            method: 'PUT',
            body: updates
          })
          console.log('[OfflineBookmarks] Updated on server')
        } catch (e) {
          console.warn('[OfflineBookmarks] Server update failed, stored locally:', e)
          // Queue for sync
          // await queueChange('update', id, updates)
        }
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
  }
}
