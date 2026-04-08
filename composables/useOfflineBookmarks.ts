import { useIdb } from './idb'
import type { Bookmark, BookmarkFilters } from './useBookmarks'

export interface CursorBookmarkFilters extends BookmarkFilters {
  search?: string
}

export function useOfflineBookmarks() {
  const { saveBookmark, saveBookmarks, getBookmark, getAllBookmarks, deleteBookmark: idbDeleteBookmark, searchBookmarks } = useIdb()

  const isOnline = ref(true)
  const offlineError = ref<string | null>(null)
  const cacheVersion = ref(0)

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

  // Fetch bookmarks with cursor-based pagination for infinite scroll
  async function fetchBookmarksPaginated(
    cursor: string | null,
    filters: CursorBookmarkFilters = {},
    limit: number = 20
  ): Promise<{ bookmarks: Bookmark[]; nextCursor: string | null; hasMore: boolean }> {
    offlineError.value = null
    
    try {
      let bookmarks = await getAllBookmarks()
      
      // Apply filters
      if (filters.favorite) {
        bookmarks = bookmarks.filter(b => b.is_favorite)
      }
      if (filters.unread) {
        bookmarks = bookmarks.filter(b => !b.is_read)
      }
      if (filters.tag) {
        bookmarks = bookmarks.filter(b => b.tags && b.tags.includes(filters.tag!))
      }
      
      // Apply search filter
      if (filters.search) {
        const query = filters.search.toLowerCase()
        bookmarks = bookmarks.filter(b => 
          b.title?.toLowerCase().includes(query) ||
          b.description?.toLowerCase().includes(query) ||
          b.url?.toLowerCase().includes(query) ||
          b.source_domain?.toLowerCase().includes(query) ||
          b.tags?.some(tag => tag.toLowerCase().includes(query))
        )
      }
      
      // Sort
      const sort = filters.sort || 'saved_at'
      const order = filters.order || 'desc'
      bookmarks.sort((a, b) => {
        const aVal = (a as any)[sort] || ''
        const bVal = (b as any)[sort] || ''
        if (typeof aVal === 'boolean') return order === 'desc' ? (bVal ? 1 : -1) : (aVal ? 1 : -1)
        return order === 'desc' 
          ? (bVal > aVal ? 1 : bVal < aVal ? -1 : 0)
          : (aVal > bVal ? 1 : aVal < bVal ? -1 : 0)
      })
      
      // Find cursor position
      let startIndex = 0
      if (cursor) {
        const cursorIndex = bookmarks.findIndex(b => b.id === cursor)
        if (cursorIndex !== -1) {
          startIndex = cursorIndex + 1
        }
      }
      
      // Get page of results
      const pageBookmarks = bookmarks.slice(startIndex, startIndex + limit)
      const hasMore = startIndex + limit < bookmarks.length
      const nextCursor = hasMore && pageBookmarks.length > 0 
        ? pageBookmarks[pageBookmarks.length - 1].id 
        : null
      
      console.log('[OfflineBookmarks] Returning', pageBookmarks.length, 'bookmarks, hasMore:', hasMore)
      
      // Refresh from server in background
      if (isOnline.value) {
        refreshFromServer()
      }
      
      return {
        bookmarks: pageBookmarks,
        nextCursor,
        hasMore,
      }
    } catch (e: any) {
      console.error('[OfflineBookmarks] IndexedDB fetch failed:', e)
      offlineError.value = 'Failed to load bookmarks'
      return { bookmarks: [], nextCursor: null, hasMore: false }
    }
  }

  // Legacy fetchBookmarks for backwards compatibility
  async function fetchBookmarks(filters: BookmarkFilters = {}): Promise<Bookmark[]> {
    const result = await fetchBookmarksPaginated(null, filters, filters.limit || 20)
    return result.bookmarks
  }

// Refresh cache from server (background, non-blocking)
  async function refreshFromServer(): Promise<void> {
    if (!isOnline.value) return

    try {
      console.log('[OfflineBookmarks] Refreshing cache from server (background)')
      const response = await $fetch<{ bookmarks: Bookmark[] }>('/api/bookmarks?limit=1000')

      if (response.bookmarks && response.bookmarks.length > 0) {
        await saveBookmarks(response.bookmarks)
        cacheVersion.value++ // Increment version to trigger UI updates
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

  // Create bookmark via API
  async function createBookmark(url: string): Promise<Bookmark | null> {
    console.log('[OfflineBookmarks] createBookmark called for url:', url)
    
    try {
      // Create via API
      const response = await $fetch<Bookmark>('/api/scrape', {
        method: 'POST',
        body: { url },
      })
      
      // Save to local cache immediately
      await fetchBookmark(response.id)
      
      // Trigger background refresh from server to ensure cache is up to date
      refreshFromServer()
      
      return response
    } catch (e: any) {
      console.error('[OfflineBookmarks] Error creating bookmark:', e)
      throw e
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
    fetchBookmarksPaginated,
    fetchBookmark,
    createBookmark,
    deleteBookmark,
    updateBookmark,
    refreshFromServer,
  }
}
