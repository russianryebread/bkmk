import { useOfflineBookmarks } from './useOfflineBookmarks'
import type { Bookmark, BookmarkFilters } from './useBookmarks'

export interface Bookmark {
  id: string
  title: string
  url: string
  description: string | null
  original_html: string | null
  cleaned_markdown: string | null
  reading_time_minutes: number | null
  saved_at: string
  last_accessed_at: string | null
  is_favorite: boolean
  sort_order: number | null
  thumbnail_image_path: string | null
  is_read: boolean
  read_at: string | null
  source_domain: string | null
  word_count: number | null
  created_at: string
  updated_at: string
  tags: string[]
  tag_ids: string[]
}

export interface BookmarkFilters {
  page?: number
  limit?: number
  sort?: string
  order?: string
  favorite?: boolean
  tag?: string
  domain?: string
  unread?: boolean
}

export function useBookmarks() {
  const offlineBookmarks = useOfflineBookmarks()
  const bookmarks = ref<Bookmark[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const pagination = ref({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  async function fetchBookmarks(filters: BookmarkFilters = {}) {
    console.log('[useBookmarks] fetchBookmarks called with filters:', filters)
    loading.value = true
    error.value = null
    
    try {
      const results = await offlineBookmarks.fetchBookmarks(filters)
      bookmarks.value = results
      
      // Update pagination (simplified for offline)
      pagination.value = {
        ...pagination.value,
        page: filters.page || 1,
        limit: filters.limit || 20,
      }
      
      console.log('[useBookmarks] Loaded', results.length, 'bookmarks')
    } catch (e: any) {
      console.error('[useBookmarks] Error:', e)
      error.value = e.message || 'Failed to fetch bookmarks'
    } finally {
      loading.value = false
    }
  }

  async function fetchBookmark(id: string): Promise<Bookmark | null> {
    console.log('[useBookmarks] fetchBookmark called for id:', id)
    try {
      return await offlineBookmarks.fetchBookmark(id)
    } catch (e: any) {
      console.error('[useBookmarks] Error fetching bookmark:', e)
      error.value = e.message || 'Failed to fetch bookmark'
      return null
    }
  }

  async function createBookmark(url: string): Promise<Bookmark | null> {
    console.log('[useBookmarks] createBookmark called for url:', url)
    loading.value = true
    error.value = null
    
    try {
      // Create via API
      const response = await $fetch<Bookmark>('/api/scrape', {
        method: 'POST',
        body: { url },
      })
      
      // Refresh list
      await fetchBookmarks()
      
      return response
    } catch (e: any) {
      console.error('[useBookmarks] Error creating bookmark:', e)
      error.value = e.message || 'Failed to create bookmark'
      return null
    } finally {
      loading.value = false
    }
  }

  async function updateBookmark(id: string, updates: Partial<Bookmark>): Promise<boolean> {
    console.log('[useBookmarks] updateBookmark called for id:', id, updates)
    try {
      const success = await offlineBookmarks.updateBookmark(id, updates)
      
      // Update local state
      const index = bookmarks.value.findIndex(b => b.id === id)
      if (index !== -1) {
        bookmarks.value[index] = { ...bookmarks.value[index], ...updates }
      }
      
      return success
    } catch (e: any) {
      console.error('[useBookmarks] Error updating bookmark:', e)
      error.value = e.message || 'Failed to update bookmark'
      return false
    }
  }

  async function deleteBookmark(id: string): Promise<boolean> {
    console.log('[useBookmarks] deleteBookmark called for id:', id)
    try {
      const success = await offlineBookmarks.deleteBookmark(id)
      
      // Update local state
      bookmarks.value = bookmarks.value.filter(b => b.id !== id)
      
      return success
    } catch (e: any) {
      console.error('[useBookmarks] Error deleting bookmark:', e)
      error.value = e.message || 'Failed to delete bookmark'
      return false
    }
  }

  async function toggleFavorite(id: string): Promise<boolean> {
    const bookmark = bookmarks.value.find(b => b.id === id)
    if (!bookmark) return false
    
    return updateBookmark(id, { is_favorite: !bookmark.is_favorite })
  }

  async function markAsRead(id: string): Promise<boolean> {
    return updateBookmark(id, { is_read: true })
  }

  async function toggleRead(id: string): Promise<boolean> {
    const bookmark = bookmarks.value.find(b => b.id === id)
    if (!bookmark) return false
    
    return updateBookmark(id, { is_read: !bookmark.is_read })
  }

  return {
    bookmarks,
    loading,
    error,
    pagination,
    isOnline: offlineBookmarks.isOnline,
    offlineError: offlineBookmarks.offlineError,
    fetchBookmarks,
    fetchBookmark,
    createBookmark,
    updateBookmark,
    deleteBookmark,
    toggleFavorite,
    markAsRead,
    toggleRead,
  }
}
